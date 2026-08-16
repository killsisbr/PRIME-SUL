const db = require('../database/db');
const settings = require('./settings-service');

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
    const rows = await db.all(
        "SELECT * FROM bot_numbers WHERE status = 'resfriado' AND cooled_until IS NOT NULL AND cooled_until <= ?",
        [isoNow()]
    );
    for (const n of rows) {
        await db.run("UPDATE bot_numbers SET status = 'ativo', messages_sent = 0, cooled_until = NULL WHERE id = ?", [n.id]);
        console.log(`[anti-ban] Número ${n.number} reativado automaticamente após cooldown`);
    }
    return rows.length;
}

async function registerNumber(number, label) {
    await ensureFresh();
    await db.run('INSERT OR IGNORE INTO bot_numbers (number, label) VALUES (?, ?)', [number, label || 'descartável']);
    return db.get('SELECT * FROM bot_numbers WHERE number = ?', [number]);
}

async function pickBestNumber() {
    await ensureFresh();
    const limit = await currentLimit();
    return db.get(`
        SELECT * FROM bot_numbers
        WHERE status = 'ativo'
          AND messages_sent < ?
        ORDER BY messages_sent ASC, id ASC
        LIMIT 1
    `, [limit]);
}

async function markSent(number_id) {
    await db.run('UPDATE bot_numbers SET messages_sent = messages_sent + 1 WHERE id = ?', [number_id]);
    const n = await db.get('SELECT * FROM bot_numbers WHERE id = ?', [number_id]);
    const limit = await currentLimit();
    if (n.messages_sent >= limit) {
        const cooldownHours = await currentCooldownHours();
        const until = new Date(Date.now() + cooldownHours * 3600 * 1000).toISOString();
        await db.run(
            "UPDATE bot_numbers SET status = 'resfriado', cooled_until = ? WHERE id = ?",
            [until, number_id]
        );
        console.log(`[anti-ban] Número ${n.number} atingiu ${limit} msgs — resfriado até ${until}`);
    }
    return n;
}

async function markBanned(number_id) {
    await db.run("UPDATE bot_numbers SET status = 'banido', cooled_until = NULL WHERE id = ?", [number_id]);
}

async function setStatus(number_id, status) {
    if (status === 'ativo') {
        await db.run(
            "UPDATE bot_numbers SET status = 'ativo', messages_sent = 0, cooled_until = NULL WHERE id = ?",
            [number_id]
        );
    } else if (status === 'resfriado') {
        const cooldownHours = await currentCooldownHours();
        const until = new Date(Date.now() + cooldownHours * 3600 * 1000).toISOString();
        await db.run("UPDATE bot_numbers SET status = 'resfriado', cooled_until = ? WHERE id = ?", [until, number_id]);
    } else {
        await db.run('UPDATE bot_numbers SET status = ?, cooled_until = NULL WHERE id = ?', [status, number_id]);
    }
    return db.get('SELECT * FROM bot_numbers WHERE id = ?', [number_id]);
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
    currentCooldownHours,
    DEFAULT_LIMIT,
    DEFAULT_COOLDOWN_HOURS
};
