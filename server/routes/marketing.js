const express = require('express');
const marketing = require('../services/marketing-service');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.get('/posts', adminOnly, async (req, res, next) => {
    try { res.json(await marketing.list()); } catch (e) { next(e); }
});

router.post('/posts', adminOnly, async (req, res, next) => {
    try { res.json(await marketing.create(req.body)); } catch (e) { next(e); }
});

router.put('/posts/:id', adminOnly, async (req, res, next) => {
    try { res.json(await marketing.update(Number(req.params.id), req.body)); } catch (e) { next(e); }
});

router.delete('/posts/:id', adminOnly, async (req, res, next) => {
    try { await marketing.remove(Number(req.params.id)); res.json({ ok: true }); } catch (e) { next(e); }
});

router.post('/posts/:id/send-now', adminOnly, async (req, res, next) => {
    try { res.json(await marketing.sendNow(Number(req.params.id))); } catch (e) { next(e); }
});

module.exports = router;