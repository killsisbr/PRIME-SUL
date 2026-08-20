const express = require('express');
const db = require('../database/db');
const botEvents = require('../services/bot-events-service');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// null = sem restrição (admin vê a timeline de todos os bots).
// array = vendedor só vê a timeline dos próprios números.
async function allowedNumbers(req) {
    if (req.user.role === 'admin') return null;
    const rows = await db.all('SELECT number FROM bot_numbers WHERE organization_id = ? AND seller_id = ?', [req.user.organization_id, req.user.id]);
    return rows.map(r => r.number);
}

// Timeline de eventos dos bots de disparo
router.get('/timeline', async (req, res, next) => {
    try {
        const { number, type, since, limit } = req.query;
        const numbers = await allowedNumbers(req);
        const events = await botEvents.list({
            number,
            type,
            since,
            limit: Math.min(Math.max(Number(limit) || 200, 1), 1000),
            numbers
        });
        res.json(events);
    } catch (e) { next(e); }
});

// Totais agregados (cabeçalho do módulo)
router.get('/totals', async (req, res, next) => {
    try {
        res.json(await botEvents.totals({ numbers: await allowedNumbers(req) }));
    } catch (e) { next(e); }
});

module.exports = router;