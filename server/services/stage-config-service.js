const db = require('../database/db');

function parse(value) {
    try { return JSON.parse(value || '{}'); } catch { return {}; }
}

async function getMap(sellerId, organizationId = 1) {
    const globalRows = await db.all('SELECT status, config FROM stage_config');
    const ownRows = sellerId ? await db.all(
        'SELECT status, config FROM seller_stage_config WHERE seller_id=? AND organization_id=?',
        [sellerId, organizationId]
    ) : [];
    const map = {};
    for (const row of globalRows) map[row.status] = parse(row.config);
    for (const row of ownRows) map[row.status] = { ...(map[row.status] || {}), ...parse(row.config), scope: 'seller' };
    return map;
}

async function get(status, sellerId, organizationId = 1) {
    if (sellerId) {
        const own = await db.get('SELECT config FROM seller_stage_config WHERE status=? AND seller_id=? AND organization_id=?',
            [status, sellerId, organizationId]);
        if (own) return parse(own.config);
    }
    const global = await db.get('SELECT config FROM stage_config WHERE status=?', [status]);
    return global ? parse(global.config) : {};
}

async function saveForSeller(status, config, sellerId, organizationId = 1) {
    const clean = {
        auto_send: config.auto_send === true,
        message: String(config.message || '').trim().slice(0, 4000),
        number_id: Number(config.number_id) || null
    };
    if (clean.auto_send && !['novos', 'enviados'].includes(status)) {
        const e = new Error('Auto-disparo permitido somente nas etapas Novos ou Enviados'); e.status = 400; throw e;
    }
    if (clean.auto_send && !clean.message) { const e = new Error('Mensagem obrigatória para ativar o auto-disparo'); e.status = 400; throw e; }
    if (clean.number_id) {
        const number = await db.get(`SELECT id FROM bot_numbers WHERE id=? AND organization_id=?
            AND (seller_id IS NULL OR seller_id=?) AND status='ativo'`, [clean.number_id, organizationId, sellerId]);
        if (!number) { const e = new Error('Número não disponível para este operador'); e.status = 403; throw e; }
    }
    await db.run(`INSERT INTO seller_stage_config (organization_id,seller_id,status,config,updated_at)
        VALUES (?,?,?,?,datetime('now')) ON CONFLICT(seller_id,status)
        DO UPDATE SET config=excluded.config,updated_at=datetime('now')`,
        [organizationId, sellerId, status, JSON.stringify(clean)]);
    return { status, config: clean, scope: 'seller' };
}

module.exports = { getMap, get, saveForSeller };
