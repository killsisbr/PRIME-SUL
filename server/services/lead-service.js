const db = require('../database/db');
const { normalizePhone } = require('../utils/phone');

const ALLOWED_ORIGEM = ['SITE', 'SIMULACAO', 'INDICACAO'];
const ALLOWED_PRIORIDADE = ['alta', 'media', 'baixa'];
const EDITABLE_FIELDS = ['name', 'phone', 'city', 'origem', 'limite_est', 'renda', 'valor_desejado', 'obs', 'prioridade'];

async function createLead({ seller_id, name, phone, city, origem = 'SITE', limite_est, renda, valor_desejado, obs, prioridade = 'media' }) {
    const normalized = normalizePhone(phone);
    if (!normalized) {
        const e = new Error('Telefone inválido');
        e.status = 400;
        throw e;
    }
    if (!ALLOWED_PRIORIDADE.includes(prioridade)) {
        const e = new Error('Prioridade inválida');
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
        `INSERT INTO leads (seller_id, name, phone, city, origem, limite_est, renda, valor_desejado, obs, prioridade)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [seller_id, name.trim(), normalized, city || null, origem.toUpperCase(), limite_est || null,
         renda || null, valor_desejado || null, obs || null, prioridade]
    );
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', [result.lastID]);
    await db.run(
        'INSERT INTO lead_history (lead_id, seller_id, from_status, to_status) VALUES (?, ?, NULL, ?)',
        [result.lastID, seller_id, lead.status]
    );
    return { lead, duplicated: false, already_mine: false };
}

async function listLeads({ seller_id, status, search, origem, prioridade, cidade, data_de, data_ate }) {
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
    if (origem) {
        sql += ' AND l.origem = ?';
        params.push(origem.toUpperCase());
    }
    if (prioridade) {
        sql += ' AND l.prioridade = ?';
        params.push(prioridade.toLowerCase());
    }
    if (cidade) {
        sql += ' AND l.city LIKE ?';
        params.push(`%${cidade}%`);
    }
    if (data_de) {
        sql += ' AND date(l.created_at) >= date(?)';
        params.push(data_de);
    }
    if (data_ate) {
        sql += ' AND date(l.created_at) <= date(?)';
        params.push(data_ate);
    }
    if (search) {
        sql += ' AND (l.name LIKE ? OR l.phone LIKE ? OR l.city LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY l.updated_at DESC';
    return db.all(sql, params);
}

async function getLead(id, seller_id) {
    return db.get('SELECT * FROM leads WHERE id = ? AND seller_id = ?', [id, seller_id]);
}

async function updateLead(id, seller_id, fields) {
    const lead = await getLead(id, seller_id);
    if (!lead) return null;

    if (fields.origem !== undefined && !ALLOWED_ORIGEM.includes(String(fields.origem).toUpperCase())) {
        const e = new Error('Origem inválida');
        e.status = 400;
        throw e;
    }
    if (fields.prioridade !== undefined && !ALLOWED_PRIORIDADE.includes(String(fields.prioridade).toLowerCase())) {
        const e = new Error('Prioridade inválida');
        e.status = 400;
        throw e;
    }

    const updates = [];
    const params = [];
    for (const f of EDITABLE_FIELDS) {
        if (fields[f] === undefined) continue;
        if (f === 'phone') {
            const normalized = normalizePhone(fields[f]);
            if (!normalized) {
                const e = new Error('Telefone inválido');
                e.status = 400;
                throw e;
            }
            if (normalized !== lead.phone) {
                const dup = await db.get('SELECT id FROM leads WHERE phone = ? AND id != ?', [normalized, id]);
                if (dup) {
                    const e = new Error('Telefone já cadastrado em outro lead');
                    e.status = 409;
                    throw e;
                }
            }
            updates.push('phone = ?');
            params.push(normalized);
        } else if (f === 'origem') {
            updates.push('origem = ?');
            params.push(String(fields[f]).toUpperCase());
        } else if (f === 'prioridade') {
            updates.push('prioridade = ?');
            params.push(String(fields[f]).toLowerCase());
        } else if (f === 'city' || f === 'limite_est' || f === 'renda' || f === 'valor_desejado' || f === 'obs') {
            updates.push(`${f} = ?`);
            params.push(fields[f] || null);
        } else {
            updates.push(`${f} = ?`);
            params.push(fields[f]);
        }
    }
    if (!updates.length) return lead;

    updates.push(`updated_at = datetime('now')`);
    params.push(id, seller_id);
    await db.run(`UPDATE leads SET ${updates.join(', ')} WHERE id = ? AND seller_id = ?`, params);
    return getLead(id, seller_id);
}

async function updateStatus(id, seller_id, status) {
    const allowed = ['novo', 'contato', 'confirmado', 'concluido', 'bloqueado', 'duplicado'];
    if (!allowed.includes(status)) {
        const e = new Error('Status inválido');
        e.status = 400;
        throw e;
    }
    const lead = await getLead(id, seller_id);
    if (!lead) return null;
    if (lead.status === status) return lead;

    await db.run(
        'UPDATE leads SET status = ?, updated_at = datetime(\'now\') WHERE id = ? AND seller_id = ?',
        [status, id, seller_id]
    );
    await db.run(
        'INSERT INTO lead_history (lead_id, seller_id, from_status, to_status) VALUES (?, ?, ?, ?)',
        [id, seller_id, lead.status, status]
    );
    return getLead(id, seller_id);
}

async function getHistory(id, seller_id) {
    return db.all(
        'SELECT * FROM lead_history WHERE lead_id = ? AND seller_id = ? ORDER BY id DESC',
        [id, seller_id]
    );
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

async function funnelBySeller(seller_id) {
    const row = await db.get(
        `SELECT
            (SELECT COUNT(*) FROM leads WHERE seller_id = ?) AS total,
            (SELECT COUNT(*) FROM leads WHERE seller_id = ? AND status = 'novo') AS novo,
            (SELECT COUNT(*) FROM leads WHERE seller_id = ? AND status = 'contato') AS contato,
            (SELECT COUNT(*) FROM leads WHERE seller_id = ? AND status = 'confirmado') AS confirmado,
            (SELECT COUNT(*) FROM leads WHERE seller_id = ? AND status = 'concluido') AS concluido,
            (SELECT COUNT(*) FROM leads WHERE seller_id = ? AND status = 'bloqueado') AS bloqueado,
            (SELECT COUNT(*) FROM leads WHERE seller_id = ? AND status = 'duplicado') AS duplicado,
            (SELECT COUNT(*) FROM leads WHERE seller_id = ? AND date(created_at) = date('now')) AS hoje
        `,
        Array(8).fill(seller_id)
    );

    const pipeline = {
        novo: row.novo,
        contato: row.contato,
        confirmado: row.confirmado,
        concluido: row.concluido
    };
    const total = row.novo + row.contato + row.confirmado + row.concluido;

    const rate = (a, b) => (a > 0 ? Math.round((b / a) * 100) : 0);
    const conversoes = {
        novo_contato: rate(pipeline.novo, pipeline.contato),
        contato_confirmado: rate(pipeline.contato, pipeline.confirmado),
        confirmado_concluido: rate(pipeline.confirmado, pipeline.concluido)
    };

    return {
        total,
        hoje: row.hoje,
        descartados: row.bloqueado + row.duplicado,
        stages: pipeline,
        conversoes,
        taxa_global: total ? Math.round((pipeline.concluido / total) * 100) : 0,
        ...await countsBySeller(seller_id)
    };
}

module.exports = { createLead, listLeads, getLead, updateLead, updateStatus, getHistory, countsBySeller, funnelBySeller, ALLOWED_ORIGEM, ALLOWED_PRIORIDADE };
