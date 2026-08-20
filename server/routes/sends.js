const express = require('express');
const db = require('../database/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

const settings = require('../services/settings-service');

// Retorna IDs de todos os leads agendados OU que receberam mensagem nos últimos 7 dias
router.get('/scheduled-lead-ids', async (req, res, next) => {
    try {
        const recontactDays = await settings.getNumber('cfg_recontact_days', 7);
        const rows = await db.all(`
            SELECT DISTINCT s.lead_id
            FROM sends s
            LEFT JOIN campaigns c ON c.id = s.campaign_id
            WHERE s.status = 'pending'
               OR c.status IN ('draft', 'running')
               OR (s.status IN ('sent', 'confirmado') AND datetime(s.sent_at) >= datetime('now', '-${recontactDays} days'))
        `);
        const scheduledIds = rows.map(r => r.lead_id).filter(Boolean);
        res.json({ scheduled_lead_ids: scheduledIds });
    } catch (e) { next(e); }
});

// Retorna envios/mensagens de disparo por lead
router.get('/', async (req, res, next) => {
    try {
        const leadId = req.query.lead_id;
        if (!leadId) {
            const rows = await db.all('SELECT * FROM sends ORDER BY id DESC LIMIT 100');
            return res.json(rows);
        }
        const rows = await db.all('SELECT * FROM sends WHERE lead_id = ? ORDER BY id ASC', [leadId]);
        res.json(rows);
    } catch (e) { next(e); }
});

module.exports = router;
