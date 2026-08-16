const express = require('express');
const leadService = require('../services/lead-service');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// Lista leads do vendedor
router.get('/', async (req, res, next) => {
    try {
        const { status, search } = req.query;
        const leads = await leadService.listLeads({ seller_id: req.user.id, status, search });
        res.json(leads);
    } catch (e) { next(e); }
});

// Contadores do painel
router.get('/counts', async (req, res, next) => {
    try {
        res.json(await leadService.countsBySeller(req.user.id));
    } catch (e) { next(e); }
});

// Funil de conversão do vendedor
router.get('/funnel', async (req, res, next) => {
    try {
        res.json(await leadService.funnelBySeller(req.user.id));
    } catch (e) { next(e); }
});

// Cria lead (com regra de duplicidade)
router.post('/', async (req, res, next) => {
    try {
        const { name, phone, city, origem, limite_est } = req.body;
        if (!name || !phone) return res.status(400).json({ error: 'Nome e telefone obrigatórios' });
        const result = await leadService.createLead({
            seller_id: req.user.id,
            name, phone, city, origem, limite_est
        });
        if (result.duplicated) {
            return res.status(409).json({
                error: 'LEAD_JA_CADASTRADO',
                message: 'Lead já cadastrado por outro vendedor',
                owner_id: result.owner_id
            });
        }
        res.status(201).json(result.lead);
    } catch (e) { next(e); }
});

// Detalhe do lead
router.get('/:id', async (req, res, next) => {
    try {
        const lead = await leadService.getLead(req.params.id, req.user.id);
        if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
        res.json(lead);
    } catch (e) { next(e); }
});

// Atualiza status
router.patch('/:id/status', async (req, res, next) => {
    try {
        const { status } = req.body;
        const lead = await leadService.updateStatus(req.params.id, req.user.id, status);
        if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
        res.json(lead);
    } catch (e) { next(e); }
});

module.exports = router;