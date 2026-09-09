const express = require('express');
const db = require('../database/db');
const handoffService = require('../services/handoff-service');
const { auth } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// Lista handoffs da organização / vendedor
router.get('/', async (req, res, next) => {
    try {
        const params = [req.user.organization_id];
        let where = 'h.organization_id=?';
        if (req.user.role !== 'admin') {
            where += ' AND h.seller_id=?';
            params.push(req.user.id);
        }
        const rows = await db.all(`SELECT h.*, l.name AS lead_name, l.phone, sn.number AS seller_number, sn.label AS seller_number_label
            FROM handoffs h JOIN leads l ON l.id=h.lead_id
            LEFT JOIN seller_numbers sn ON sn.id=h.seller_number_id
            WHERE ${where} ORDER BY h.id DESC LIMIT 200`, params);
        res.json(rows);
    } catch (e) { next(e); }
});

// Consulta status do handoff de um lead específico
router.get('/status/:leadId', async (req, res, next) => {
    try {
        const leadId = Number(req.params.leadId);
        const params = [leadId, req.user.organization_id];
        let where = 'h.lead_id = ? AND h.organization_id = ?';
        if (req.user.role !== 'admin') {
            where += ' AND h.seller_id = ?';
            params.push(req.user.id);
        }
        const row = await db.get(`
            SELECT h.*, sn.number AS seller_number, sn.label AS seller_number_label, l.name AS lead_name, l.phone
            FROM handoffs h
            JOIN leads l ON l.id = h.lead_id
            LEFT JOIN seller_numbers sn ON sn.id = h.seller_number_id
            WHERE ${where}
            ORDER BY h.id DESC LIMIT 1
        `, params);
        res.json(row || { status: 'none' });
    } catch (e) { next(e); }
});

// Dispara mensagem pelo bot do vendedor para o lead diretamente (atalho por leadId)
router.post('/lead/:leadId/send', async (req, res, next) => {
    try {
        const leadId = Number(req.params.leadId);
        const { message, number_id } = req.body || {};
        const lead = await db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
        if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
        if (req.user.role !== 'admin' && lead.seller_id !== req.user.id) {
            return res.status(403).json({ error: 'Lead pertence a outro vendedor' });
        }

        const result = await handoffService.sendSellerHandoffNow(leadId, lead.seller_id, message, number_id);
        res.json(result);
    } catch (e) { next(e); }
});

// Dispara mensagem pelo bot do vendedor para um handoff específico
router.post('/:id/send', async (req, res, next) => {
    try {
        const handoffId = Number(req.params.id);
        const handoff = await db.get('SELECT * FROM handoffs WHERE id = ?', [handoffId]);
        if (!handoff) return res.status(404).json({ error: 'Handoff não encontrado' });
        if (req.user.role !== 'admin' && handoff.seller_id !== req.user.id) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const { message, number_id } = req.body || {};
        const result = await handoffService.sendSellerHandoffNow(handoff.lead_id, handoff.seller_id, message, number_id);
        res.json(result);
    } catch (e) { next(e); }
});

// Consulta preferência de auto-disparo do vendedor
router.get('/config', async (req, res, next) => {
    try {
        const enabled = await handoffService.isAutoHandoffEnabled(req.user.id, req.user.organization_id);
        res.json({ seller_id: req.user.id, auto_handoff: enabled });
    } catch (e) { next(e); }
});

// Salva preferência de auto-disparo do vendedor
router.put('/config', async (req, res, next) => {
    try {
        const { auto_handoff } = req.body || {};
        const result = await handoffService.setAutoHandoff(req.user.id, req.user.organization_id, !!auto_handoff);
        res.json(result);
    } catch (e) { next(e); }
});

module.exports = router;
