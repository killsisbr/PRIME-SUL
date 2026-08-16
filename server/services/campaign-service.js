const db = require('../database/db');
const antiBan = require('./anti-ban-service');
const settings = require('./settings-service');
const whatsapp = require('./whatsapp-service');
const jobs = require('./job-queue-service');

const DEFAULT_BATCH = Number(process.env.CAMPAIGN_BATCH_SIZE) || 50;
const DEFAULT_DELAY_MS = Number(process.env.CAMPAIGN_DELAY_MS) || 15000;

// Guards em memória (loop rápido); o registro durável fica na tabela jobs (campaign_run)
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

// Substitui {nome} na mensagem customizada
function personalize(msg, lead) {
    if (!msg) return '';
    return msg.replace(/\{nome\}/g, (lead.name || '').split(' ')[0]);
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

async function pickNumbers(number_ids) {
    const ids = (number_ids || []).map(Number).filter(Boolean);
    if (ids.length) {
        return db.all(
            `SELECT * FROM bot_numbers WHERE id IN (${ids.map(() => '?').join(',')}) AND status = 'ativo'`,
            ids
        );
    }
    return db.all("SELECT * FROM bot_numbers WHERE status = 'ativo' ORDER BY id ASC LIMIT 1");
}

async function createCampaign({ seller_id, name, message, number_ids, filters = {} }) {
    const numbers = await pickNumbers(number_ids);
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

// Campanha direta: envia para uma lista explícita de leads (auto-disparo por coluna)
async function createDirectCampaign({ seller_id, name, message, number_ids, lead_ids }) {
    const ids = (lead_ids || []).map(Number).filter(Boolean);
    if (!ids.length) throw new Error('Nenhum lead selecionado');
    const numbers = await pickNumbers(number_ids);
    if (!numbers.length) throw new Error('Nenhum número ativo disponível');

    const result = await db.run(
        `INSERT INTO campaigns (seller_id, number_id, name, message, status, total_target, filters)
         VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
        [seller_id, numbers[0].id, name, message || buildMainMessage({ name: 'Cliente' }), ids.length, JSON.stringify({ direct: ids })]
    );

    for (const lid of ids) {
        await db.run(
            'INSERT INTO sends (campaign_id, lead_id, number_id, status) VALUES (?, ?, ?, ?)',
            [result.lastID, lid, numbers[0].id, 'pending']
        );
    }
    return db.get('SELECT * FROM campaigns WHERE id = ?', [result.lastID]);
}

// Auto-disparo de um lead individual (usado ao entrar numa coluna com auto-disparo)
async function sendToLead(lead, message, sellerId) {
    const active = await db.get("SELECT id FROM sends WHERE lead_id = ? AND status IN ('pending','sent') LIMIT 1", [lead.id]);
    if (active) return { sent: false, reason: 'já em contato' };
    if (!antiBan.shouldSend(lead)) return { sent: false, reason: 'estágio não elegível' };
    const campaign = await createDirectCampaign({
        seller_id: sellerId,
        name: '[AUTO] Disparo automático',
        message: message || buildMainMessage(lead),
        number_ids: [],
        lead_ids: [lead.id]
    });
    await startCampaign(campaign.id);
    return { sent: true, campaign_id: campaign.id };
}

async function startCampaign(id) {
    id = numId(id);
    const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (!campaign) throw new Error('Campanha não encontrada');
    if (running.has(id)) return { started: true, message: 'Já em execução' };
    if (campaign.status === 'done' || campaign.status === 'cancelled') return { started: false };

    const active = await jobs.getActiveCount('campaign_run', id);
    if (active > 0) return { started: true, message: 'Já em execução' };

    const job = await jobs.enqueue({
        type: 'campaign_run',
        ref_id: id,
        seller_id: campaign.seller_id,
        payload: { campaign_id: id, done: 0, total: campaign.total_target, sent: 0, confirmado: 0, falhou: 0 },
        max_attempts: 1
    });
    running.add(id);
    await db.run("UPDATE campaigns SET status = 'running', error = NULL WHERE id = ?", [id]);
    runCampaignLoop(job, campaign); // não bloqueia
    return { started: true, job_id: job.id };
}

// Marca o job como em execução e dispara o loop; o job é concluído ao final do loop.
async function runCampaignLoop(job, campaign) {
    await jobs.markRunning(job.id).catch(() => {});
    try {
        await processCampaign(campaign, job);
    } catch (e) {
        console.error(`[campaign] ${campaign.name} — erro no loop:`, e.message);
        await jobs.fail(job.id, e.message).catch(() => {});
    }
}

async function processCampaign(campaign, job) {
    const batch = await settings.getNumber('cfg_batch', DEFAULT_BATCH);
    const delayMs = await settings.getNumber('cfg_delay', DEFAULT_DELAY_MS);
    console.log(`[campaign] ${campaign.name} — processando (lote ${batch}, delay ${delayMs}ms)`);

    let progress = { done: 0, total: campaign.total_target || 0, sent: 0, confirmado: 0, falhou: 0 };
    try { progress = { ...progress, ...(JSON.parse(job.payload || '{}')) }; } catch (e) { /* ignore */ }

    while (running.has(campaign.id)) {
        const pending = await db.all(
            'SELECT * FROM sends WHERE campaign_id = ? AND status = ? ORDER BY id ASC LIMIT ?',
            [campaign.id, 'pending', batch]
        );
        if (!pending.length) break;

        for (const send of pending) {
            // Pausada/cancelada durante o lote
            const c = await db.get('SELECT status FROM campaigns WHERE id = ?', [campaign.id]);
            if (!c || c.status !== 'running') return;

            const lead = await db.get('SELECT * FROM leads WHERE id = ?', [send.lead_id]);
            const botNumber = await db.get('SELECT * FROM bot_numbers WHERE id = ?', [send.number_id]);

            if (!botNumber) {
                await db.run("UPDATE sends SET status = 'falhou' WHERE id = ?", [send.id]);
                progress.falhou++;
                progress.done++;
                continue;
            }

            // Anti-ban: só envia para leads quentes
            if (!antiBan.shouldSend(lead)) {
                await db.run("UPDATE sends SET status = 'falhou' WHERE id = ?", [send.id]);
                progress.falhou++;
                progress.done++;
                continue;
            }

            let msg = campaign.message ? personalize(campaign.message, lead) : buildMainMessage(lead);

            const res = await whatsapp.sendMessage(botNumber.number, lead.phone, msg);
            if (res.sent) {
                await db.run(
                    `UPDATE sends SET status = 'sent', wa_message = ?, sent_at = datetime('now') WHERE id = ?`,
                    [msg, send.id]
                );
                await antiBan.markSent(botNumber.id);
                progress.sent++;
            } else {
                await db.run("UPDATE sends SET status = 'falhou' WHERE id = ?", [send.id]);
                progress.falhou++;
                if (res.reason === 'not_connected') {
                    console.warn(`[campaign] ${campaign.name} — bot offline, pausando (auto-resume na reconexão)`);
                    await db.run("UPDATE campaigns SET status = 'paused', error = 'not_connected' WHERE id = ?", [campaign.id]);
                    running.delete(campaign.id);
                    await jobs.complete(job.id, { status: 'paused', ...progress }).catch(() => {});
                    return;
                }
            }
            progress.done++;
            await sleep(delayMs);
        }

        progress.done = Math.min(progress.done, progress.total || progress.done);
        await jobs.updatePayload(job.id, progress).catch(() => {});
    }

    // Loop saiu: ou terminou, ou foi pausada/cancelada
    const final = await db.get('SELECT * FROM campaigns WHERE id = ?', [campaign.id]);
    if (running.has(campaign.id) && final && final.status === 'running') {
        const remaining = await db.get(
            'SELECT COUNT(*) AS c FROM sends WHERE campaign_id = ? AND status = ?',
            [campaign.id, 'pending']
        );
        if (remaining.c > 0) {
            await processCampaign(campaign, job); // próximo lote
        } else {
            await db.run("UPDATE campaigns SET status = 'done', error = NULL WHERE id = ?", [campaign.id]);
            console.log(`[campaign] ${campaign.name} — concluída`);
            running.delete(campaign.id);
            await jobs.complete(job.id, { status: 'done', ...progress }).catch(() => {});
        }
    } else if (running.has(campaign.id)) {
        running.delete(campaign.id);
        await jobs.complete(job.id, { status: final ? final.status : 'unknown', ...progress }).catch(() => {});
    }
}

async function pauseCampaign(id) {
    id = numId(id);
    running.delete(id);
    await jobs.cancelForRef('campaign_run', id);
    return db.run("UPDATE campaigns SET status = 'paused', error = NULL WHERE id = ?", [id]);
}

async function cancelCampaign(id) {
    id = numId(id);
    running.delete(id);
    await jobs.cancelForRef('campaign_run', id);
    return db.run("UPDATE campaigns SET status = 'cancelled', error = NULL WHERE id = ?", [id]);
}

// Reinicia campanhas pausadas por bot offline (chamado quando um bot reconecta)
async function resumePausedFromOffline() {
    const rows = await db.all("SELECT * FROM campaigns WHERE status = 'paused' AND error = 'not_connected'");
    for (const c of rows) {
        await startCampaign(c.id);
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
    const active = await jobs.getActiveCount('campaign_run', id);
    if (active > 0) return { retried: 0, message: 'Campanha já em execução' };

    const res = await db.run(
        "UPDATE sends SET status = 'pending' WHERE campaign_id = ? AND status IN ('falhou','caiu')",
        [id]
    );
    if (!res.changes) return { retried: 0, message: 'Nenhum envio falho para reenviar' };

    await db.run("UPDATE campaigns SET status = 'running', error = NULL WHERE id = ?", [id]);
    const started = await startCampaign(id);
    return { retried: res.changes, message: `${res.changes} envio(s) sendo reenviado(s)`, job_id: started.job_id };
}

// Após restart: retoma execuções de campanha que estavam rodando (campaign_run job persistido)
async function recoverInterrupted() {
    const rowJobs = await db.all("SELECT * FROM jobs WHERE type = 'campaign_run' AND status IN ('waiting','running')");
    for (const j of rowJobs) {
        const c = await db.get('SELECT * FROM campaigns WHERE id = ?', [j.ref_id]);
        if (!c || c.status === 'done' || c.status === 'cancelled') {
            await jobs.complete(j.id, { status: 'irrelevante' }).catch(() => {});
            continue;
        }
        if (c.status === 'running') {
            running.add(c.id);
            runCampaignLoop(j, c);
            console.log(`[campaign] ${c.name} — retomada após restart`);
        } else {
            // pausada (ex: not_connected) — o resume cuida ao reconectar
            await jobs.complete(j.id, { status: c.status }).catch(() => {});
        }
    }

    // Campanhas 'running' sem job ativo ficam presas — marca como interrompida
    const stale = await db.all(`
        SELECT * FROM campaigns
        WHERE status = 'running' AND id NOT IN (
            SELECT ref_id FROM jobs WHERE type = 'campaign_run' AND status IN ('waiting','running')
        )
    `);
    for (const c of stale) {
        await db.run("UPDATE campaigns SET status = 'paused', error = 'interrupted' WHERE id = ?", [c.id]);
        console.warn(`[campaign] ${c.name} — status 'running' sem job, marcada como interrompida`);
    }
    return rowJobs.length + stale.length;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = {
    createCampaign,
    createDirectCampaign,
    sendToLead,
    countTargets,
    startCampaign,
    pauseCampaign,
    cancelCampaign,
    retryCampaign,
    resumePausedFromOffline,
    recoverInterrupted,
    buildMainMessage
};
