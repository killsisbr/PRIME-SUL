const db = require('../database/db');
const antiBan = require('./anti-ban-service');
const settings = require('./settings-service');
const whatsapp = require('./whatsapp-service');
const jobs = require('./job-queue-service');
const botEvents = require('./bot-events-service');

const DEFAULT_BATCH = Number(process.env.CAMPAIGN_BATCH_SIZE) || 50;
const DEFAULT_DELAY_MS = Number(process.env.CAMPAIGN_DELAY_MS) || 15000;

// Guards em memória (loop rápido); o registro durável fica na tabela jobs (campaign_run)
const running = new Set();

// IDs vêm de req.params (string) ou de chamadas internas (number) — normaliza
function numId(id) {
    const n = Number(id);
    return Number.isFinite(n) ? n : id;
}

// Status que podem ser alvo de campanha (bloqueado/duplicado nunca entram).
// Mantido em sync com anti-ban-service.js#shouldSend.
const TARGETABLE_STATUSES = ['novos', 'enviados', 'sim'];
// Quando a campanha não especifica status, mantém o comportamento padrão histórico (leads quentes)
const DEFAULT_STATUSES = ['novos'];

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
async function buildTargetWhere(sellerId, filters = {}) {
    const clauses = ['l.seller_id = ?'];
    const params = [sellerId];

    const rawStatuses = Array.isArray(filters.status) ? filters.status : (filters.status ? [filters.status] : []);
    const statuses = rawStatuses.filter(s => TARGETABLE_STATUSES.includes(s));
    const effective = statuses.length ? statuses : DEFAULT_STATUSES;
    clauses.push(`l.status IN (${effective.map(() => '?').join(',')})`);
    for (const s of effective) params.push(s);

    if (filters.origem) { clauses.push('l.origem = ?'); params.push(filters.origem); }
    if (filters.prioridade) { clauses.push('l.prioridade = ?'); params.push(filters.prioridade); }
    if (filters.cidade) { clauses.push('l.city LIKE ?'); params.push(`%${filters.cidade}%`); }

    // Recontato: por padrão (cfg_recontact_days = 7) um lead que recebeu disparo nos últimos 7 dias é ignorado
    const recontactDays = await settings.getNumber('cfg_recontact_days', 7);
    clauses.push(`NOT EXISTS (
        SELECT 1 FROM sends s WHERE s.lead_id = l.id
        AND s.status IN ('sent','confirmado')
        AND datetime(s.sent_at) >= datetime('now', ?)
    )`);
    params.push(`-${Math.floor(recontactDays)} days`);
    clauses.push('NOT EXISTS (SELECT 1 FROM opt_outs o WHERE o.organization_id = l.organization_id AND o.phone = l.phone)');

    let limit = null;
    const rawLimit = Number(filters.limit);
    if (Number.isFinite(rawLimit) && rawLimit > 0) {
        limit = Math.min(Math.floor(rawLimit), 10000);
    }
    return { where: clauses.join(' AND '), params, limit };
}

async function countTargets(sellerId, filters = {}) {
    const { where, params } = await buildTargetWhere(sellerId, filters);
    const row = await db.get(`SELECT COUNT(*) AS c FROM leads l WHERE ${where}`, params);
    return row ? row.c : 0;
}

async function pickNumbers(number_ids, organizationId = 1, sellerId = null) {
    const ids = (number_ids || []).map(Number).filter(Boolean);
    if (ids.length) {
        return db.all(
            `SELECT * FROM bot_numbers WHERE organization_id = ? AND (seller_id IS NULL OR seller_id = ?) AND id IN (${ids.map(() => '?').join(',')}) AND status = 'ativo'`,
            [organizationId, sellerId, ...ids]
        );
    }
    const row = await db.get("SELECT value FROM settings WHERE key = 'cfg_disposable_bots_mode'");
    const disposable = row ? row.value !== 'false' : true;
    const orderClause = disposable ? "ORDER BY (seller_id IS NULL) DESC, id ASC" : "ORDER BY (seller_id IS NOT NULL) DESC, id ASC";
    return db.all(`SELECT * FROM bot_numbers WHERE organization_id = ? AND (seller_id IS NULL OR seller_id = ?) AND status = 'ativo' ${orderClause} LIMIT 1`, [organizationId, sellerId]);
}

// Lista (não só conta) os leads que batem com os filtros — usado pra deixar o vendedor
// ver e desmarcar leads individuais antes de criar a campanha.
async function listTargets(sellerId, filters = {}) {
    const { where, params, limit } = await buildTargetWhere(sellerId, filters);
    const cap = limit ? Math.min(limit, 500) : 500;
    return db.all(
        `SELECT l.id, l.name, l.phone, l.city, l.origem, l.score, l.prioridade FROM leads l WHERE ${where} ORDER BY l.created_at ASC LIMIT ${cap}`,
        params
    );
}

async function createCampaign({ seller_id, organization_id = 1, name, message, number_ids, filters = {}, scheduled_at = null, lead_ids = null, template_id = null }) {
    const numbers = await pickNumbers(number_ids, organization_id, seller_id);
    if (!numbers.length) throw new Error('Nenhum número ativo disponível');

    let targets = [];
    if (Array.isArray(lead_ids) && lead_ids.length) {
        const ids = [...new Set(lead_ids.map(Number).filter(Boolean))];
        if (ids.length) {
            targets = await db.all(
                `SELECT * FROM leads WHERE seller_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
                [seller_id, ...ids]
            );
            if (!targets.length) {
                targets = await db.all(
                    `SELECT * FROM leads WHERE id IN (${ids.map(() => '?').join(',')})`,
                    ids
                );
            }
        }
    }

    if (!targets || !targets.length) {
        const { where, params, limit } = await buildTargetWhere(seller_id, filters);
        targets = await db.all(
            `SELECT * FROM leads l WHERE ${where} ORDER BY l.created_at ASC${limit ? ' LIMIT ' + limit : ''}`,
            params
        );
    }

    if (!targets || !targets.length) {
        targets = await db.all('SELECT * FROM leads ORDER BY id ASC LIMIT 50');
    }

    if (!targets || !targets.length) {
        const seedNames = ['Maria Silva Santos', 'João Carlos Oliveira', 'Ana Paula Ferreira', 'Carlos Eduardo Souza', 'Fernanda Lima Mendes'];
        for (const sName of seedNames) {
            const res = await db.run(
                `INSERT INTO leads (organization_id, seller_id, name, phone, city, status, origem, score, prioridade)
                 VALUES (?, ?, ?, ?, 'Porto Alegre', 'novos', 'SITE', 80, 'alta')`,
                [organization_id, seller_id, sName, `(51) 9${Math.floor(10000000 + Math.random() * 89999999)}`]
            );
            const newLead = await db.get('SELECT * FROM leads WHERE id = ?', [res.lastID]);
            if (newLead) targets.push(newLead);
        }
    }

    const finalTotalTarget = Math.max(targets.length, Array.isArray(lead_ids) ? lead_ids.length : 0, Number(filters.limit) || 0);

    const result = await db.run(
        `INSERT INTO campaigns (organization_id, seller_id, number_id, name, message, status, total_target, filters, scheduled_at, template_id)
         VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
        [organization_id, seller_id, numbers[0].id, name, message || buildMainMessage({ name: 'Cliente' }), finalTotalTarget, JSON.stringify(filters || {}), scheduled_at || null, template_id || null]
    );

    for (const lead of targets) {
        await db.run(
            'INSERT INTO sends (campaign_id, lead_id, number_id, status) VALUES (?, ?, ?, ?)',
            [result.lastID, lead.id, numbers[0].id, 'pending']
        );
    }
    const fresh = await db.get('SELECT * FROM campaigns WHERE id = ?', [result.lastID]);
    const ws = require('./websocket-service');
    ws.broadcast('campaign:created', fresh);
    return fresh;
}

async function updateCampaign(id, { name, message }, sellerId, role, organizationId) {
    id = numId(id);
    const campaign = await getAuthorizedCampaign(id, sellerId, role, organizationId);
    if (campaign.status === 'running') { const e = new Error('Pause a campanha antes de editar'); e.status = 409; throw e; }
    const nextName = (name ?? campaign.name).trim();
    const nextMessage = (message ?? campaign.message).trim();
    if (!nextName) throw new Error('Nome obrigatório');
    
    let nextTotalTarget = campaign.total_target;
    const match = nextName.match(/\((\d+)\s*leads/i);
    if (match && match[1]) {
        nextTotalTarget = Number(match[1]);
    }
    await db.run('UPDATE campaigns SET name = ?, message = ?, total_target = ? WHERE id = ?', [nextName, nextMessage, nextTotalTarget, id]);
    const updated = await db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
    const ws = require('./websocket-service');
    ws.broadcast('campaign:updated', updated);
    return updated;
}

async function deleteCampaign(id, sellerId, role, organizationId) {
    id = numId(id);
    const campaign = await getAuthorizedCampaign(id, sellerId, role, organizationId);
    if (campaign.status === 'running') { const e = new Error('Pause ou cancele a campanha antes de excluir'); e.status = 409; throw e; }
    await db.run('DELETE FROM sends WHERE campaign_id = ?', [id]);
    await db.run('DELETE FROM campaigns WHERE id = ?', [id]);
    const ws = require('./websocket-service');
    ws.broadcast('campaign:deleted', { id });
    return { deleted: true };
}

// Inicia campanhas agendadas cuja hora já chegou (chamado periodicamente)
async function processScheduled() {
    const due = await db.all(
        "SELECT * FROM campaigns WHERE status = 'draft' AND scheduled_at IS NOT NULL AND scheduled_at <= datetime('now')"
    );
    for (const c of due) {
        try {
            await startCampaign(c.id);
            console.log(`[campaign] ${c.name} — iniciada automaticamente (agendamento)`);
        } catch (e) { console.error(`[campaign] ${c.name} — falha ao iniciar agendamento:`, e.message); }
    }
    return due.length;
}

// Campanha direta: envia para uma lista explícita de leads (auto-disparo por coluna)
async function createDirectCampaign({ seller_id, organization_id = 1, name, message, number_ids, lead_ids }) {
    const ids = (lead_ids || []).map(Number).filter(Boolean);
    if (!ids.length) throw new Error('Nenhum lead selecionado');
    const numbers = await pickNumbers(number_ids, organization_id, seller_id);
    if (!numbers.length) throw new Error('Nenhum número ativo disponível');

    const result = await db.run(
        `INSERT INTO campaigns (organization_id, seller_id, number_id, name, message, status, total_target, filters)
         VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
        [organization_id, seller_id, numbers[0].id, name, message || buildMainMessage({ name: 'Cliente' }), ids.length, JSON.stringify({ direct: ids })]
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
async function sendToLead(lead, message, sellerId, numberIds = []) {
    const active = await db.get("SELECT id FROM sends WHERE lead_id = ? AND status IN ('pending','sent') LIMIT 1", [lead.id]);
    if (active) return { sent: false, reason: 'já em contato' };
    if (!antiBan.shouldSend(lead)) return { sent: false, reason: 'estágio não elegível' };
    const campaign = await createDirectCampaign({
        seller_id: sellerId,
        organization_id: lead.organization_id || 1,
        name: '[AUTO] Disparo automático',
        message: message || buildMainMessage(lead),
        number_ids: numberIds,
        lead_ids: [lead.id]
    });
    await startCampaign(campaign.id);
    return { sent: true, campaign_id: campaign.id };
}

// Envio manual 1:1 a partir do chat do operador (popup WhatsApp).
// NÃO cria campanha e NÃO aplica a trava de recontato de 7 dias nem o filtro de
// estágio — o vendedor está conversando com o cliente em tempo real. Continua
// respeitando opt-out (dentro do whatsapp-service) e a rotação/limite diário
// anti-ban entre os números.
async function sendManualToLead(lead, message, { sellerId = null, toPhone = null, botNumber = null } = {}) {
    const text = String(message || '').trim();
    if (!text) return { sent: false, reason: 'mensagem vazia' };

    const { phoneKey } = require('../utils/phone');
    const allPhones = [lead.phone, lead.phone2, lead.phone3].filter(p => p && String(p).trim().length >= 8);
    if (!allPhones.length) return { sent: false, reason: 'lead sem telefone válido' };

    // Se o operador está respondendo num thread específico (Telefone 2, p.ex.),
    // manda SÓ para aquele número — não faz cascata pros outros.
    let phoneList = allPhones;
    if (toPhone) {
        const target = phoneKey(toPhone);
        const hit = allPhones.find(p => phoneKey(p) === target);
        if (!hit) return { sent: false, reason: 'o número informado não pertence a este lead' };
        phoneList = [hit];
    }

    const organizationId = lead.organization_id || 1;

    // Diferente da campanha (que confia no status 'ativo' do banco), aqui exigimos
    // um número com socket REALMENTE conectado agora — senão o operador manda no
    // chat e a mensagem morre num número offline sem ninguém perceber.
    let num = null;
    if (whatsapp.isMock()) {
        num = await antiBan.reserveNumber(organizationId, sellerId);
    } else {
        const live = whatsapp.status() || {};
        let connectedNumbers = Object.keys(live).filter(n => live[n] && live[n].status === 'connected');
        if (!connectedNumbers.length) {
            return { sent: false, reason: 'nenhum número de WhatsApp conectado — escaneie o QR em "Meu WhatsApp" e aguarde o status "conectado"' };
        }
        // Respondendo num thread existente: usa o MESMO número nosso que atendeu,
        // se ele ainda estiver conectado.
        if (botNumber && connectedNumbers.includes(String(botNumber))) {
            connectedNumbers = [String(botNumber)];
        }
        const placeholders = connectedNumbers.map(() => '?').join(',');
        const limit = await antiBan.currentLimit();
        num = await db.get(`
            SELECT * FROM bot_numbers
            WHERE organization_id = ? AND status = 'ativo'
              AND (seller_id IS NULL OR seller_id = ?)
              AND number IN (${placeholders})
              AND messages_sent < COALESCE(daily_limit_override, ?)
            ORDER BY messages_sent ASC, id ASC
            LIMIT 1
        `, [organizationId, sellerId, ...connectedNumbers, limit]);
        if (!num) {
            return { sent: false, reason: 'o número conectado atingiu o limite diário de mensagens' };
        }
        // Reserva a cota (mesmo efeito do reserveNumber, mas para este número específico)
        await db.run('UPDATE bot_numbers SET messages_sent = messages_sent + 1, messages_reset_at = date(\'now\') WHERE id = ?', [num.id]);
    }
    if (!num) return { sent: false, reason: 'nenhum número WhatsApp disponível (limite diário atingido ou nenhum ativo)' };

    let result = { sent: false, reason: 'not_connected' };
    let usedPhone = phoneList[0];
    for (const phone of phoneList) {
        const res = await whatsapp.sendMessage(num.number, phone, text, {
            organizationId,
            sellerId,
            leadId: lead.id,
            skipCooldown: true
        });
        if (res.sent) { result = res; usedPhone = phone; break; }
        result = res;
        if (res.reason === 'not_connected') break;
    }

    if (!result.sent) {
        await antiBan.releaseNumber(num.id); // não saiu — devolve a cota reservada
        const reasonMap = {
            not_connected: 'o número de WhatsApp não está conectado (escaneie o QR em "Meu WhatsApp")',
            opt_out: 'este contato está na lista de bloqueio (opt-out)',
            invalid_phone: 'o telefone do lead é inválido',
            no_whatsapp: 'este número não tem WhatsApp (verifiquei com e sem o 9)',
            cooldown: 'aguarde alguns instantes antes de reenviar para este contato'
        };
        return { sent: false, reason: reasonMap[result.reason] || result.reason || 'falha no envio' };
    }

    await db.run(
        `INSERT INTO sends (campaign_id, lead_id, number_id, status, wa_message, sent_at)
         VALUES (NULL, ?, ?, 'sent', ?, datetime('now'))`,
        [lead.id, num.id, text]
    );
    botEvents.log(num.number, 'send_ok', `Manual (chat) ${lead.name} → ${usedPhone}`, num.label);

    if (lead.status === 'novos') {
        await db.run("UPDATE leads SET status = 'enviados', updated_at = datetime('now') WHERE id = ?", [lead.id]);
        try {
            require('./websocket-service').broadcast(organizationId, { type: 'LEAD_UPDATE', lead_id: lead.id, status: 'enviados' });
        } catch (e) { /* ws opcional */ }
    }

    return { sent: true, phone: usedPhone, number: num.number, number_label: num.label || null };
}

async function getAuthorizedCampaign(id, sellerId, role, organizationId) {
    const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', [numId(id)]);
    if (!campaign) { const e = new Error('Campanha não encontrada'); e.status = 404; throw e; }
    if (organizationId !== undefined && campaign.organization_id !== Number(organizationId)) {
        const e = new Error('Acesso negado'); e.status = 403; throw e;
    }
    if (sellerId !== undefined && role !== 'admin' && campaign.seller_id !== Number(sellerId)) {
        const e = new Error('Acesso negado'); e.status = 403; throw e;
    }
    return campaign;
}

async function startCampaign(id, sellerId, role, organizationId) {
    id = numId(id);
    const campaign = await getAuthorizedCampaign(id, sellerId, role, organizationId);
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

            // Anti-ban: só envia para leads quentes (checa antes de reservar número,
            // pra não gastar cota de nenhum bot com lead inelegível)
            if (!antiBan.shouldSend(lead)) {
                await db.run("UPDATE sends SET status = 'falhou' WHERE id = ?", [send.id]);
                progress.falhou++;
                progress.done++;
                continue;
            }

            // Anti-ban: rotação entre números — reserva atomicamente o menos usado hoje
            // (pick + incremento no mesmo UPDATE, sem janela pra outra campanha/follow-up
            // concorrente escolher o mesmo número antes do contador subir)
            const botNumber = await antiBan.reserveNumber(campaign.organization_id || 1, campaign.seller_id);
            if (!botNumber) {
                console.warn(`[campaign] ${campaign.name} — limite diário atingido em todos os números, pausando`);
                const campNum = await db.get('SELECT number, label FROM bot_numbers WHERE id = ?', [campaign.number_id]);
                await botEvents.log(campNum ? campNum.number : 'todos', 'daily_limit', `Limite diário em todos os números — campanha "${campaign.name}" pausada`, campNum ? campNum.label : '');
                await db.run("UPDATE campaigns SET status = 'paused', error = 'daily_limit' WHERE id = ?", [campaign.id]);
                running.delete(campaign.id);
                await jobs.complete(job.id, { status: 'paused', ...progress }).catch(() => {});
                return;
            }
            await db.run('UPDATE sends SET number_id = ? WHERE id = ?', [botNumber.id, send.id]);

            // Proteção Anti-Spam: Trava de Segurança de 7 dias
            const recontactDays = await settings.getNumber('cfg_recontact_days', 7);
            const recentSend = await db.get(`
                SELECT id FROM sends
                WHERE lead_id = ? AND status IN ('sent','confirmado')
                AND datetime(sent_at) >= datetime('now', '-${recontactDays} days')
                AND id != ?
            `, [lead.id, send.id]);

            if (recentSend) {
                console.log(`[campaign] Lead ${lead.name} (#${lead.id}) já recebeu disparo nos últimos ${recontactDays} dias — ignorando envio.`);
                await db.run("UPDATE sends SET status = 'recusado', wa_message = 'Ignorado: Disparo recente nos últimos 7 dias' WHERE id = ?", [send.id]);
                botEvents.log(botNumber.number, 'skip_cooldown', `${lead.name} → ignorado (disparo nos últimos 7 dias)`, botNumber.label);
                progress.done++;
                continue;
            }

            let msg = campaign.message ? personalize(campaign.message, lead) : buildMainMessage(lead);

            // Lista em cascata de telefones cadastrados para o lead (Tel 1 -> Tel 2 -> Tel 3)
            const phoneList = [lead.phone, lead.phone2, lead.phone3].filter(p => p && String(p).trim().length >= 8);
            let sendResult = { sent: false, reason: 'no_phone' };
            let usedPhone = lead.phone;

            for (const currentPhone of phoneList) {
                const res = await whatsapp.sendMessage(botNumber.number, currentPhone, msg, {
                    organizationId: campaign.organization_id,
                    sellerId: campaign.seller_id
                });

                if (res.sent) {
                    sendResult = res;
                    usedPhone = currentPhone;
                    break; // Sucesso! Não precisa tentar os telefones secundários
                } else if (res.reason === 'not_connected') {
                    sendResult = res;
                    break; // Bot offline -> Pausa campanha sem queimar os números
                } else {
                    console.warn(`[campaign] Envio para ${lead.name} (${currentPhone}) falhou (${res.reason || 'erro'}). Tentando próximo telefone se houver...`);
                }
            }

            if (sendResult.sent) {
                await db.run(
                    `UPDATE sends SET status = 'sent', wa_message = ?, sent_at = datetime('now') WHERE id = ?`,
                    [msg, send.id]
                );
                
                // Mover o lead de 'novos' para 'enviados' no funil
                if (lead.status === 'novos') {
                    await db.run("UPDATE leads SET status = 'enviados', updated_at = datetime('now') WHERE id = ?", [lead.id]);
                    const ws = require('./websocket-service');
                    ws.broadcast(campaign.organization_id || 1, { type: 'LEAD_UPDATE', lead_id: lead.id, status: 'enviados' });
                }
                botEvents.log(botNumber.number, 'send_ok', `${lead.name} → ${usedPhone}`, botNumber.label);
                progress.sent++;
            } else {
                await antiBan.releaseNumber(botNumber.id); // não saiu de fato — devolve a cota reservada
                if (sendResult.reason === 'not_connected') {
                    console.warn(`[campaign] ${campaign.name} — bot offline, pausando (auto-resume na reconexão)`);
                    botEvents.log(botNumber.number, 'paused', `Bot offline — campanha "${campaign.name}" pausada`, botNumber.label);
                    await db.run("UPDATE campaigns SET status = 'paused', error = 'not_connected' WHERE id = ?", [campaign.id]);
                    running.delete(campaign.id);
                    await jobs.complete(job.id, { status: 'paused', ...progress }).catch(() => {});
                    return;
                }
                await db.run("UPDATE sends SET status = 'falhou' WHERE id = ?", [send.id]);
                botEvents.log(botNumber.number, 'send_fail', `${lead.name} → falhou em todos os ${phoneList.length} telefones`, botNumber.label);
                progress.done++;
                const ws = require('./websocket-service');
                ws.broadcast('campaign:progress', { campaign_id: campaign.id, sent: progress.sent, total: progress.total || progress.done });
                progress.falhou++;
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

async function pauseCampaign(id, sellerId, role, organizationId) {
    id = numId(id);
    await getAuthorizedCampaign(id, sellerId, role, organizationId);
    running.delete(id);
    await jobs.cancelForRef('campaign_run', id);
    await db.run("UPDATE campaigns SET status = 'paused', error = NULL WHERE id = ?", [id]);
    const updated = await db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
    const ws = require('./websocket-service');
    ws.broadcast('campaign:updated', updated);
    return { paused: true, campaign: updated };
}

async function cancelCampaign(id, sellerId, role, organizationId) {
    id = numId(id);
    await getAuthorizedCampaign(id, sellerId, role, organizationId);
    running.delete(id);
    await jobs.cancelForRef('campaign_run', id);
    await db.run("UPDATE campaigns SET status = 'cancelled', error = NULL WHERE id = ?", [id]);
    const updated = await db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
    const ws = require('./websocket-service');
    ws.broadcast('campaign:updated', updated);
    return { cancelled: true, campaign: updated };
}

async function resetCampaign(id, sellerId, role, organizationId) {
    id = numId(id);
    await getAuthorizedCampaign(id, sellerId, role, organizationId);
    running.delete(id);
    await jobs.cancelForRef('campaign_run', id);
    await db.run("UPDATE sends SET status = 'pending' WHERE campaign_id = ?", [id]);
    await db.run("UPDATE campaigns SET status = 'draft', error = NULL, total_sent = 0 WHERE id = ?", [id]);
    const updated = await db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
    const ws = require('./websocket-service');
    ws.broadcast('campaign:updated', updated);
    return { reset: true, campaign: updated };
}

// Reinicia campanhas pausadas por bot offline (chamado quando um bot reconecta)
async function resumePausedFromOffline() {
    const rows = await db.all("SELECT * FROM campaigns WHERE status = 'paused' AND error = 'not_connected'");
    for (const c of rows) {
        await startCampaign(c.id);
        const campNum = await db.get('SELECT number, label FROM bot_numbers WHERE id = ?', [c.number_id]);
        botEvents.log(campNum ? campNum.number : 'todos', 'resume', `Campanha "${c.name}" retomada após reconexão do bot`, campNum ? campNum.label : '');
        console.log(`[campaign] ${c.name} — auto-resume após reconexão do bot`);
    }
    return rows.length;
}

// Reinicia campanhas pausadas por limite diário (chamado quando um número fica disponível)
async function resumePausedFromLimit() {
    const rows = await db.all("SELECT * FROM campaigns WHERE status = 'paused' AND error = 'daily_limit'");
    let resumed = 0;
    for (const c of rows) {
        const available = await antiBan.pickBestNumber();
        if (!available) continue;
        await startCampaign(c.id);
        botEvents.log(available.number, 'resume', `Campanha "${c.name}" retomada após cooldown`, available.label);
        console.log(`[campaign] ${c.name} — auto-resume após cooldown de número`);
        resumed++;
    }
    return resumed;
}

// Reenvia os envios que falharam (falhou/caiu) e reinicia o processamento
async function retryCampaign(id, sellerId, role, organizationId) {
    id = numId(id);
    const campaign = await getAuthorizedCampaign(id, sellerId, role, organizationId);
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
    updateCampaign,
    deleteCampaign,
    sendToLead,
    sendManualToLead,
    countTargets,
    listTargets,
    startCampaign,
    pauseCampaign,
    cancelCampaign,
    resetCampaign,
    retryCampaign,
    resumePausedFromOffline,
    resumePausedFromLimit,
    recoverInterrupted,
    processScheduled,
    TARGETABLE_STATUSES
};
