const db = require('../database/db');
const { phoneKey, phoneVariants } = require('../utils/phone');

// Acha o lead dono de um telefone testando TODAS as variantes (com/sem o 9)
// contra os três campos de telefone.
async function findLeadByPhone(organizationId, phone) {
    const vs = phoneVariants(phone);
    if (!vs.length) return null;
    const ph = vs.map(() => '?').join(',');
    return db.get(
        `SELECT * FROM leads
         WHERE organization_id = ?
           AND (phone IN (${ph}) OR phone2 IN (${ph}) OR phone3 IN (${ph}))
         ORDER BY id ASC LIMIT 1`,
        [organizationId, ...vs, ...vs, ...vs]
    );
}

// Grava uma mensagem (entrada ou saída). Idempotente por wa_message_id.
async function record({ organizationId = 1, leadId = null, leadPhone, botNumber, direction, body, waMessageId = null, status = null }) {
    const canonPhone = phoneKey(leadPhone) || String(leadPhone || '').replace(/\D/g, '');
    if (!canonPhone || !botNumber) return null;

    if (waMessageId) {
        const dup = await db.get('SELECT id FROM messages WHERE wa_message_id = ?', [waMessageId]);
        if (dup) return dup.id;
    }
    const r = await db.run(
        `INSERT INTO messages (organization_id, lead_id, lead_phone, bot_number, direction, body, wa_message_id, status, read_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [organizationId, leadId, canonPhone, String(botNumber), direction, body || null, waMessageId, status,
         direction === 'out' ? new Date().toISOString() : null]
    );
    return r.lastID;
}

// Conversa completa de um lead, agrupada por thread (número do cliente + bot).
async function conversationsForLead(leadId) {
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
    if (!lead) return { threads: [] };

    const rows = await db.all(
        `SELECT * FROM messages WHERE lead_id = ? ORDER BY created_at ASC, id ASC`,
        [leadId]
    );

    // Rótulo do número do cliente: "Telefone 1/2/3" quando casar com um campo do lead
    const label = (canonPhone) => {
        const { phoneKey: k } = require('../utils/phone');
        if (k(lead.phone) === canonPhone) return 'Telefone 1';
        if (lead.phone2 && k(lead.phone2) === canonPhone) return 'Telefone 2';
        if (lead.phone3 && k(lead.phone3) === canonPhone) return 'Telefone 3';
        return canonPhone;
    };

    const map = new Map();
    for (const m of rows) {
        const key = `${m.lead_phone}|${m.bot_number}`;
        if (!map.has(key)) {
            map.set(key, {
                lead_phone: m.lead_phone,
                bot_number: m.bot_number,
                phone_label: label(m.lead_phone),
                messages: [],
                unread: 0,
                last_at: null
            });
        }
        const t = map.get(key);
        t.messages.push({
            id: m.id,
            direction: m.direction,
            body: m.body,
            status: m.status,
            created_at: m.created_at
        });
        if (m.direction === 'in' && !m.read_at) t.unread++;
        t.last_at = m.created_at;
    }

    const threads = [...map.values()].sort((a, b) => String(b.last_at).localeCompare(String(a.last_at)));
    return { lead_id: leadId, threads };
}

// Marca como lidas as mensagens de entrada de um thread (ou do lead inteiro).
async function markRead(leadId, { leadPhone = null, botNumber = null } = {}) {
    const where = ['lead_id = ?', "direction = 'in'", 'read_at IS NULL'];
    const params = [leadId];
    if (leadPhone) { where.push('lead_phone = ?'); params.push(phoneKey(leadPhone) || leadPhone); }
    if (botNumber) { where.push('bot_number = ?'); params.push(String(botNumber)); }
    const r = await db.run(`UPDATE messages SET read_at = datetime('now') WHERE ${where.join(' AND ')}`, params);
    return r.changes;
}

// Resumo por lead para a lista (tem conversa? quantas não lidas?)
async function summaryForLeads(leadIds = []) {
    if (!leadIds.length) return {};
    const ph = leadIds.map(() => '?').join(',');
    const rows = await db.all(
        `SELECT lead_id,
                COUNT(*) AS total,
                SUM(CASE WHEN direction = 'in' AND read_at IS NULL THEN 1 ELSE 0 END) AS unread,
                COUNT(DISTINCT lead_phone || '|' || bot_number) AS threads,
                MAX(created_at) AS last_at
         FROM messages WHERE lead_id IN (${ph}) GROUP BY lead_id`,
        leadIds
    );
    const out = {};
    for (const r of rows) out[r.lead_id] = { total: r.total, unread: r.unread || 0, threads: r.threads, last_at: r.last_at };
    return out;
}

module.exports = { findLeadByPhone, record, conversationsForLead, markRead, summaryForLeads };
