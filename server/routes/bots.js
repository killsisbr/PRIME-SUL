const express = require('express');
const botEvents = require('../services/bot-events-service');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// Timeline de eventos dos bots de disparo
router.get('/timeline', adminOnly, async (req, res, next) => {
    try {
        const { number, type, since, limit } = req.query;
        const events = await botEvents.list({
            number,
            type,
            since,
            limit: Math.min(Math.max(Number(limit) || 200, 1), 1000)
        });
        res.json(events);
    } catch (e) { next(e); }
});

// Totais agregados (cabeçalho do módulo)
router.get('/totals', adminOnly, async (req, res, next) => {
    try {
        res.json(await botEvents.totals());
    } catch (e) { next(e); }
});

module.exports = router;