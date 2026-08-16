const db = require('../database/db');

async function get() {
    const rows = await db.all('SELECT key, value FROM settings');
    const obj = {};
    rows.forEach(r => { obj[r.key] = r.value; });
    return obj;
}

async function getNumber(key, fallback) {
    const s = await get();
    const v = Number(s[key]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
}

module.exports = { get, getNumber };
