const db = require('../database/db');
const settings = require('./settings-service');
const antiBan = require('./anti-ban-service');
const whatsapp = require('./whatsapp-service');
const botEvents = require('./bot-events-service');

const DEFAULT_DAYS = '3,7,14,30';
const DEFAULT_MSG = 'Olá {nome}, tudo bem? Você pediu uma simulação de crédito e ainda não finalizou. Posso te encaminhar a proposta? Responda SIM para continuar.';
const FOLLOWUP_STATUSES = ['novo', 'contato'];
const BATCH_SIZE = 10;

async function enabled() {
    const s = await settings.get();
    return s.cfg_followup_enabled !== 'false';
}

async function daysList() {
    const s = await settings.get();
    return (s.cfg_followup_days || DEFAULT_DAYS).split(',').map(Number).filter(d => Number.isFinite(d) && d > 0);
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
              AND NOT EXISTS (SELECT 1 FROM followups f WHERE f.lead_id = l.id AND f.bucket = ?)
              AND COALESCE(
                  (SELECT MAX(s.sent_at) FROM sends s WHERE s.lead_id = l.id),
                  l.created_at
              ) <= datetime('now', ?)
        `, [bucket, `-${days[i]} days`]);

        for (const lead of leads) {
            await db.run(
                `INSERT OR IGNORE INTO followups (lead_id, seller_id, bucket, due_at)
                 VALUES (?, ?, ?, datetime('now'))`,
                [lead.id, lead.seller_id, bucket]
            );
            created++;
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

    const due = await db.all(`
        SELECT f.*, l.name, l.phone, l.status AS lead_status
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

        const num = await antiBan.pickBestNumber();
        if (!num) {
            console.warn('[followup] limite diário atingido em todos os números — aguardando próximo ciclo');
            break;
        }

        const msg = await buildMessage(f);
        const res = await whatsapp.sendMessage(num.number, f.phone, msg);
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
            await antiBan.markSent(num.id);
            botEvents.log(num.number, 'send_ok', `Follow-up #${f.bucket} ${f.name} → ${f.phone}`, num.label);
            sent++;
        } else if (res.reason === 'not_connected') {
            break; // bot offline — tenta no próximo ciclo
        } else {
            await db.run("UPDATE followups SET status = 'skipped' WHERE id = ?", [f.id]);
            botEvents.log(num.number, 'send_fail', `Follow-up ${f.name} (${res.reason})`, num.label);
        }
    }
    if (sent) console.log(`[followup] ${sent} follow-up(s) enviado(s)`);
    return { sent };
}

module.exports = { schedule, processDue };
