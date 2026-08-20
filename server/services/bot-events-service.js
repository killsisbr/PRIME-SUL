const db = require('../database/db');

const MAX_KEPT = 5000; // mantém no máximo esse total de eventos por bot
const PRUNE_CHANCE = 0.02;

async function log(number, type, detail, label) {
    try {
        await db.run(
            'INSERT INTO bot_events (number, type, detail, label) VALUES (?, ?, ?, ?)',
            [number, type, detail || '', label || null]
        );
        if (Math.random() < PRUNE_CHANCE) await prune();
    } catch (e) {
        console.error('[bot-events] falha ao registrar evento:', e.message);
    }
}

// Limita o histórico por número (evita crescer sem controle)
async function prune() {
    await db.run(`
        DELETE FROM bot_events
        WHERE id IN (
            SELECT id FROM bot_events
            WHERE id NOT IN (
                SELECT id FROM bot_events
                ORDER BY id DESC
                LIMIT ?
            )
        )
    `, [MAX_KEPT]);
}

// numbers: null = sem restrição (admin); array = restringe aos números informados
// (vendedor só vê a timeline dos próprios bots). Array vazio = nenhum resultado.
async function list({ number, type, since, limit = 200, numbers = null }) {
    const clauses = [];
    const params = [];
    if (numbers) {
        if (!numbers.length) return [];
        clauses.push(`number IN (${numbers.map(() => '?').join(',')})`);
        params.push(...numbers);
    }
    if (number) { clauses.push('number = ?'); params.push(number); }
    if (type) { clauses.push('type = ?'); params.push(type); }
    if (since) { clauses.push('created_at >= ?'); params.push(since); }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    const rows = await db.all(
        `SELECT * FROM bot_events ${where} ORDER BY created_at DESC, id DESC LIMIT ?`,
        [...params, limit]
    );
    return rows;
}

async function totals({ numbers = null } = {}) {
    if (numbers && !numbers.length) return { total: 0, sent: 0, failed: 0, banned: 0, cooldowns: 0 };
    const where = numbers ? `WHERE number IN (${numbers.map(() => '?').join(',')})` : '';
    const row = await db.get(`
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN type = 'send_ok' THEN 1 ELSE 0 END) AS sent,
            SUM(CASE WHEN type = 'send_fail' THEN 1 ELSE 0 END) AS failed,
            SUM(CASE WHEN type = 'banned' THEN 1 ELSE 0 END) AS banned,
            SUM(CASE WHEN type = 'cooldown' THEN 1 ELSE 0 END) AS cooldowns
        FROM bot_events ${where}
    `, numbers || []);
    return {
        total: row.total || 0,
        sent: row.sent || 0,
        failed: row.failed || 0,
        banned: row.banned || 0,
        cooldowns: row.cooldowns || 0
    };
}

module.exports = { log, list, prune, totals };