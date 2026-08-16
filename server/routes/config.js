const express = require('express');
const db = require('../database/db');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// GET todas as settings
router.get('/', async (req, res, next) => {
    try {
        const rows = await db.all('SELECT key, value FROM settings');
        const obj = {};
        rows.forEach(r => { obj[r.key] = r.value; });
        res.json(obj);
    } catch (e) { next(e); }
});

// Salvar settings (parcial — upsert)
router.put('/', async (req, res, next) => {
    try {
        const entries = req.body;
        for (const [key, value] of Object.entries(entries)) {
            await db.run(
                'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
                [key, String(value ?? '')]
            );
        }
        res.json({ ok: true });
    } catch (e) { next(e); }
});

// GET settings padrão do bot (parceira BB) — admin
router.get('/bot', async (req, res, next) => {
    try {
        const rows = await db.all('SELECT key, value FROM settings WHERE key IN (?, ?, ?)',
            ['bb_cnpj', 'bb_parceiro', 'msg_template']);
        const obj = {};
        rows.forEach(r => { obj[r.key] = r.value; });
        res.json(obj);
    } catch (e) { next(e); }
});

module.exports = router;