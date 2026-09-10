const express = require('express');
const leadService = require('../services/lead-service');
const messageService = require('../services/message-service');
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
        // Resumo de conversas (tag de WhatsApp / não lidas) por lead
        try {
            const summary = await messageService.summaryForLeads(leads.map(l => l.id));
            for (const l of leads) {
                const s = summary[l.id];
                const phones = [l.phone, l.phone2, l.phone3].filter(Boolean).length;
                l.wa = {
                    has_chat: !!s && s.total > 0,
                    unread: s ? s.unread : 0,
                    threads: s ? s.threads : 0,
                    phones,
                    last_at: s ? s.last_at : null
                };
            }
        } catch (e) { /* resumo é acessório */ }
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

// Caixa de entrada do lead: conversas agrupadas por thread (número do cliente + bot)
router.get('/:id/conversations', async (req, res, next) => {
    try {
        const lead = await leadService.getLead(req.params.id, req.user.id);
        if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
        const data = await messageService.conversationsForLead(lead.id);
        // Números do lead que ainda não têm thread — pra UI oferecer "iniciar conversa"
        const { phoneKey } = require('../utils/phone');
        const known = new Set(data.threads.map(t => t.lead_phone));
        const extra = [
            { phone: lead.phone, label: 'Telefone 1' },
            { phone: lead.phone2, label: 'Telefone 2' },
            { phone: lead.phone3, label: 'Telefone 3' }
        ].filter(p => p.phone && !known.has(phoneKey(p.phone)))
         .map(p => ({ lead_phone: phoneKey(p.phone), phone_label: p.label, messages: [], unread: 0, last_at: null, bot_number: null }));
        res.json({ ...data, threads: [...data.threads, ...extra] });
    } catch (e) { next(e); }
});

// Marca mensagens de entrada como lidas (thread específico ou lead inteiro)
router.post('/:id/conversations/read', async (req, res, next) => {
    try {
        const lead = await leadService.getLead(req.params.id, req.user.id);
        if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
        const changed = await messageService.markRead(lead.id, {
            leadPhone: req.body.lead_phone || null,
            botNumber: req.body.bot_number || null
        });
        res.json({ ok: true, marked: changed });
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

        const existingLead = await leadService.getLead(req.params.id, req.user.id);
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
