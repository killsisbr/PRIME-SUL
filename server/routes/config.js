const express = require('express');
const db = require('../database/db');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// GET todas as settings
router.get('/', adminOnly, async (req, res, next) => {
    try {
        const rows = await db.all('SELECT key, value FROM settings');
        const obj = {};
        rows.forEach(r => { obj[r.key] = r.value; });
        res.json(obj);
    } catch (e) { next(e); }
});

// Salvar settings (parcial — upsert)
router.put('/', adminOnly, async (req, res, next) => {
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
router.get('/bot', adminOnly, async (req, res, next) => {
    try {
        const rows = await db.all('SELECT key, value FROM settings WHERE key IN (?, ?, ?)',
            ['bb_cnpj', 'bb_parceiro', 'msg_template']);
        const obj = {};
        rows.forEach(r => { obj[r.key] = r.value; });
        res.json(obj);
    } catch (e) { next(e); }
});

// GET modo operacional de disparo (disponível para todos os usuários autenticados)
router.get('/mode', async (req, res, next) => {
    try {
        const row = await db.get("SELECT value FROM settings WHERE key = 'cfg_disposable_bots_mode'");
        const disposable_bots_mode = row ? row.value !== 'false' : true;
        res.json({
            disposable_bots_mode,
            mode_name: disposable_bots_mode ? 'disposable' : 'direct',
            title: disposable_bots_mode ? 'Modo Híbrido Anti-Ban (Números Descartáveis)' : 'Modo Direto do Vendedor',
            description: disposable_bots_mode
                ? 'O bot descartável institucional realiza o primeiro contato. Quando o lead responde SIM, repassa para o vendedor e libera o bot particular do operador.'
                : 'O vendedor cadastra o lead e já pode disparar imediatamente usando o seu próprio número de WhatsApp (sem passar pelo bot descartável).'
        });
    } catch (e) { next(e); }
});

// POST alternar modo operacional (adminOnly)
router.post('/mode', adminOnly, async (req, res, next) => {
    try {
        const { disposable_bots_mode } = req.body;
        const val = (disposable_bots_mode === false || disposable_bots_mode === 'false' || disposable_bots_mode === 'direct') ? 'false' : 'true';
        await db.run(
            "INSERT INTO settings (key, value) VALUES ('cfg_disposable_bots_mode', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [val]
        );
        res.json({
            ok: true,
            disposable_bots_mode: val === 'true',
            mode_name: val === 'true' ? 'disposable' : 'direct'
        });
    } catch (e) { next(e); }
});

module.exports = router;
