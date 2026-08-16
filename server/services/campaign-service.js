const db = require('../database/db');
const antiBan = require('./anti-ban-service');
const settings = require('./settings-service');
const whatsapp = require('./whatsapp-service');

const DEFAULT_BATCH = Number(process.env.CAMPAIGN_BATCH_SIZE) || 50;
const DEFAULT_DELAY_MS = Number(process.env.CAMPAIGN_DELAY_MS) || 15000;

const running = new Set();

// IDs vêm de req.params (string) ou de chamadas internas (number) — normaliza
function numId(id) {
    const n = Number(id);
    return Number.isFinite(n) ? n : id;
}

// Status que o disparo em massa atinge por padrão (leads quentes)
const HOT_STATUSES = ['novo', 'contato'];

// Message de entrada do bot principal (anti-ban): pergunta se pode encaminhar a simulação
function buildMainMessage(lead) {
    const tmpl = process.env.BOT_MAIN_WELCOME ||
        'Olá {nome}! Aqui é a Prime Sul. Você pediu uma simulação de crédito. Posso pedir para um vendedor encaminhar a simulação? Responda SIM para continuar.';
    return tmpl.replace('{nome}', lead.name.split(' ')[0]);
}

// Constrói WHERE dinâmico para selecionar os leads-alvo da campanha
function buildTargetWhere(sellerId, filters = {}) {
    const clauses = ['l.seller_id = ?'];
    const params = [sellerId];

    const rawStatuses = Array.isArray(filters.status) ? filters.status : (filters.status ? [filters.status] : []);
    const statuses = rawStatuses.filter(s => HOT_STATUSES.includes(s));
    clauses.push(`l.status IN (${(statuses.length ? statuses : HOT_STATUSES).map(() => '?').join(',')})`);
    for (const s of statuses.length ? statuses : HOT_STATUSES) params.push(s);

    if (filters.origem) { clauses.push('l.origem = ?'); params.push(filters.origem); }
    if (filters.prioridade) { clauses.push('l.prioridade = ?'); params.push(filters.prioridade); }
    if (filters.cidade) { clauses.push('l.city LIKE ?'); params.push(`%${filters.cidade}%`); }

    // Não envia para quem já recebeu envio de alguma campanha
    clauses.push('NOT EXISTS (SELECT 1 FROM sends s WHERE s.lead_id = l.id AND s.campaign_id IS NOT NULL)');

    let limit = null;
    const rawLimit = Number(filters.limit);
    if (Number.isFinite(rawLimit) && rawLimit > 0) {
        limit = Math.min(Math.floor(rawLimit), 10000);
    }
    return { where: clauses.join(' AND '), params, limit };
}

async function countTargets(sellerId, filters = {}) {
    const { where, params } = buildTargetWhere(sellerId, filters);
    const row = await db.get(`SELECT COUNT(*) AS c FROM leads l WHERE ${where}`, params);
    return row ? row.c : 0;
}

async function createCampaign({ seller_id, name, message, number_ids, filters = {} }) {
    const ids = (number_ids || []).map(Number).filter(Boolean);
    const numbers = ids.length
        ? await db.all(
            `SELECT * FROM bot_numbers WHERE id IN (${ids.map(() => '?').join(',')}) AND status = 'ativo'`,
            ids
        )
        : await db.all("SELECT * FROM bot_numbers WHERE status = 'ativo' ORDER BY id ASC LIMIT 1");
    if (!numbers.length) throw new Error('Nenhum número ativo disponível');

    const { where, params, limit } = buildTargetWhere(seller_id, filters);
    const targets = await db.all(
        `SELECT * FROM leads l WHERE ${where} ORDER BY l.created_at ASC${limit ? ' LIMIT ' + limit : ''}`,
        params
    );
    if (!targets.length) throw new Error('Nenhum lead corresponde aos filtros escolhidos');

    const result = await db.run(
        `INSERT INTO campaigns (seller_id, number_id, name, message, status, total_target, filters)
         VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
        [seller_id, numbers[0].id, name, message || buildMainMessage({ name: 'Cliente' }), targets.length, JSON.stringify(filters || {})]
    );

    for (const lead of targets) {
        await db.run(
            'INSERT INTO sends (campaign_id, lead_id, number_id, status) VALUES (?, ?, ?, ?)',
            [result.lastID, lead.id, numbers[0].id, 'pending']
        );
    }
    return db.get('SELECT * FROM campaigns WHERE id = ?', [result.lastID]);
}

async function startCampaign(id) {
    id = numId(id);
    const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (!campaign) throw new Error('Campanha não encontrada');
    if (running.has(id)) return { started: true, message: 'Já em execução' };
    if (campaign.status === 'done' || campaign.status === 'cancelled') return { started: false };

    running.add(id);
    await db.run("UPDATE campaigns SET status = 'running', error = NULL WHERE id = ?", [id]);
    processCampaign(campaign); // não bloqueia
    return { started: true };
}

async function processCampaign(campaign) {
    const batch = await settings.getNumber('cfg_batch', DEFAULT_BATCH);
    const delayMs = await settings.getNumber('cfg_delay', DEFAULT_DELAY_MS);
    console.log(`[campaign] ${campaign.name} — processando (lote ${batch}, delay ${delayMs}ms)`);
    const pending = await db.all(
        'SELECT * FROM sends WHERE campaign_id = ? AND status = ? ORDER BY id ASC LIMIT ?',
        [campaign.id, 'pending', batch]
    );

    for (const send of pending) {
        if (!running.has(campaign.id)) break; // pausada/cancelada

        const lead = await db.get('SELECT * FROM leads WHERE id = ?', [send.lead_id]);
        const botNumber = await db.get('SELECT * FROM bot_numbers WHERE id = ?', [send.number_id]);

        if (!botNumber) {
            await db.run("UPDATE sends SET status = 'falhou' WHERE id = ?", [send.id]);
            continue;
        }

        // Anti-ban: só envia para leads quentes
        if (!antiBan.shouldSend(lead)) {
            await db.run("UPDATE sends SET status = 'falhou' WHERE id = ?", [send.id]);
            continue;
        }

        let msg = campaign.message;
        if (!msg || msg.includes('{nome}')) msg = buildMainMessage(lead);

        const res = await whatsapp.sendMessage(botNumber.number, lead.phone, msg);
        if (res.sent) {
            await db.run(
                `UPDATE sends SET status = 'sent', wa_message = ?, sent_at = datetime('now') WHERE id = ?`,
                [msg, send.id]
            );
            await antiBan.markSent(botNumber.id);
        } else {
            await db.run("UPDATE sends SET status = 'falhou' WHERE id = ?", [send.id]);
            if (res.reason === 'not_connected') {
                console.warn(`[campaign] ${campaign.name} — bot offline, pausando (auto-resume na reconexão)`);
                await db.run("UPDATE campaigns SET status = 'paused', error = 'not_connected' WHERE id = ?", [campaign.id]);
                running.delete(campaign.id);
                return;
            }
        }
        await sleep(delayMs);
    }

    const remaining = await db.get(
        'SELECT COUNT(*) AS c FROM sends WHERE campaign_id = ? AND status = ?',
        [campaign.id, 'pending']
    );
    if (remaining.c > 0 && running.has(campaign.id)) {
        await processCampaign(campaign); // próximo lote
    } else if (running.has(campaign.id)) {
        await db.run("UPDATE campaigns SET status = 'done', error = NULL WHERE id = ?", [campaign.id]);
        console.log(`[campaign] ${campaign.name} — concluída`);
        running.delete(campaign.id);
    }
}

function pauseCampaign(id) {
    id = numId(id);
    running.delete(id);
    return db.run("UPDATE campaigns SET status = 'paused', error = NULL WHERE id = ?", [id]);
}

function cancelCampaign(id) {
    id = numId(id);
    running.delete(id);
    return db.run("UPDATE campaigns SET status = 'cancelled', error = NULL WHERE id = ?", [id]);
}

// Reinicia campanhas pausadas por bot offline (chamado quando um bot reconecta)
async function resumePausedFromOffline() {
    const rows = await db.all("SELECT * FROM campaigns WHERE status = 'paused' AND error = 'not_connected'");
    for (const c of rows) {
        running.add(c.id);
        await db.run("UPDATE campaigns SET status = 'running', error = NULL WHERE id = ?", [c.id]);
        processCampaign(c);
        console.log(`[campaign] ${c.name} — auto-resume após reconexão do bot`);
    }
    return rows.length;
}

// Reenvia os envios que falharam (falhou/caiu) e reinicia o processamento
async function retryCampaign(id) {
    id = numId(id);
    const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (!campaign) throw new Error('Campanha não encontrada');
    if (running.has(id)) return { retried: 0, message: 'Campanha já em execução' };

    const res = await db.run(
        "UPDATE sends SET status = 'pending' WHERE campaign_id = ? AND status IN ('falhou','caiu')",
        [id]
    );
    if (!res.changes) return { retried: 0, message: 'Nenhum envio falho para reenviar' };

    await db.run("UPDATE campaigns SET status = 'running', error = NULL WHERE id = ?", [id]);
    running.add(id);
    processCampaign(campaign);
    return { retried: res.changes, message: `${res.changes} envio(s) sendo reenviado(s)` };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = {
    createCampaign,
    countTargets,
    startCampaign,
    pauseCampaign,
    cancelCampaign,
    retryCampaign,
    resumePausedFromOffline,
    buildMainMessage
};
