const db = require('../database/db');
const antiBan = require('./anti-ban-service');
const settings = require('./settings-service');
const whatsapp = require('./whatsapp-service');

const DEFAULT_BATCH = Number(process.env.CAMPAIGN_BATCH_SIZE) || 50;
const DEFAULT_DELAY_MS = Number(process.env.CAMPAIGN_DELAY_MS) || 15000;

const running = new Set();

// Message de entrada do bot principal (anti-ban): pergunta se pode encaminhar a simulação
function buildMainMessage(lead) {
    const tmpl = process.env.BOT_MAIN_WELCOME ||
        'Olá {nome}! Aqui é a Prime Sul. Você pediu uma simulação de crédito. Posso pedir para um vendedor encaminhar a simulação? Responda SIM para continuar.';
    return tmpl.replace('{nome}', lead.name.split(' ')[0]);
}

async function createCampaign({ seller_id, name, message, number_ids }) {
    const numbers = await db.all(
        `SELECT * FROM bot_numbers WHERE id IN (${number_ids.map(() => '?').join(',')}) AND status = 'ativo'`,
        number_ids
    );
    if (!numbers.length) throw new Error('Nenhum número ativo disponível');

    // Seleciona leads quentes do vendedor que ainda não foram disparados
    const targets = await db.all(`
        SELECT l.* FROM leads l
        WHERE l.seller_id = ?
          AND l.status IN ('novo','contato')
          AND NOT EXISTS (
            SELECT 1 FROM sends s WHERE s.lead_id = l.id AND s.campaign_id IS NOT NULL
          )
        ORDER BY l.created_at ASC
    `, [seller_id]);

    const result = await db.run(
        `INSERT INTO campaigns (seller_id, number_id, name, message, status, total_target)
         VALUES (?, ?, ?, ?, 'draft', ?)`,
        [seller_id, numbers[0].id, name, message || buildMainMessage({ name: 'Cliente' }), targets.length]
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
    const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (!campaign) throw new Error('Campanha não encontrada');
    if (running.has(id)) return { started: true, message: 'Já em execução' };
    if (campaign.status === 'done' || campaign.status === 'cancelled') return { started: false };

    running.add(id);
    await db.run("UPDATE campaigns SET status = 'running' WHERE id = ?", [id]);
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

        // Anti-ban: respeita limite do número
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
                console.warn('[campaign] Bot offline — pausando campanha');
                await db.run("UPDATE campaigns SET status = 'paused' WHERE id = ?", [campaign.id]);
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
        await db.run("UPDATE campaigns SET status = 'done' WHERE id = ?", [campaign.id]);
        console.log(`[campaign] ${campaign.name} — concluída`);
        running.delete(campaign.id);
    }
}

function pauseCampaign(id) {
    running.delete(id);
    return db.run("UPDATE campaigns SET status = 'paused' WHERE id = ?", [id]);
}

function cancelCampaign(id) {
    running.delete(id);
    return db.run("UPDATE campaigns SET status = 'cancelled' WHERE id = ?", [id]);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = { createCampaign, startCampaign, pauseCampaign, cancelCampaign, buildMainMessage };