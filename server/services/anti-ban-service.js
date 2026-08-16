const db = require('../database/db');

// Limites diários por número (anti-ban)
const DAILY_LIMIT = 40;        // mensagens por número/dia
const COOLDOWN_MS = 6 * 3600 * 1000; // resfriamento após atingir limite

function now() { return Date.now(); }

async function registerNumber(number, label) {
    await db.run('INSERT OR IGNORE INTO bot_numbers (number, label) VALUES (?, ?)', [number, label || 'descartável']);
    return db.get('SELECT * FROM bot_numbers WHERE number = ?', [number]);
}

async function pickBestNumber() {
    return db.get(`
        SELECT * FROM bot_numbers
        WHERE status = 'ativo'
          AND messages_sent < ?
        ORDER BY messages_sent ASC, id ASC
        LIMIT 1
    `, [DAILY_LIMIT]);
}

async function markSent(number_id) {
    await db.run('UPDATE bot_numbers SET messages_sent = messages_sent + 1 WHERE id = ?', [number_id]);
    const n = await db.get('SELECT * FROM bot_numbers WHERE id = ?', [number_id]);
    if (n.messages_sent >= DAILY_LIMIT) {
        await db.run("UPDATE bot_numbers SET status = 'resfriado' WHERE id = ?", [number_id]);
        console.log(`[anti-ban] Número ${n.number} atingiu ${DAILY_LIMIT} msgs — resfriando por ${COOLDOWN_MS / 3600000}h`);
        setTimeout(() => resetNumber(n.id), COOLDOWN_MS);
    }
    return n;
}

async function resetNumber(number_id) {
    await db.run("UPDATE bot_numbers SET status = 'ativo', messages_sent = 0 WHERE id = ?", [number_id]);
    console.log('[anti-ban] Número reativado após cooldown:', number_id);
}

async function markBanned(number_id) {
    await db.run("UPDATE bot_numbers SET status = 'banido' WHERE id = ?", [number_id]);
}

async function shouldSend(lead) {
    // Não envia para lead bloqueado/duplicado
    return ['novo', 'contato'].includes(lead.status);
}

module.exports = {
    registerNumber,
    pickBestNumber,
    markSent,
    markBanned,
    shouldSend,
    DAILY_LIMIT
};