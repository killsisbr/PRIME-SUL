const db = require('../database/db');
const whatsapp = require('./whatsapp-service');
const handoffs = require('./handoff-service');
const ws = require('./websocket-service');

const YES = (process.env.BOT_CONFIRM_KEYWORDS || 'sim,ok,confirmo,quero,claro,pode,pode sim').split(',').map(s => s.trim()).filter(Boolean);
const NO = (process.env.BOT_DENY_KEYWORDS || 'nao,não,dispenso,obrigado').split(',').map(s => s.trim()).filter(Boolean);
const STOP = (process.env.BOT_OPTOUT_KEYWORDS || 'pare,parar,sair,cancelar,remover,nao quero,não quero').split(',').map(s => s.trim()).filter(Boolean);

function normalizeText(t = '') { return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function match(text, list) {
    const t = normalizeText(text);
    return list.some(k => {
        const nk = normalizeText(k);
        return t === nk || t.startsWith(nk + ' ') || t.endsWith(' ' + nk);
    });
}

async function addOptOut(send, phone, reason) {
    await db.run('INSERT OR IGNORE INTO opt_outs (organization_id,phone,reason) VALUES (?,?,?)', [send.organization_id || 1, phone, reason]);
    await db.run("UPDATE leads SET status='nao', updated_at=datetime('now') WHERE id=?", [send.lead_id]);
    ws.broadcast(send.organization_id || 1, { type: 'LEAD_UPDATE', lead_id: send.lead_id, status: 'nao' });
    await db.run("UPDATE sends SET status='recusado', replied_at=datetime('now') WHERE id=? AND status='sent'", [send.id]);
    await db.run("UPDATE followups SET status='cancelled' WHERE lead_id=? AND status='scheduled'", [send.lead_id]);
}

async function handleIncoming({ botNumber, phone, text }) {
        if (await handoffs.markReplied(botNumber, phone)) return;
        const send = await db.get(`SELECT s.*, l.seller_id, l.organization_id
            FROM sends s JOIN leads l ON l.id=s.lead_id JOIN bot_numbers bn ON bn.id=s.number_id
            WHERE l.phone=? AND bn.number=? AND s.status='sent' ORDER BY s.id DESC LIMIT 1`, [phone, botNumber]);
        if (!send) return { handled: false };

        if (match(text, STOP)) { await addOptOut(send, phone, 'Solicitado pelo contato'); return { handled: true, action: 'opt_out' }; }
        if (match(text, YES)) {
            const changed = await db.run("UPDATE sends SET status='confirmado', replied_at=datetime('now') WHERE id=? AND status='sent'", [send.id]);
            if (!changed.changes) return { handled: true, action: 'already_processed' };
            await db.run("UPDATE leads SET status='sim', updated_at=datetime('now') WHERE id=?", [send.lead_id]);
            ws.broadcast(send.organization_id || 1, { type: 'LEAD_UPDATE', lead_id: send.lead_id, status: 'sim' });
            if (send.campaign_id) await db.run('UPDATE campaigns SET total_yes=total_yes+1 WHERE id=?', [send.campaign_id]);
            await handoffs.enqueue(send);
            await handoffs.processDue();
            return { handled: true, action: 'confirmed' };
        } else if (match(text, NO)) {
            await addOptOut(send, phone, 'Oferta recusada');
            return { handled: true, action: 'declined' };
        }
        return { handled: false };
}

function register() {
    whatsapp.onMessage(handleIncoming);
}

module.exports = { register, match, handleIncoming };
