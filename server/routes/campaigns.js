const express = require('express');
const db = require('../database/db');
const campaignService = require('../services/campaign-service');
const antiBan = require('../services/anti-ban-service');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// Números descartáveis do bot principal (anti-ban)
router.get('/numbers', async (req, res, next) => {
    try {
        const rows = await db.all('SELECT * FROM bot_numbers ORDER BY id DESC');
        res.json(rows);
    } catch (e) { next(e); }
});

router.post('/numbers', async (req, res, next) => {
    try {
        const { number, label } = req.body;
        if (!number) return res.status(400).json({ error: 'Número obrigatório' });
        const n = await antiBan.registerNumber(number, label);
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
        const n = await antiBan.setStatus(req.params.id, status);
        if (!n) return res.status(404).json({ error: 'Número não encontrado' });
        res.json(n);
    } catch (e) { next(e); }
});

// Lista campanhas do vendedor
router.get('/', async (req, res, next) => {
    try {
        const rows = await db.all(
            'SELECT * FROM campaigns WHERE seller_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (e) { next(e); }
});

// Cria campanha
router.post('/', async (req, res, next) => {
    try {
        const { name, message, number_ids } = req.body;
        if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
        const campaign = await campaignService.createCampaign({
            seller_id: req.user.id,
            name,
            message,
            number_ids: number_ids || []
        });
        res.status(201).json(campaign);
    } catch (e) { next(e); }
});

// Inicia campanha
router.post('/:id/start', async (req, res, next) => {
    try {
        const result = await campaignService.startCampaign(req.params.id);
        res.json(result);
    } catch (e) { next(e); }
});

router.post('/:id/pause', async (req, res, next) => {
    try {
        await campaignService.pauseCampaign(req.params.id);
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.post('/:id/cancel', async (req, res, next) => {
    try {
        await campaignService.cancelCampaign(req.params.id);
        res.json({ ok: true });
    } catch (e) { next(e); }
});

module.exports = router;