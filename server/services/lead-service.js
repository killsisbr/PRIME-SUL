const db = require('../database/db');
const { normalizePhone } = require('../utils/phone');

const ALLOWED_ORIGEM = ['SITE', 'SIMULACAO', 'INDICACAO'];

async function createLead({ seller_id, name, phone, city, origem = 'SITE', limite_est, obs }) {
    const normalized = normalizePhone(phone);
    if (!normalized) {
        const e = new Error('Telefone inválido');
        e.status = 400;
        throw e;
    }

    const existing = await db.get('SELECT * FROM leads WHERE phone = ?', [normalized]);
    if (existing) {
        if (existing.seller_id !== seller_id) {
            const e = new Error('LEAD_JA_CADASTRADO');
            e.code = 'DUPLICATE_LEAD';
            e.status = 409;
            e.owner_id = existing.seller_id;
            throw e;
        }
        return { lead: existing, duplicated: false, already_mine: true };
    }

    const result = await db.run(
        'INSERT INTO leads (seller_id, name, phone, city, origem, limite_est) VALUES (?, ?, ?, ?, ?, ?)',
        [seller_id, name.trim(), normalized, city || null, origem.toUpperCase(), limite_est || null]
    );
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', [result.lastID]);
    return { lead, duplicated: false, already_mine: false };
}

async function listLeads({ seller_id, status, search }) {
    let sql = `
        SELECT l.*, s.name AS seller_name
        FROM leads l
        JOIN sellers s ON s.id = l.seller_id
        WHERE l.seller_id = ?`;
    const params = [seller_id];
    if (status && status !== 'TODOS') {
        sql += ' AND l.status = ?';
        params.push(status.toLowerCase());
    }
    if (search) {
        sql += ' AND (l.name LIKE ? OR l.phone LIKE ? OR l.city LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY l.created_at DESC';
    return db.all(sql, params);
}

async function getLead(id, seller_id) {
    return db.get('SELECT * FROM leads WHERE id = ? AND seller_id = ?', [id, seller_id]);
}

async function updateStatus(id, seller_id, status) {
    const allowed = ['novo', 'contato', 'confirmado', 'concluido', 'bloqueado', 'duplicado'];
    if (!allowed.includes(status)) {
        const e = new Error('Status inválido');
        e.status = 400;
        throw e;
    }
    await db.run(
        'UPDATE leads SET status = ?, updated_at = datetime(\'now\') WHERE id = ? AND seller_id = ?',
        [status, id, seller_id]
    );
    return getLead(id, seller_id);
}

async function countsBySeller(seller_id) {
    const row = await db.get(
        `SELECT
            (SELECT COUNT(*) FROM leads WHERE seller_id = ?) AS leads,
            (SELECT COUNT(*) FROM sends s JOIN leads l ON l.id = s.lead_id WHERE l.seller_id = ? AND s.status IN ('sent','confirmado')) AS envios,
            (SELECT COUNT(*) FROM sends s JOIN leads l ON l.id = s.lead_id WHERE l.seller_id = ? AND s.status = 'confirmado') AS confirmados
        `,
        [seller_id, seller_id, seller_id]
    );
    return {
        leads: row.leads,
        envios: row.envios,
        conversao: row.envios ? Math.round((row.confirmados / row.envios) * 100) : 0
    };
}

module.exports = { createLead, listLeads, getLead, updateStatus, countsBySeller, ALLOWED_ORIGEM };