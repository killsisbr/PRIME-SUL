const db = require('../database/db');
const { normalizePhone } = require('../utils/phone');
const scoreService = require('./score-service');
const campaignService = require('./campaign-service');
const stageConfig = require('./stage-config-service');

const ALLOWED_ORIGEM = ['SITE', 'SIMULACAO', 'INDICACAO'];
const ALLOWED_PRIORIDADE = ['alta', 'media', 'baixa'];
const EDITABLE_FIELDS = ['name', 'phone', 'phone2', 'phone3', 'cpf', 'tags', 'city', 'origem', 'limite_est', 'renda', 'valor_desejado', 'obs', 'prioridade', 'score'];

// Campos que alteram o score automático
const SCORE_FIELDS = ['renda', 'valor_desejado', 'limite_est', 'origem', 'prioridade', 'city', 'name'];

// Limpa CPF (mantém só dígitos) e normaliza tags (minúsculas, separadas por vírgula)
function cleanCpf(v) {
    const digits = String(v || '').replace(/\D/g, '');
    return digits.length >= 8 ? digits : null;
}
function cleanTags(v) {
    return String(v || '')
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10)
        .join(',');
}

async function triggerStageAutomation(lead, status, sellerId) {
    if (!lead || !['novo', 'contato'].includes(status)) return;
    try {
        const cfg = await stageConfig.get(status, sellerId, lead.organization_id || 1);
        if (cfg.auto_send && cfg.message) {
            const result = await campaignService.sendToLead(lead, cfg.message, sellerId, cfg.number_id ? [cfg.number_id] : []);
            console.log(result.sent ? `[auto-send] Lead #${lead.id} → campanha ${result.campaign_id}` : `[auto-send] Lead #${lead.id} → ${result.reason}`);
        }
    } catch (e) { console.warn(`[auto-send] Lead #${lead.id} — erro:`, e.message); }
}

async function createLead({ seller_id, organization_id = 1, name, phone, phone2, phone3, cpf, tags, city, origem = 'SITE', limite_est, renda, valor_desejado, obs, prioridade = 'media' }) {
    const normalized = normalizePhone(phone);
    if (!normalized) {
        const e = new Error('Telefone principal inválido');
        e.status = 400;
        throw e;
    }
    const normPhone2 = phone2 ? (normalizePhone(phone2) || phone2.trim()) : null;
    const normPhone3 = phone3 ? (normalizePhone(phone3) || phone3.trim()) : null;

    if (!ALLOWED_PRIORIDADE.includes(prioridade)) {
        const e = new Error('Prioridade inválida');
        e.status = 400;
        throw e;
    }
    origem = String(origem || 'SITE').toUpperCase();
    if (!ALLOWED_ORIGEM.includes(origem)) {
        const e = new Error('Origem inválida'); e.status = 400; throw e;
    }
    const cleanCpfValue = cleanCpf(cpf);
    const cleanTagsValue = cleanTags(tags);

    const optedOut = await db.get('SELECT id FROM opt_outs WHERE organization_id = ? AND phone = ?', [organization_id, normalized]);
    if (optedOut) { const e = new Error('Contato bloqueado por opt-out'); e.status = 409; e.code = 'OPTED_OUT'; throw e; }

    const seller = await db.get('SELECT max_leads FROM sellers WHERE id=? AND organization_id=? AND active=1', [seller_id, organization_id]);
    if (!seller) { const e = new Error('Vendedor inválido'); e.status = 403; throw e; }

    async function findByDuplicate() {
        const phoneHit = await db.get('SELECT * FROM leads WHERE organization_id = ? AND phone = ?', [organization_id, normalized]);
        if (phoneHit) return phoneHit;
        if (cleanCpfValue) {
            const cpfHit = await db.get('SELECT * FROM leads WHERE organization_id = ? AND cpf = ?', [organization_id, cleanCpfValue]);
            if (cpfHit) return cpfHit;
        }
        return null;
    }
    const existing = await findByDuplicate();
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
    if (seller.max_leads > 0) {
        const total = await db.get('SELECT COUNT(*) c FROM leads WHERE seller_id=?', [seller_id]);
        if (total.c >= seller.max_leads) { const e = new Error('Limite de leads do vendedor atingido'); e.status = 409; e.code = 'LEAD_LIMIT'; throw e; }
    }

    const score = scoreService.computeScore({
        name: name.trim(), city, origem: origem.toUpperCase(), limite_est,
        renda, valor_desejado, prioridade, status: 'novo'
    });
    const result = await db.run(
        `INSERT INTO leads (organization_id, seller_id, name, phone, phone2, phone3, cpf, tags, city, origem, limite_est, renda, valor_desejado, obs, prioridade, score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [organization_id, seller_id, name.trim(), normalized, normPhone2, normPhone3, cleanCpfValue, cleanTagsValue, city || null, origem, limite_est || null,
         renda || null, valor_desejado || null, obs || null, prioridade, score]
    );
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', [result.lastID]);
    await db.run(
        'INSERT INTO lead_history (lead_id, seller_id, from_status, to_status) VALUES (?, ?, NULL, ?)',
        [result.lastID, seller_id, lead.status]
    );
    await triggerStageAutomation(lead, lead.status, seller_id);
    const ws = require('./websocket-service');
    ws.broadcast('lead:created', lead);
    return { lead, duplicated: false, already_mine: false };
}

async function listLeads({ seller_id, status, search, origem, prioridade, tag, cidade, data_de, data_ate, score_min, score_max }) {
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
    if (tag) {
        sql += " AND (',' || l.tags || ',') LIKE ?";
        params.push(`%,${String(tag).toLowerCase()},%`);
    }
    if (cidade) {
        sql += ' AND l.city LIKE ?';
        params.push(`%${cidade}%`);
    }
    if (score_min !== undefined && score_min !== null && score_min !== '') {
        sql += ' AND l.score >= ?';
        params.push(Number(score_min));
    }
    if (score_max !== undefined && score_max !== null && score_max !== '') {
        sql += ' AND l.score <= ?';
        params.push(Number(score_max));
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
        const s = String(search).trim();
        if (/^\d{8,11}$/.test(s)) {
            sql += ' AND (l.cpf = ? OR l.phone LIKE ? OR l.name LIKE ? OR l.city LIKE ?)';
            params.push(s, `%${s}%`, `%${s}%`, `%${s}%`);
        } else {
            sql += ' AND (l.name LIKE ? OR l.phone LIKE ? OR l.city LIKE ?)';
            params.push(`%${s}%`, `%${s}%`, `%${s}%`);
        }
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

    const manualScore = fields.score !== undefined && fields.score !== null && fields.score !== '';
    if (manualScore) {
        const v = Math.round(Number(fields.score));
        if (!Number.isFinite(v) || v < 0 || v > 100) {
            const e = new Error('Score deve ser um número entre 0 e 100');
            e.status = 400;
            throw e;
        }
    }
    // Recalcula score automaticamente quando campos que influenciam o score mudam
    const recalcScore = !manualScore && SCORE_FIELDS.some(f => fields[f] !== undefined);

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
        } else if (f === 'cpf') {
            const c = cleanCpf(fields[f]);
            if (c && c !== lead.cpf) {
                const dup = await db.get('SELECT id FROM leads WHERE cpf = ? AND id != ? AND organization_id = ?', [c, id, lead.organization_id || 1]);
                if (dup) {
                    const e = new Error('CPF já cadastrado em outro lead');
                    e.status = 409;
                    throw e;
                }
            }
            updates.push('cpf = ?');
            params.push(c);
        } else if (f === 'tags') {
            updates.push('tags = ?');
            params.push(cleanTags(fields[f]));
        } else if (f === 'prioridade') {
            updates.push('prioridade = ?');
            params.push(String(fields[f]).toLowerCase());
        } else if (f === 'score') {
            updates.push('score = ?');
            params.push(Math.round(Number(fields.score)));
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
    const fresh = await getLead(id, seller_id);
    if (recalcScore && fresh) {
        const next = scoreService.computeScore(fresh);
        await db.run('UPDATE leads SET score = ? WHERE id = ?', [next, id]);
        return getLead(id, seller_id);
    }
    return fresh;
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
    if (status === 'bloqueado') {
        await db.run('INSERT OR IGNORE INTO opt_outs (organization_id,phone,reason) VALUES (?,?,?)',
            [lead.organization_id || 1, lead.phone, 'Bloqueado manualmente no CRM']);
        await db.run("UPDATE followups SET status='cancelled' WHERE lead_id=? AND status='scheduled'", [id]);
    }

    // Recalcula score (estágio influencia o score)
    const fresh = await getLead(id, seller_id);
    const next = scoreService.computeScore(fresh);
    await db.run('UPDATE leads SET score = ? WHERE id = ?', [next, id]);

    // Auto-disparo configurado na coluna de destino
    await triggerStageAutomation(fresh, status, seller_id);

    const ws = require('./websocket-service');
    ws.broadcast('lead:status_changed', { lead_id: id, status, lead: fresh });

    return getLead(id, seller_id);
}

async function getHistory(id, seller_id) {
    // O lead já foi verificado como pertencente ao usuário na rota; retorna todo o histórico
    // da organização (inclui transferências registradas por outros vendedores/admin).
    const lead = await getLead(id, seller_id);
    if (!lead) return [];
    return db.all(
        `SELECT lh.*, s.name AS actor_name
         FROM lead_history lh
         LEFT JOIN sellers s ON s.id = lh.seller_id
         WHERE lh.lead_id = ? AND s.organization_id = ?
         ORDER BY lh.id DESC`,
        [id, lead.organization_id || 1]
    );
}

// Transferência de lead entre vendedores (somente admin)
async function transferLead(id, { to_seller_id, admin_id, organization_id }) {
    const lead = await db.get(
        'SELECT * FROM leads WHERE id = ? AND organization_id = ?',
        [id, organization_id]
    );
    if (!lead) return null;
    if (lead.seller_id === to_seller_id) return { lead, transferred: false };
    const from_seller_id = lead.seller_id;

    const target = await db.get('SELECT id, name FROM sellers WHERE id = ? AND organization_id = ? AND active = 1', [to_seller_id, organization_id]);
    if (!target) {
        const e = new Error('Vendedor de destino inválido');
        e.status = 400;
        throw e;
    }

    await db.run('UPDATE leads SET seller_id = ?, updated_at = datetime(\'now\') WHERE id = ?', [to_seller_id, id]);
    await db.run(
        `INSERT INTO lead_history (lead_id, seller_id, from_status, to_status)
         VALUES (?, ?, ?, ?)`,
        [id, admin_id, lead.status, `transferido:${from_seller_id}->${to_seller_id}`]
    );
    const fresh = await db.get('SELECT * FROM leads WHERE id = ?', [id]);
    return { lead: fresh, transferred: true, target_name: target.name };
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
        confirmados: row.confirmados,
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

module.exports = { createLead, listLeads, getLead, updateLead, updateStatus, getHistory, countsBySeller, funnelBySeller, transferLead };
