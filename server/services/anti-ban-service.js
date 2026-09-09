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

// Cria (se ainda não existir) o número interno de um slot fixo — sem exigir
// que o admin/vendedor digite um telefone real antecipadamente. O telefone de
// fato conectado só é descoberto depois do scan do QR (ver whatsapp-service).
async function registerSlot(organizationId, sellerId, slotIndex, label) {
    const number = `slot-${organizationId}-${sellerId || 'org'}-${slotIndex}`;
    await ensureFresh();
    await db.run(
        'INSERT OR IGNORE INTO bot_numbers (organization_id, seller_id, number, label, slot_index) VALUES (?, ?, ?, ?, ?)',
        [organizationId, sellerId, number, label || `WhatsApp ${slotIndex}`, slotIndex]
    );
    return db.get('SELECT * FROM bot_numbers WHERE organization_id = ? AND number = ?', [organizationId, number]);
}

async function isDisposableMode() {
    const row = await db.get("SELECT value FROM settings WHERE key = 'cfg_disposable_bots_mode'");
    return row ? row.value !== 'false' : true;
}

async function pickBestNumber(organizationId = 1, sellerId = null) {
    await ensureFresh();
    const limit = await currentLimit();
    const disposable = await isDisposableMode();
    const orderClause = disposable
        ? '(CASE WHEN seller_id IS NULL THEN 0 ELSE 1 END), messages_sent ASC, id ASC'
        : (sellerId ? '(CASE WHEN seller_id = ? THEN 0 ELSE 1 END), messages_sent ASC, id ASC' : 'messages_sent ASC, id ASC');
    const orderParams = (!disposable && sellerId) ? [sellerId] : [];

    return db.get(`
        SELECT * FROM bot_numbers
        WHERE organization_id = ? AND status = 'ativo'
          AND (seller_id IS NULL OR seller_id = ?)
          AND messages_sent < COALESCE(daily_limit_override, ?)
        ORDER BY ${orderClause}
        LIMIT 1
    `, [organizationId, sellerId, limit, ...orderParams]);
}

// Escolhe o número menos usado e já incrementa o contador no mesmo UPDATE
// (via subquery), respeitando o modo descartável vs direto
async function reserveNumber(organizationId = 1, sellerId = null) {
    await ensureFresh();
    const limit = await currentLimit();
    const disposable = await isDisposableMode();
    const orderClause = disposable
        ? '(CASE WHEN seller_id IS NULL THEN 0 ELSE 1 END), messages_sent ASC, id ASC'
        : (sellerId ? '(CASE WHEN seller_id = ? THEN 0 ELSE 1 END), messages_sent ASC, id ASC' : 'messages_sent ASC, id ASC');
    const orderParams = (!disposable && sellerId) ? [sellerId] : [];

    const n = await db.get(`
        UPDATE bot_numbers
        SET messages_sent = messages_sent + 1, messages_reset_at = date('now')
        WHERE id = (
            SELECT id FROM bot_numbers
            WHERE organization_id = ? AND status = 'ativo'
              AND (seller_id IS NULL OR seller_id = ?)
              AND messages_sent < COALESCE(daily_limit_override, ?)
            ORDER BY ${orderClause}
            LIMIT 1
        )
        RETURNING *
    `, [organizationId, sellerId, limit, ...orderParams]);
    if (!n) return null;

    const effectiveLimit = n.daily_limit_override ?? limit;
    if (n.messages_sent >= effectiveLimit) {
        const cooldownHours = await currentCooldownHours();
        const until = new Date(Date.now() + cooldownHours * 3600 * 1000).toISOString();
        await db.run("UPDATE bot_numbers SET status = 'resfriado', cooled_until = ? WHERE id = ?", [until, n.id]);
        botEvents.log(n.number, 'cooldown', `Atingiu ${effectiveLimit} mensagens — resfriado até ${until}`, n.label);
        console.log(`[anti-ban] Número ${n.number} atingiu ${effectiveLimit} msgs — resfriado até ${until}`);
        n.status = 'resfriado';
        n.cooled_until = until;
    }
    return n;
}

// Define (ou remove, com null) o limite diário próprio deste número — sobrepõe
// o global (cfg_daily_limit) enquanto estiver definido.
async function setDailyLimitOverride(number_id, organizationId, value) {
    const limit = value === null || value === '' ? null : Math.max(1, Math.floor(Number(value)) || 1);
    await db.run(
        'UPDATE bot_numbers SET daily_limit_override = ? WHERE id = ? AND organization_id = ?',
        [limit, number_id, organizationId]
    );
    const n = await db.get('SELECT * FROM bot_numbers WHERE id = ? AND organization_id = ?', [number_id, organizationId]);
    if (n) botEvents.log(n.number, 'limit_override', limit ? `Limite diário próprio ajustado para ${limit}` : 'Limite diário próprio removido — voltou a usar o global', n.label);
    return n;
}

// Devolve a reserva quando o envio não se concretiza de fato (bot offline,
// erro de rede etc.) — sem isso, tentativas falhas consumiriam cota do
// número à toa.
async function releaseNumber(number_id) {
    await db.run(
        "UPDATE bot_numbers SET messages_sent = MAX(messages_sent - 1, 0) WHERE id = ?",
        [number_id]
    );
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

// Mantido em sync com campaign-service.js#TARGETABLE_STATUSES
async function shouldSend(lead) {
    return ['novos', 'enviados', 'sim'].includes(lead.status);
}

module.exports = {
    registerNumber,
    registerSlot,
    pickBestNumber,
    reserveNumber,
    releaseNumber,
    markBanned,
    setStatus,
    setDailyLimitOverride,
    shouldSend,
    ensureFresh,
    currentLimit,
    currentCooldownHours
};
