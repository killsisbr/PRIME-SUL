const db = require('../database/db');

// Configuração por estágio/coluna: auto-disparo, auto-score, etc.
async function getMap() {
    const rows = await db.all('SELECT status, config, updated_at FROM stage_config');
    const map = {};
    for (const r of rows) {
        let cfg = {};
        try { cfg = JSON.parse(r.config || '{}'); } catch (e) { /* ignore */ }
        map[r.status] = cfg;
    }
    return map;
}

async function get(status) {
    const row = await db.get('SELECT config FROM stage_config WHERE status = ?', [status]);
    if (!row) return {};
    try { return JSON.parse(row.config || '{}'); } catch (e) { return {}; }
}

async function save(status, config) {
    await db.run(
        `INSERT INTO stage_config (status, config, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(status) DO UPDATE SET config = excluded.config, updated_at = datetime('now')`,
        [status, JSON.stringify(config || {})]
    );
    return { status, config: config || {} };
}

module.exports = { getMap, get, save };
