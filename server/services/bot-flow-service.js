const db = require('../database/db');
const whatsapp = require('./whatsapp-service');
const handoffs = require('./handoff-service');
const ws = require('./websocket-service');
const botEvents = require('./bot-events-service');

const YES = (process.env.BOT_CONFIRM_KEYWORDS || 'sim,ok,confirmo,quero,claro,pode,pode sim,tenho interesse,qual o valor,manda,enviar').split(',').map(s => s.trim()).filter(Boolean);
const NO = (process.env.BOT_DENY_KEYWORDS || 'nao,não,dispenso,obrigado,sem interesse,nao quero,não quero').split(',').map(s => s.trim()).filter(Boolean);
const STOP = (process.env.BOT_OPTOUT_KEYWORDS || 'pare,parar,sair,cancelar,remover,bloquear').split(',').map(s => s.trim()).filter(Boolean);

function normalizeText(t = '') { return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function match(text, list) {
    const t = normalizeText(text);
    return list.some(k => {
        const nk = normalizeText(k);
        return t === nk || t.startsWith(nk + ' ') || t.endsWith(' ' + nk) || t.includes(' ' + nk + ' ');
    });
}

async function addOptOut(send, phone, reason) {
    await db.run('INSERT OR IGNORE INTO opt_outs (organization_id,phone,reason) VALUES (?,?,?)', [send.organization_id || 1, phone, reason]);
    await db.run("UPDATE leads SET status='nao', updated_at=datetime('now') WHERE id=?", [send.lead_id]);
    await db.run(
        'INSERT INTO lead_history (lead_id, seller_id, from_status, to_status) VALUES (?, ?, ?, "nao")',
        [send.lead_id, send.seller_id, send.status]
    ).catch(() => {});
    ws.broadcast(send.organization_id || 1, { type: 'LEAD_UPDATE', lead_id: send.lead_id, seller_id: send.seller_id, status: 'nao' });
    await db.run("UPDATE sends SET status='recusado', replied_at=datetime('now') WHERE id=? AND status='sent'", [send.id]);
    await db.run("UPDATE followups SET status='cancelled' WHERE lead_id=? AND status='scheduled'", [send.lead_id]);
}

async function handleIncoming({ botNumber, phone, text }) {
    if (await handoffs.markReplied(botNumber, phone)) return { handled: true, action: 'seller_handoff_reply' };

    const send = await db.get(`SELECT s.*, l.name AS lead_name, l.seller_id, l.organization_id
        FROM sends s JOIN leads l ON l.id=s.lead_id JOIN bot_numbers bn ON bn.id=s.number_id
        WHERE l.phone=? AND bn.number=? AND s.status='sent' ORDER BY s.id DESC LIMIT 1`, [phone, botNumber]);
    if (!send) return { handled: false };

    if (match(text, STOP)) {
        await addOptOut(send, phone, 'Solicitado pelo contato');
        botEvents.log(botNumber, 'opt_out', `Lead ${send.lead_name || phone} solicitou parada/opt-out`, 'Descartável');
        return { handled: true, action: 'opt_out' };
    }

    if (match(text, YES)) {
        const changed = await db.run("UPDATE sends SET status='confirmado', replied_at=datetime('now') WHERE id=? AND status='sent'", [send.id]);
        if (!changed.changes) return { handled: true, action: 'already_processed' };

        // Devolução do contato para o vendedor de origem: status 'sim' (Qualificado / Liberado)
        await db.run("UPDATE leads SET status='sim', updated_at=datetime('now') WHERE id=?", [send.lead_id]);
        await db.run(
            'INSERT INTO lead_history (lead_id, seller_id, from_status, to_status) VALUES (?, ?, "enviados", "sim")',
            [send.lead_id, send.seller_id]
        ).catch(() => {});

        if (send.campaign_id) {
            await db.run('UPDATE campaigns SET total_yes=total_yes+1 WHERE id=?', [send.campaign_id]).catch(() => {});
        }

        botEvents.log(botNumber, 'lead_qualified', `🎉 Lead ${send.lead_name || phone} respondeu SIM! Devolvido ao vendedor #${send.seller_id}`, 'Descartável');

        // Notifica painéis (admin e operador) via WebSocket
        ws.broadcast(send.organization_id || 1, {
            type: 'LEAD_UPDATE',
            lead_id: send.lead_id,
            seller_id: send.seller_id,
            status: 'sim',
            lead_name: send.lead_name,
            phone: send.phone,
            event: 'qualified'
        });

        // Enfileira handoff para o bot do vendedor
        await handoffs.enqueue(send);

        // Processa auto-handoff caso a configuração do vendedor esteja ligada
        await handoffs.processDue();

        return { handled: true, action: 'confirmed', lead_id: send.lead_id, seller_id: send.seller_id };
    } else if (match(text, NO)) {
        await addOptOut(send, phone, 'Oferta recusada');
        botEvents.log(botNumber, 'declined', `Lead ${send.lead_name || phone} recusou a simulação`, 'Descartável');
        return { handled: true, action: 'declined' };
    }

    return { handled: false };
}

function register() {
    whatsapp.onMessage(handleIncoming);
}

module.exports = { register, match, handleIncoming };
