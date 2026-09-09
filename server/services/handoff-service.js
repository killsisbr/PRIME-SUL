const db = require('../database/db');
const whatsapp = require('./whatsapp-service');
const ws = require('./websocket-service');
const botEvents = require('./bot-events-service');

const DEFAULT_MESSAGE = 'Olá {nome}! Sou {vendedor} da Prime Sul. Recebemos seu interesse na simulação de crédito e já estou com sua proposta pronta. Podemos falar agora?';
let busy = false;

// Verifica se o auto-disparo do vendedor está ativo para este vendedor ou organização
async function isAutoHandoffEnabled(sellerId, organizationId = 1) {
    const key = `cfg_auto_handoff_seller_${sellerId}`;
    const row = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
    if (row) return row.value === 'true';
    const globalRow = await db.get('SELECT value FROM settings WHERE key = ?', ['cfg_auto_handoff_global']);
    return globalRow ? globalRow.value === 'true' : true; // padrão ativo para agilidade
}

async function setAutoHandoff(sellerId, organizationId, enabled) {
    const key = `cfg_auto_handoff_seller_${sellerId}`;
    const val = enabled ? 'true' : 'false';
    await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, val]);
    return { seller_id: sellerId, auto_handoff: !!enabled };
}

async function enqueue(send) {
    await db.run(`INSERT OR IGNORE INTO handoffs
        (organization_id, lead_id, seller_id, send_id, status, run_after)
        VALUES (?, ?, ?, ?, 'pending', datetime('now'))`,
        [send.organization_id || 1, send.lead_id, send.seller_id, send.id]);
    
    const h = await db.get('SELECT * FROM handoffs WHERE send_id = ?', [send.id]);
    
    // Notifica vendedor em tempo real
    ws.broadcast(send.organization_id || 1, {
        type: 'HANDOFF_NEW',
        handoff_id: h ? h.id : null,
        lead_id: send.lead_id,
        seller_id: send.seller_id
    });

    return h;
}

async function pickSellerNumber(handoff, preferredId = null) {
    if (preferredId) {
        const specific = await db.get(`SELECT * FROM seller_numbers
            WHERE id = ? AND seller_id = ? AND organization_id = ? AND active = 1`,
            [preferredId, handoff.seller_id, handoff.organization_id]);
        if (specific) return specific;
    }
    return db.get(`SELECT * FROM seller_numbers
        WHERE seller_id = ? AND organization_id = ? AND active = 1
        ORDER BY id ASC LIMIT 1`, [handoff.seller_id, handoff.organization_id]);
}

async function buildWelcomeMessage(lead, sellerId) {
    const seller = await db.get('SELECT name FROM sellers WHERE id = ?', [sellerId]);
    const sellerName = seller ? seller.name.split(' ')[0] : 'nossa equipe';
    const tmpl = process.env.BOT_SELLER_WELCOME || DEFAULT_MESSAGE;
    return tmpl
        .replace(/\{nome\}/g, (lead.name || 'Cliente').split(' ')[0])
        .replace(/\{vendedor\}/g, sellerName);
}

// Disparo manual/sob demanda realizado pelo vendedor a partir do card do lead
async function sendSellerHandoffNow(leadId, sellerId, customMessage = null, preferredNumberId = null) {
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
    if (!lead) {
        const e = new Error('Lead não encontrado');
        e.status = 404;
        throw e;
    }

    let handoff = await db.get('SELECT * FROM handoffs WHERE lead_id = ? ORDER BY id DESC LIMIT 1', [leadId]);
    if (!handoff) {
        const result = await db.run(`INSERT INTO handoffs (organization_id, lead_id, seller_id, status, run_after)
            VALUES (?, ?, ?, 'pending', datetime('now'))`, [lead.organization_id || 1, lead.id, sellerId]);
        handoff = await db.get('SELECT * FROM handoffs WHERE id = ?', [result.lastID]);
    }

    const number = await pickSellerNumber(handoff, preferredNumberId);
    if (!number) {
        const e = new Error('Nenhum número de WhatsApp ativo configurado para este vendedor. Cadastre um número operacional em "Meu WhatsApp".');
        e.status = 400;
        throw e;
    }

    await whatsapp.connect(number.number, `vendedor-${sellerId}`);

    const message = customMessage || await buildWelcomeMessage(lead, sellerId);
    const sendResult = await whatsapp.sendMessage(number.number, lead.phone, message, {
        organizationId: lead.organization_id || 1,
        sellerId: sellerId,
        skipCooldown: true
    });

    if (!sendResult.sent) {
        await db.run('UPDATE handoffs SET status = "failed", error = ?, updated_at = datetime("now") WHERE id = ?',
            [sendResult.reason || 'Falha no envio', handoff.id]);
        const e = new Error(`Falha ao disparar pelo número ${number.number}: ${sendResult.reason || 'erro desconhecido'}`);
        e.status = 502;
        throw e;
    }

    await db.run(`UPDATE handoffs
        SET status = 'sent', seller_number_id = ?, error = NULL, sent_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?`, [number.id, handoff.id]);

    await whatsapp.archiveChat(number.number, lead.phone).catch(() => {});
    botEvents.log(number.number, 'seller_send_ok', `Vendedor contatou lead ${lead.name} (${lead.phone})`, number.label || 'Vendedor');

    const updatedHandoff = await db.get('SELECT * FROM handoffs WHERE id = ?', [handoff.id]);
    
    // Notifica atualização em tempo real
    ws.broadcast(lead.organization_id || 1, {
        type: 'HANDOFF_UPDATE',
        handoff_id: handoff.id,
        lead_id: lead.id,
        seller_id: sellerId,
        status: 'sent'
    });

    return {
        success: true,
        handoff: updatedHandoff,
        sent_from: number.number,
        message
    };
}

async function processDue() {
    if (!whatsapp.enabled()) return { processed: 0, disabled: true };
    if (busy) return { processed: 0 };
    busy = true;
    try {
        const rows = await db.all(`SELECT h.*, l.name, l.phone, l.organization_id AS lead_org
            FROM handoffs h JOIN leads l ON l.id=h.lead_id
            WHERE h.status IN ('pending','sending')
              AND (h.run_after IS NULL OR h.run_after <= datetime('now'))
            ORDER BY h.id LIMIT 10`);
        let processed = 0;
        for (const h of rows) {
            // Verifica se o auto-disparo está ligado para o vendedor
            const autoEnabled = await isAutoHandoffEnabled(h.seller_id, h.organization_id);
            if (!autoEnabled) {
                // Fica em pending aguardando ação manual do vendedor no card do funil
                continue;
            }

            const number = await pickSellerNumber(h);
            if (!number) {
                await db.run(`UPDATE handoffs SET status='failed', error='Nenhum número ativo do vendedor', updated_at=datetime('now') WHERE id=?`, [h.id]);
                continue;
            }
            const attempt = h.attempts + 1;
            await db.run(`UPDATE handoffs SET status='sending', seller_number_id=?, attempts=?, updated_at=datetime('now') WHERE id=?`, [number.id, attempt, h.id]);
            await whatsapp.connect(number.number, `vendedor-${h.seller_id}`);
            const message = await buildWelcomeMessage({ name: h.name }, h.seller_id);
            const result = await whatsapp.sendMessage(number.number, h.phone, message, {
                organizationId: h.organization_id,
                sellerId: h.seller_id,
                skipCooldown: true
            });
            if (result.sent) {
                await db.run(`UPDATE handoffs SET status='sent', error=NULL, sent_at=datetime('now'), updated_at=datetime('now') WHERE id=?`, [h.id]);
                await whatsapp.archiveChat(number.number, h.phone).catch(() => {});
                ws.broadcast(h.organization_id || 1, {
                    type: 'HANDOFF_UPDATE',
                    handoff_id: h.id,
                    lead_id: h.lead_id,
                    seller_id: h.seller_id,
                    status: 'sent'
                });
                botEvents.log(number.number, 'auto_handoff_ok', `Auto-handoff: ${h.name} (${h.phone})`, number.label);
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

module.exports = { enqueue, processDue, markReplied, isAutoHandoffEnabled, setAutoHandoff, sendSellerHandoffNow };
