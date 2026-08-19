const db = require('../database/db');
const settings = require('./settings-service');
const botEvents = require('./bot-events-service');
const { normalizePhone } = require('../utils/phone');

// Limites padrão (sobrescritos pelas settings do painel)
const DEFAULT_LIMIT = 40;                 // mensagens por número/dia
const DEFAULT_COOLDOWN_HOURS = 6;         // resfriamento após atingir limite

async function currentLimit() {
    return settings.getNumber('cfg_daily_limit', DEFAULT_LIMIT);
}

async function currentCooldownHours() {
    return settings.getNumber('cfg_cooldown_hours', DEFAULT_COOLDOWN_HOURS);
}

function isoNow() { return new Date().toISOString(); }

// Reativa números resfriados cujo cooldown já expirou
async function ensureFresh() {
    await db.run(`UPDATE bot_numbers SET messages_sent=0, messages_reset_at=date('now')
        WHERE messages_reset_at IS NULL OR date(messages_reset_at) < date('now')`);
    const rows = await db.all(
        "SELECT * FROM bot_numbers WHERE status = 'resfriado' AND cooled_until IS NOT NULL AND cooled_until <= ?",
        [isoNow()]
    );
    for (const n of rows) {
        await db.run("UPDATE bot_numbers SET status = 'ativo', messages_sent = 0, cooled_until = NULL WHERE id = ?", [n.id]);
        botEvents.log(n.number, 'reactivated', 'Cooldown expirado — número reativado automaticamente', n.label);
        console.log(`[anti-ban] Número ${n.number} reativado automaticamente após cooldown`);
    }
    return rows.length;
}

async function registerNumber(number, label, organizationId = 1, sellerId = null) {
    number = normalizePhone(number);
    if (!number) { const e = new Error('Número inválido'); e.status = 400; throw e; }
    const sellerNumber = await db.get('SELECT id FROM seller_numbers WHERE number=?', [number]);
    if (sellerNumber) { const e = new Error('Número já pertence a um vendedor'); e.status = 409; throw e; }
    await ensureFresh();
    await db.run('INSERT OR IGNORE INTO bot_numbers (organization_id, seller_id, number, label) VALUES (?, ?, ?, ?)', [organizationId, sellerId, number, label || 'triagem']);
    const row = await db.get('SELECT * FROM bot_numbers WHERE organization_id = ? AND number = ?', [organizationId, number]);
    if (row && row.seller_id !== sellerId && sellerId !== null) { const e = new Error('Número pertence a outro operador'); e.status = 403; throw e; }
    return row;
}

async function pickBestNumber(organizationId = 1, sellerId = null) {
    await ensureFresh();
    const limit = await currentLimit();
    return db.get(`
        SELECT * FROM bot_numbers
        WHERE organization_id = ? AND status = 'ativo'
          AND (seller_id IS NULL OR seller_id = ?)
          AND messages_sent < ?
        ORDER BY messages_sent ASC, id ASC
        LIMIT 1
    `, [organizationId, sellerId, limit]);
}

async function markSent(number_id) {
    await db.run("UPDATE bot_numbers SET messages_sent = messages_sent + 1, messages_reset_at=date('now') WHERE id = ?", [number_id]);
    const n = await db.get('SELECT * FROM bot_numbers WHERE id = ?', [number_id]);
    const limit = await currentLimit();
    if (n.messages_sent >= limit) {
        const cooldownHours = await currentCooldownHours();
        const until = new Date(Date.now() + cooldownHours * 3600 * 1000).toISOString();
        await db.run(
            "UPDATE bot_numbers SET status = 'resfriado', cooled_until = ? WHERE id = ?",
            [until, number_id]
        );
        botEvents.log(n.number, 'cooldown', `Atingiu ${limit} mensagens — resfriado até ${until}`, n.label);
        console.log(`[anti-ban] Número ${n.number} atingiu ${limit} msgs — resfriado até ${until}`);
    }
    return n;
}

async function markBanned(number_id) {
    const n = await db.get('SELECT * FROM bot_numbers WHERE id = ?', [number_id]);
    await db.run("UPDATE bot_numbers SET status = 'banido', cooled_until = NULL WHERE id = ?", [number_id]);
    if (n) botEvents.log(n.number, 'banned', 'Retirado de circulação', n.label);
}

async function setStatus(number_id, status, organizationId = 1, sellerId = undefined) {
    const params = [number_id, organizationId];
    let sql = 'SELECT * FROM bot_numbers WHERE id = ? AND organization_id = ?';
    if (sellerId !== undefined) { sql += ' AND seller_id = ?'; params.push(sellerId); }
    const n = await db.get(sql, params);
    if (!n) return null;
    if (status === 'ativo') {
        await db.run(
            "UPDATE bot_numbers SET status = 'ativo', messages_sent = 0, cooled_until = NULL WHERE id = ?",
            [number_id]
        );
        if (n) botEvents.log(n.number, 'reactivated', 'Reativado manualmente', n.label);
    } else if (status === 'resfriado') {
        const cooldownHours = await currentCooldownHours();
        const until = new Date(Date.now() + cooldownHours * 3600 * 1000).toISOString();
        await db.run("UPDATE bot_numbers SET status = 'resfriado', cooled_until = ? WHERE id = ?", [until, number_id]);
        if (n) botEvents.log(n.number, 'cooldown', `Resfriado manualmente até ${until}`, n.label);
    } else {
        await db.run('UPDATE bot_numbers SET status = ?, cooled_until = NULL WHERE id = ?', [status, number_id]);
        if (n && status === 'banido') botEvents.log(n.number, 'banned', 'Banido manualmente', n.label);
    }
    return db.get('SELECT * FROM bot_numbers WHERE id = ? AND organization_id = ?', [number_id, organizationId]);
}

async function shouldSend(lead) {
    return ['novo', 'contato'].includes(lead.status);
}

module.exports = {
    registerNumber,
    pickBestNumber,
    markSent,
    markBanned,
    setStatus,
    shouldSend,
    ensureFresh,
    currentLimit,
    currentCooldownHours
};
