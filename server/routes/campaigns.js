const express = require('express');
const db = require('../database/db');
const campaignService = require('../services/campaign-service');
const antiBan = require('../services/anti-ban-service');
const settings = require('../services/settings-service');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

const DEFAULT_BATCH = Number(process.env.CAMPAIGN_BATCH_SIZE) || 50;
const DEFAULT_DELAY_MS = Number(process.env.CAMPAIGN_DELAY_MS) || 15000;

// Números descartáveis do bot principal (anti-ban)
router.get('/numbers', async (req, res, next) => {
    try {
        const rows = req.user.role === 'admin'
            ? await db.all('SELECT * FROM bot_numbers WHERE organization_id = ? ORDER BY id DESC', [req.user.organization_id])
            : await db.all('SELECT * FROM bot_numbers WHERE organization_id = ? AND (seller_id IS NULL OR seller_id = ?) ORDER BY seller_id DESC, id DESC', [req.user.organization_id, req.user.id]);
        res.json(req.user.role === 'admin' ? rows : rows.map(n => ({
            id: n.id, number: n.seller_id === req.user.id ? n.number : null,
            label: n.label, status: n.status, messages_sent: n.messages_sent, owned: n.seller_id === req.user.id
        })));
    } catch (e) { next(e); }
});

router.post('/numbers', async (req, res, next) => {
    try {
        const { number, label } = req.body;
        if (!number) return res.status(400).json({ error: 'Número obrigatório' });
        const n = await antiBan.registerNumber(number, label, req.user.organization_id, req.user.role === 'admin' ? null : req.user.id);
        res.status(201).json(n);
    } catch (e) { next(e); }
});

// Atualiza status do número (ativo = reativa, banido = retira de circulação)
router.patch('/numbers/:id', async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!['ativo', 'resfriado', 'banido'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido. Use ativo, resfriado ou banido.' });
        }
        const n = await antiBan.setStatus(req.params.id, status, req.user.organization_id, req.user.role === 'admin' ? undefined : req.user.id);
        if (!n) return res.status(404).json({ error: 'Número não encontrado' });
        res.json(n);
    } catch (e) { next(e); }
});

// Remove número cadastrado
router.delete('/numbers/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const row = await db.get('SELECT * FROM bot_numbers WHERE id = ? AND organization_id = ?' + (req.user.role === 'admin' ? '' : ' AND seller_id = ?'),
            req.user.role === 'admin' ? [id, req.user.organization_id] : [id, req.user.organization_id, req.user.id]);
        if (!row) return res.status(404).json({ error: 'Número não encontrado' });
        await db.run('DELETE FROM bot_numbers WHERE id = ?', [id]);
        res.json({ ok: true, message: 'Número removido com sucesso' });
    } catch (e) { next(e); }
});

// Estimativa de leads que a campanha atingiria com os filtros informados
router.post('/targets/count', async (req, res, next) => {
    try {
        const count = await campaignService.countTargets(req.user.id, req.body || {});
        res.json({ count });
    } catch (e) { next(e); }
});

// Lista os leads reais que a campanha atingiria com os filtros informados
router.post('/targets/list', async (req, res, next) => {
    try {
        const leads = await campaignService.listTargets(req.user.id, req.body || {});
        res.json({ leads });
    } catch (e) { next(e); }
});

// Lista campanhas do vendedor com progresso agregado dos envios
router.get('/', async (req, res, next) => {
    try {
        const rows = await db.all(`
            SELECT c.*,
              COALESCE(s.pending,0)    AS pending,
              COALESCE(s.sent,0)       AS sent,
              COALESCE(s.confirmado,0) AS confirmado,
              COALESCE(s.recusado,0)   AS recusado,
              COALESCE(s.falhou,0)     AS falhou,
              COALESCE(s.sent,0)+COALESCE(s.confirmado,0)+COALESCE(s.recusado,0) AS total_sent,
              COALESCE(s.sent,0)+COALESCE(s.confirmado,0)+COALESCE(s.recusado,0)+COALESCE(s.falhou,0) AS progresso
            FROM campaigns c
            LEFT JOIN (
                SELECT campaign_id,
                  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
                  SUM(CASE WHEN status = 'confirmado' THEN 1 ELSE 0 END) AS confirmado,
                  SUM(CASE WHEN status = 'recusado' THEN 1 ELSE 0 END) AS recusado,
                  SUM(CASE WHEN status IN ('falhou','caiu') THEN 1 ELSE 0 END) AS falhou
                FROM sends
                GROUP BY campaign_id
            ) s ON s.campaign_id = c.id
            WHERE (c.organization_id = ? AND (? = 'admin' OR c.seller_id = ?))
            ORDER BY c.created_at DESC
        `, [req.user.organization_id, req.user.role, req.user.id]);
        res.json({
            campaigns: rows,
            config: {
                batch: await settings.getNumber('cfg_batch', DEFAULT_BATCH),
                delayMs: await settings.getNumber('cfg_delay', DEFAULT_DELAY_MS)
            }
        });
    } catch (e) { next(e); }
});

// Cria campanha
router.post('/', async (req, res, next) => {
    try {
        const { name, message, number_ids, filters, scheduled_at, lead_ids, template_id } = req.body;
        if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
        const campaign = await campaignService.createCampaign({
            seller_id: req.user.id,
            organization_id: req.user.organization_id,
            name,
            message,
            number_ids: number_ids || [],
            filters: filters || {},
            scheduled_at: scheduled_at || null,
            lead_ids: Array.isArray(lead_ids) ? lead_ids : null,
            template_id: template_id ? Number(template_id) : null
        });
        res.status(201).json(campaign);
    } catch (e) { next(e); }
});

// Edita nome/mensagem (bloqueado enquanto a campanha está rodando)
router.put('/:id', async (req, res, next) => {
    try {
        const { name, message } = req.body;
        const campaign = await campaignService.updateCampaign(req.params.id, { name, message }, req.user.id, req.user.role, req.user.organization_id);
        res.json(campaign);
    } catch (e) { next(e); }
});

// Exclui campanha (bloqueado enquanto está rodando)
router.delete('/:id', async (req, res, next) => {
    try {
        await campaignService.deleteCampaign(req.params.id, req.user.id, req.user.role, req.user.organization_id);
        res.json({ ok: true });
    } catch (e) { next(e); }
});

// Inicia campanha
router.post('/:id/start', async (req, res, next) => {
    try {
        const result = await campaignService.startCampaign(req.params.id, req.user.id, req.user.role, req.user.organization_id);
        res.json(result);
    } catch (e) { next(e); }
});

router.post('/:id/pause', async (req, res, next) => {
    try {
        await campaignService.pauseCampaign(req.params.id, req.user.id, req.user.role, req.user.organization_id);
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.post('/:id/cancel', async (req, res, next) => {
    try {
        await campaignService.cancelCampaign(req.params.id, req.user.id, req.user.role, req.user.organization_id);
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.post('/:id/reset', async (req, res, next) => {
    try {
        const result = await campaignService.resetCampaign(req.params.id, req.user.id, req.user.role, req.user.organization_id);
        res.json(result);
    } catch (e) { next(e); }
});

// Reenvia os envios que falharam
router.post('/:id/retry', async (req, res, next) => {
    try {
        const result = await campaignService.retryCampaign(req.params.id, req.user.id, req.user.role, req.user.organization_id);
        res.json(result);
    } catch (e) { next(e); }
});

module.exports = router;
