const db = require('../database/db');
const settings = require('./settings-service');
const antiBan = require('./anti-ban-service');
const whatsapp = require('./whatsapp-service');
const botEvents = require('./bot-events-service');

const DEFAULT_DAYS = '3,7,14,30';
const DEFAULT_MSG = 'Olá {nome}, tudo bem? Você pediu uma simulação de crédito e ainda não finalizou. Posso te encaminhar a proposta? Responda SIM para continuar.';
const FOLLOWUP_STATUSES = ['novo', 'contato'];
const BATCH_SIZE = 10;
const DEFAULT_WINDOW_START = '09:00';
const DEFAULT_WINDOW_END = '18:00';
const DEFAULT_WINDOW_DAYS = '1,2,3,4,5';

// Fora do MVP por hora: desligado por padrão até ser reativado explicitamente via cfg_followup_enabled=true.
async function enabled() {
    const s = await settings.get();
    return s.cfg_followup_enabled === 'true';
}

async function daysList() {
    const s = await settings.get();
    return (s.cfg_followup_days || DEFAULT_DAYS).split(',').map(Number).filter(d => Number.isFinite(d) && d > 0);
}

function parseTimeParts(value, fallbackHour, fallbackMinute) {
    if (!value || typeof value !== 'string') return { hour: fallbackHour, minute: fallbackMinute };
    const [h, m] = value.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return { hour: fallbackHour, minute: fallbackMinute };
    return { hour: Math.min(23, Math.max(0, Math.floor(h))), minute: Math.min(59, Math.max(0, Math.floor(m))) };
}

async function isWithinFollowupWindow(now = new Date()) {
    const s = await settings.get();
    const allowedDays = new Set(
        String(s.cfg_followup_window_days || DEFAULT_WINDOW_DAYS)
            .split(',')
            .map(Number)
            .filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
    );
    if (allowedDays.size && !allowedDays.has(now.getDay())) return false;

    const start = parseTimeParts(s.cfg_followup_window_start || DEFAULT_WINDOW_START, 9, 0);
    const end = parseTimeParts(s.cfg_followup_window_end || DEFAULT_WINDOW_END, 18, 0);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = start.hour * 60 + start.minute;
    const endMinutes = end.hour * 60 + end.minute;

    if (startMinutes === endMinutes) return true;
    if (startMinutes < endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    // Janela atravessa a meia-noite.
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

// Agenda follow-ups para leads sem resposta (inativos há N dias) — roda a cada ~10min
async function schedule() {
    if (!await enabled()) return { created: 0 };
    const days = await daysList();
    if (!days.length) return { created: 0 };

    let created = 0;
    for (let i = 0; i < days.length; i++) {
        const bucket = i + 1;
        const leads = await db.all(`
            SELECT l.id, l.seller_id
            FROM leads l
            WHERE l.status IN ('novo','contato')
              AND l.seller_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM opt_outs o WHERE o.organization_id=l.organization_id AND o.phone=l.phone)
              AND NOT EXISTS (SELECT 1 FROM followups f WHERE f.lead_id = l.id AND f.bucket = ?)
              AND COALESCE(
                  (SELECT MAX(s.sent_at) FROM sends s WHERE s.lead_id = l.id),
                  l.created_at
              ) <= datetime('now', ?)
        `, [bucket, `-${days[i]} days`]);

        for (const lead of leads) {
            const inserted = await db.run(
                `INSERT OR IGNORE INTO followups (lead_id, seller_id, bucket, due_at)
                 VALUES (?, ?, ?, datetime('now'))`,
                [lead.id, lead.seller_id, bucket]
            );
            created += inserted.changes;
        }
    }
    if (created) console.log(`[followup] ${created} follow-up(s) agendado(s)`);
    return { created };
}

async function buildMessage(f) {
    const s = await settings.get();
    const tmpl = s[`cfg_followup_msg${f.bucket}`] || s.cfg_followup_message || DEFAULT_MSG;
    return String(tmpl).replace(/\{nome\}/g, (f.name || '').split(' ')[0]);
}

// Processa follow-ups vencidos (agora — roda a cada 60s)
async function processDue() {
    if (!await enabled()) return { sent: 0 };
    if (!await isWithinFollowupWindow()) {
        console.log('[followup] fora da janela comercial — envio adiado');
        return { sent: 0, deferred: true };
    }

    const due = await db.all(`
        SELECT f.*, l.name, l.phone, l.status AS lead_status, l.organization_id AS lead_org_id
        FROM followups f
        JOIN leads l ON l.id = f.lead_id
        WHERE f.status = 'scheduled' AND f.due_at <= datetime('now')
        ORDER BY f.due_at ASC
        LIMIT ?
    `, [BATCH_SIZE]);
    if (!due.length) return { sent: 0 };

    let sent = 0;
    for (const f of due) {
        if (!FOLLOWUP_STATUSES.includes(f.lead_status)) {
            await db.run("UPDATE followups SET status = 'skipped' WHERE id = ?", [f.id]);
            continue;
        }

        // Reserva atomicamente (pick + incremento no mesmo UPDATE) — evita que
        // follow-up e campanha, rodando no mesmo ciclo, escolham o mesmo número
        // antes de qualquer um registrar o uso.
        const num = await antiBan.reserveNumber();
        if (!num) {
            console.warn('[followup] limite diário atingido em todos os números — aguardando próximo ciclo');
            break;
        }

        const msg = await buildMessage(f);
        const res = await whatsapp.sendMessage(num.number, f.phone, msg, {
            organizationId: f.organization_id || f.lead_org_id || 1,
            sellerId: f.seller_id
        });
        if (res.sent) {
            await db.run(
                "UPDATE followups SET status = 'sent', sent_at = datetime('now'), message = ?, number_id = ? WHERE id = ?",
                [msg, num.id, f.id]
            );
            await db.run(
                `INSERT INTO sends (campaign_id, lead_id, number_id, status, wa_message, sent_at)
                 VALUES (NULL, ?, ?, 'sent', ?, datetime('now'))`,
                [f.lead_id, num.id, msg]
            );
            botEvents.log(num.number, 'send_ok', `Follow-up #${f.bucket} ${f.name} → ${f.phone}`, num.label);
            sent++;
        } else {
            await antiBan.releaseNumber(num.id); // não saiu de fato — devolve a cota reservada
            if (res.reason === 'not_connected') {
                break; // bot offline — tenta no próximo ciclo
            }
            await db.run("UPDATE followups SET status = 'skipped' WHERE id = ?", [f.id]);
            botEvents.log(num.number, 'send_fail', `Follow-up ${f.name} (${res.reason})`, num.label);
        }
    }
    if (sent) console.log(`[followup] ${sent} follow-up(s) enviado(s)`);
    return { sent };
}

module.exports = { schedule, processDue, listToday, listUpcoming };

// Retornos do dia e atrasados do vendedor (para o painel "Retornos de Hoje")
async function listToday(seller_id) {
    return db.all(`
        SELECT f.id, f.bucket, f.due_at, f.status, l.id AS lead_id, l.name, l.phone,
               l.status AS lead_status, l.prioridade
        FROM followups f
        JOIN leads l ON l.id = f.lead_id
        WHERE f.seller_id = ?
          AND f.status = 'scheduled'
          AND date(f.due_at) <= date('now')
        ORDER BY f.due_at ASC
        LIMIT 100
    `, [seller_id]);
}

// Próximos retornos agendados (para além de hoje)
async function listUpcoming(seller_id, days = 7) {
    return db.all(`
        SELECT f.id, f.bucket, f.due_at, f.status, l.id AS lead_id, l.name, l.phone,
               l.status AS lead_status, l.prioridade
        FROM followups f
        JOIN leads l ON l.id = f.lead_id
        WHERE f.seller_id = ?
          AND f.status = 'scheduled'
          AND date(f.due_at) > date('now')
          AND date(f.due_at) <= date('now', ?)
        ORDER BY f.due_at ASC
        LIMIT 100
    `, [seller_id, `+${days} days`]);
}
