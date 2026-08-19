const db = require('../database/db');
const whatsapp = require('./whatsapp-service');

const DEFAULT_MESSAGE = 'Olá {nome}! Sou da equipe Prime Sul. Recebemos sua confirmação e vou continuar sua simulação de crédito por aqui.';
let busy = false;

async function enqueue(send) {
    await db.run(`INSERT OR IGNORE INTO handoffs
        (organization_id, lead_id, seller_id, send_id, status, run_after)
        VALUES (?, ?, ?, ?, 'pending', datetime('now'))`,
        [send.organization_id || 1, send.lead_id, send.seller_id, send.id]);
    return db.get('SELECT * FROM handoffs WHERE send_id = ?', [send.id]);
}

async function pickSellerNumber(handoff) {
    return db.get(`SELECT * FROM seller_numbers
        WHERE seller_id = ? AND organization_id = ? AND active = 1
        ORDER BY id ASC LIMIT 1`, [handoff.seller_id, handoff.organization_id]);
}

async function processDue() {
    if (!whatsapp.enabled()) return { processed: 0, disabled: true };
    if (busy) return { processed: 0 };
    busy = true;
    try {
        const rows = await db.all(`SELECT h.*, l.name, l.phone
            FROM handoffs h JOIN leads l ON l.id=h.lead_id
            WHERE h.status IN ('pending','sending')
              AND (h.run_after IS NULL OR h.run_after <= datetime('now'))
            ORDER BY h.id LIMIT 10`);
        let processed = 0;
        for (const h of rows) {
            const number = await pickSellerNumber(h);
            if (!number) {
                await db.run(`UPDATE handoffs SET status='failed', error='Nenhum número ativo do vendedor', updated_at=datetime('now') WHERE id=?`, [h.id]);
                continue;
            }
            const attempt = h.attempts + 1;
            await db.run(`UPDATE handoffs SET status='sending', seller_number_id=?, attempts=?, updated_at=datetime('now') WHERE id=?`, [number.id, attempt, h.id]);
            await whatsapp.connect(number.number, `vendedor-${h.seller_id}`);
            const message = (process.env.BOT_SELLER_WELCOME || DEFAULT_MESSAGE).replace(/\{nome\}/g, (h.name || 'Cliente').split(' ')[0]);
            const result = await whatsapp.sendMessage(number.number, h.phone, message);
            if (result.sent) {
                await db.run(`UPDATE handoffs SET status='sent', error=NULL, sent_at=datetime('now'), updated_at=datetime('now') WHERE id=?`, [h.id]);
                await whatsapp.archiveChat(number.number, h.phone).catch(() => {});
                processed++;
            } else if (attempt >= h.max_attempts) {
                await db.run(`UPDATE handoffs SET status='failed', error=?, updated_at=datetime('now') WHERE id=?`, [result.reason || 'Falha no envio', h.id]);
            } else {
                const delayMinutes = Math.min(attempt * 2, 15);
                await db.run(`UPDATE handoffs SET status='pending', error=?, run_after=datetime('now','+' || ? || ' minutes'), updated_at=datetime('now') WHERE id=?`,
                    [result.reason || 'Falha temporária', delayMinutes, h.id]);
            }
        }
        return { processed };
    } finally { busy = false; }
}

async function markReplied(botNumber, phone) {
    const row = await db.get(`SELECT h.id FROM handoffs h
        JOIN seller_numbers sn ON sn.id=h.seller_number_id JOIN leads l ON l.id=h.lead_id
        WHERE sn.number=? AND l.phone=? AND h.status='sent' ORDER BY h.id DESC LIMIT 1`, [botNumber, phone]);
    if (!row) return false;
    await db.run(`UPDATE handoffs SET status='replied', replied_at=datetime('now'), updated_at=datetime('now') WHERE id=?`, [row.id]);
    await whatsapp.unarchiveChat(botNumber, phone).catch(() => {});
    return true;
}

module.exports = { enqueue, processDue, markReplied };
