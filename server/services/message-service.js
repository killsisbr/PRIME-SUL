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

// Auxiliar para obter metadados consolidados dos bots (banco + status Baileys em memória)
async function getBotMetadata(organizationId = 1) {
    const rows = await db.all(
        `SELECT id, organization_id, seller_id, number, label, status, slot_index, real_number, push_name, daily_limit_override, messages_sent
         FROM bot_numbers WHERE organization_id = ?`,
        [organizationId]
    );
    let liveStatus = {};
    try {
        const whatsapp = require('./whatsapp-service');
        liveStatus = whatsapp.status() || {};
    } catch (e) {}

    const map = new Map();
    const list = rows.map(r => {
        const live = liveStatus[r.number] || {};
        const isConnected = live.status === 'connected';
        const realNum = live.realNumber || r.real_number || null;
        const push = live.pushName || r.push_name || null;
        const displayLabel = r.label || (r.slot_index ? `WhatsApp ${r.slot_index}` : `Bot ${r.id}`);
        const shortName = r.slot_index ? `WA ${r.slot_index}` : (r.label ? (r.label.length > 10 ? r.label.slice(0, 10) : r.label) : `Bot`);
        const item = {
            id: r.id,
            number: r.number,
            label: displayLabel,
            short_name: shortName,
            slot_index: r.slot_index,
            real_number: realNum,
            push_name: push,
            status: r.status,
            connection: live.status || (r.status === 'banido' ? 'banido' : 'offline'),
            connected: isConnected,
            messages_sent: r.messages_sent,
            daily_limit_override: r.daily_limit_override
        };
        map.set(r.number, item);
        return item;
    });

    return { map, list };
}

function fallbackBot(number) {
    const s = String(number || '');
    return {
        id: null,
        number: s,
        label: s.includes('slot-') ? `WhatsApp ${s.slice(-1)}` : `WhatsApp (${s.slice(-4)})`,
        short_name: s.includes('slot-') ? `WA ${s.slice(-1)}` : `WA ${s.slice(-4)}`,
        slot_index: s.includes('slot-') ? Number(s.slice(-1)) || null : null,
        real_number: s,
        push_name: null,
        status: 'ativo',
        connection: 'offline',
        connected: false
    };
}

// Conversa completa de um lead, agrupada por thread (número do cliente + bot).
async function conversationsForLead(leadId) {
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
    if (!lead) return { threads: [], available_bots: [] };

    const { map: botMap, list: availableBots } = await getBotMetadata(lead.organization_id || 1);

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
        const bot = botMap.get(m.bot_number) || fallbackBot(m.bot_number);
        if (!map.has(key)) {
            map.set(key, {
                lead_phone: m.lead_phone,
                bot_number: m.bot_number,
                phone_label: label(m.lead_phone),
                bot_label: bot.label,
                bot_short_name: bot.short_name,
                bot_slot_index: bot.slot_index,
                bot_real_number: bot.real_number,
                bot_push_name: bot.push_name,
                bot_status: bot.status,
                bot_connection: bot.connection,
                bot_connected: bot.connected,
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
            created_at: m.created_at,
            bot_number: m.bot_number,
            bot_label: bot.label,
            bot_short_name: bot.short_name,
            bot_slot_index: bot.slot_index
        });
        if (m.direction === 'in' && !m.read_at) t.unread++;
        t.last_at = m.created_at;
    }

    const threads = [...map.values()].sort((a, b) => String(b.last_at).localeCompare(String(a.last_at)));
    return { lead_id: leadId, threads, available_bots: availableBots };
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

// Resumo por lead para a lista (tem conversa? quantas não lidas? quais bots?)
async function summaryForLeads(leadIds = [], organizationId = 1) {
    if (!leadIds.length) return {};
    const ph = leadIds.map(() => '?').join(',');
    const { map: botMap } = await getBotMetadata(organizationId);

    const rows = await db.all(
        `SELECT lead_id,
                COUNT(*) AS total,
                SUM(CASE WHEN direction = 'in' AND read_at IS NULL THEN 1 ELSE 0 END) AS unread,
                COUNT(DISTINCT lead_phone || '|' || bot_number) AS threads,
                MAX(created_at) AS last_at,
                GROUP_CONCAT(DISTINCT bot_number) AS bot_numbers_str
         FROM messages WHERE lead_id IN (${ph}) GROUP BY lead_id`,
        leadIds
    );

    const lastBotsRows = await db.all(
        `SELECT m.lead_id, m.bot_number
         FROM messages m
         INNER JOIN (
             SELECT lead_id, MAX(id) as max_id
             FROM messages WHERE lead_id IN (${ph})
             GROUP BY lead_id
         ) latest ON m.id = latest.max_id`,
        leadIds
    );
    const lastBotByLead = {};
    for (const lb of lastBotsRows) {
        lastBotByLead[lb.lead_id] = lb.bot_number;
    }

    const out = {};
    for (const r of rows) {
        const rawBots = (r.bot_numbers_str || '').split(',').map(b => b.trim()).filter(Boolean);
        const bots = rawBots.map(b => botMap.get(b) || fallbackBot(b));
        const lastBotNum = lastBotByLead[r.lead_id] || (rawBots.length ? rawBots[0] : null);
        const lastBot = lastBotNum ? (botMap.get(lastBotNum) || fallbackBot(lastBotNum)) : null;

        out[r.lead_id] = {
            total: r.total,
            unread: r.unread || 0,
            threads: r.threads,
            last_at: r.last_at,
            bot_numbers: rawBots,
            bots,
            last_bot: lastBot
        };
    }
    return out;
}

module.exports = { findLeadByPhone, record, conversationsForLead, markRead, summaryForLeads, getBotMetadata };

