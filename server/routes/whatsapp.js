const express = require('express');
const QRCode = require('qrcode');
const db = require('../database/db');
const whatsapp = require('../services/whatsapp-service');
const antiBan = require('../services/anti-ban-service');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// Status completo: configuração, bots conectados e números anti-ban
router.get('/status', async (req, res, next) => {
    try {
        await antiBan.ensureFresh();
        const numbers = req.user.role === 'admin'
            ? await db.all('SELECT * FROM bot_numbers WHERE organization_id = ? ORDER BY id DESC', [req.user.organization_id])
            : await db.all('SELECT * FROM bot_numbers WHERE organization_id = ? AND seller_id = ? ORDER BY id DESC', [req.user.organization_id, req.user.id]);
        const bots = whatsapp.status();
        const visibleBots = req.user.role === 'admin' ? bots : Object.fromEntries(numbers.map(n => [n.number, bots[n.number]]).filter(([, b]) => b));
        const now = new Date().toISOString();
        res.json({
            enabled: whatsapp.enabled(),
            cooldown_hours: await antiBan.currentCooldownHours(),
            daily_limit: await antiBan.currentLimit(),
            bots: visibleBots,
            numbers: numbers.map(n => ({
                ...n,
                connection: bots[n.number]?.status || 'offline',
                waitingQr: bots[n.number]?.waitingQr || false,
                cooled_expired: n.cooled_until ? n.cooled_until <= now : false
            }))
        });
    } catch (e) { next(e); }
});

// Conecta um bot (inicia sessão / aguarda QR)
router.post('/connect', async (req, res, next) => {
    try {
        const { number, label } = req.body;
        if (!number) return res.status(400).json({ error: 'Número obrigatório' });
        const registered = await antiBan.registerNumber(number, label, req.user.organization_id, req.user.role === 'admin' ? null : req.user.id);
        if (req.user.role !== 'admin' && registered.seller_id !== req.user.id) return res.status(403).json({ error: 'Número não pertence ao operador' });
        if (!whatsapp.enabled()) {
            return res.json({ ok: true, number, status: 'queued', message: 'Número cadastrado. Ative BOT_ENABLED no .env e reinicie para conectar.' });
        }
        await whatsapp.connect(number, label);
        res.json({ ok: true, number, status: 'connecting' });
    } catch (e) { next(e); }
});

// QR code atual do bot (PNG base64) — nulo se não houver aguardando scan
router.get('/qr', async (req, res, next) => {
    try {
        const { number } = req.query;
        if (!number) return res.status(400).json({ error: 'Parâmetro number obrigatório' });
        const owned = await db.get('SELECT id FROM bot_numbers WHERE organization_id=? AND number=?' + (req.user.role === 'admin' ? '' : ' AND seller_id=?'),
            req.user.role === 'admin' ? [req.user.organization_id, number] : [req.user.organization_id, number, req.user.id]);
        if (!owned) return res.status(403).json({ error: 'Número não pertence ao operador' });
        const qr = whatsapp.getQR(number);
        if (!qr) return res.json({ qr: null, status: whatsapp.status()[number]?.status || 'offline' });
        const dataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 300 });
        res.json({ qr: dataUrl, status: 'connecting' });
    } catch (e) { next(e); }
});

// Desconecta / encerra sessão de um bot
router.post('/disconnect', async (req, res, next) => {
    try {
        const { number, removeSession } = req.body;
        if (!number) return res.status(400).json({ error: 'Número obrigatório' });
        const owned = await db.get('SELECT id FROM bot_numbers WHERE organization_id=? AND number=?' + (req.user.role === 'admin' ? '' : ' AND seller_id=?'),
            req.user.role === 'admin' ? [req.user.organization_id, number] : [req.user.organization_id, number, req.user.id]);
        if (!owned) return res.status(403).json({ error: 'Número não pertence ao operador' });
        const result = removeSession
            ? await whatsapp.logout(number)
            : await whatsapp.disconnect(number);
        res.json(result);
    } catch (e) { next(e); }
});

module.exports = router;
