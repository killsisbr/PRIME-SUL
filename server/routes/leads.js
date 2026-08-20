const express = require('express');
const leadService = require('../services/lead-service');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// Lista leads do vendedor (com filtros avançados)
router.get('/', async (req, res, next) => {
    try {
        const { status, search, origem, prioridade, tag, cidade, data_de, data_ate, score_min, score_max } = req.query;
        const leads = await leadService.listLeads({
            seller_id: req.user.id,
            status, search, origem, prioridade, tag, cidade, data_de, data_ate, score_min, score_max
        });
        res.json(leads);
    } catch (e) { next(e); }
});

// Lista leads de um vendedor específico por estágio (admin)
router.get('/by-seller/:sellerId', adminOnly, async (req, res, next) => {
    try {
        const { status, search, origem, prioridade, tag, cidade, data_de, data_ate, score_min, score_max } = req.query;
        const leads = await leadService.listLeads({
            seller_id: Number(req.params.sellerId),
            status, search, origem, prioridade, tag, cidade, data_de, data_ate, score_min, score_max
        });
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
        const { name, phone, cpf, tags, city, origem, limite_est, renda, valor_desejado, obs, prioridade } = req.body;
        if (!name || !phone) return res.status(400).json({ error: 'Nome e telefone obrigatórios' });
        const result = await leadService.createLead({
            seller_id: req.user.id,
            organization_id: req.user.organization_id,
            name, phone, cpf, tags, city, origem, limite_est, renda, valor_desejado, obs, prioridade
        });
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

// Histórico de status do lead (timeline)
router.get('/:id/history', async (req, res, next) => {
    try {
        const lead = await leadService.getLead(req.params.id, req.user.id);
        if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
        res.json(await leadService.getHistory(req.params.id, req.user.id));
    } catch (e) { next(e); }
});

// Atualiza dados do lead (edição)
router.patch('/:id', async (req, res, next) => {
    try {
        const lead = await leadService.updateLead(req.params.id, req.user.id, req.body);
        if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
        res.json(lead);
    } catch (e) { next(e); }
});

// Adiciona/atualiza anotação rápida do lead
router.post('/:id/notes', async (req, res, next) => {
    try {
        const rawNote = (req.body.note ?? req.body.obs ?? req.body.text ?? '').trim();
        if (!rawNote) return res.status(400).json({ error: 'Anotação não pode estar vazia' });

        const existingLead = await leadService.getLeadById(req.params.id, req.user.id);
        if (!existingLead) return res.status(404).json({ error: 'Lead não encontrado' });

        const timestamp = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const newEntry = `[${timestamp}] ${rawNote}`;

        const updatedObs = existingLead.obs ? `${newEntry}\n${existingLead.obs}` : newEntry;

        const lead = await leadService.updateLead(req.params.id, req.user.id, { obs: updatedObs });
        res.json(lead);
    } catch (e) { next(e); }
});

// Transferência de lead para outro vendedor (somente admin)
router.post('/:id/transfer', adminOnly, async (req, res, next) => {
    try {
        const { to_seller_id } = req.body;
        if (!to_seller_id) return res.status(400).json({ error: 'Vendedor de destino obrigatório' });
        const result = await leadService.transferLead(req.params.id, {
            to_seller_id,
            admin_id: req.user.id,
            organization_id: req.user.organization_id
        });
        if (!result) return res.status(404).json({ error: 'Lead não encontrado' });
        res.json(result);
    } catch (e) { next(e); }
});

// Atualiza status (kanban / ações rápidas)
router.patch('/:id/status', async (req, res, next) => {
    try {
        const { status } = req.body;
        const lead = await leadService.updateStatus(req.params.id, req.user.id, status);
        if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
        res.json(lead);
    } catch (e) { next(e); }
});

module.exports = router;
