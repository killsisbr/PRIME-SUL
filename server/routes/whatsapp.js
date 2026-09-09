const express = require('express');
const QRCode = require('qrcode');
const db = require('../database/db');
const whatsapp = require('../services/whatsapp-service');
const antiBan = require('../services/anti-ban-service');
const settings = require('../services/settings-service');
const { auth, adminOnly } = require('../middleware/auth');
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
            envEnabled: whatsapp.envEnabled(),
            runtimeEnabled: whatsapp.isRuntimeEnabled(),
            isMock: whatsapp.isMock(),
            cooldown_hours: await antiBan.currentCooldownHours(),
            daily_limit: await antiBan.currentLimit(),
            bots: visibleBots,
            wa_slots_limit: await settings.getNumber('cfg_wa_slots', 2),
            numbers: numbers.map(n => ({
                ...n,
                connection: bots[n.number]?.status || 'offline',
                waitingQr: bots[n.number]?.waitingQr || false,
                realNumber: bots[n.number]?.realNumber || n.real_number || null,
                pushName: bots[n.number]?.pushName || n.push_name || null,
                cooled_expired: n.cooled_until ? n.cooled_until <= now : false
            }))
        });
    } catch (e) { next(e); }
});

// Pausa/retoma os bots em runtime (sem precisar reiniciar o servidor). Admin apenas —
// é um controle de todo o ambiente, não só do vendedor que está na tela.
router.post('/toggle', adminOnly, async (req, res, next) => {
    try {
        const value = !!req.body.enabled;
        await db.run(
            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            ['cfg_bot_enabled', value ? 'true' : 'false']
        );
        whatsapp.setRuntimeEnabled(value);
        res.json({ enabled: whatsapp.enabled(), envEnabled: whatsapp.envEnabled(), runtimeEnabled: whatsapp.isRuntimeEnabled() });
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

// Conecta um slot fixo (sem digitar número) — cada organização/vendedor tem
// direito a `cfg_wa_slots` WhatsApp (padrão 2); o telefone real só é conhecido
// depois do scan do QR.
router.post('/slots/:index/connect', async (req, res, next) => {
    try {
        const index = Number(req.params.index);
        const limit = await settings.getNumber('cfg_wa_slots', 2);
        if (!Number.isInteger(index) || index < 1 || index > limit) {
            return res.status(400).json({ error: `Slot inválido (disponíveis: 1 a ${limit})` });
        }
        const organizationId = req.user.organization_id;
        const sellerId = req.user.role === 'admin' ? null : req.user.id;
        const row = await antiBan.registerSlot(organizationId, sellerId, index, `WhatsApp ${index}`);
        if (!whatsapp.enabled()) {
            return res.json({ ok: true, number: row.number, status: 'queued', message: 'Ative BOT_ENABLED no .env e reinicie para conectar.' });
        }
        await whatsapp.connect(row.number, row.label);
        res.json({ ok: true, number: row.number, status: 'connecting' });
    } catch (e) { next(e); }
});

// Ajusta o limite diário de UM número específico (admin apenas) — null/vazio
// remove o override e volta a usar o limite global (cfg_daily_limit).
router.patch('/numbers/:id/limit', adminOnly, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const n = await antiBan.setDailyLimitOverride(id, req.user.organization_id, req.body.daily_limit_override);
        if (!n) return res.status(404).json({ error: 'Número não encontrado' });
        res.json(n);
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

// Simulação de resposta de cliente (apenas com MOCK_WHATSAPP=true)
router.post('/mock-incoming', async (req, res, next) => {
    try {
        if (!whatsapp.isMock()) {
            return res.status(400).json({ error: 'Modo simulação desativado no servidor' });
        }
        const { phone, text, botNumber } = req.body;
        if (!phone || !text) return res.status(400).json({ error: 'phone e text são obrigatórios' });
        const targetBot = botNumber || process.env.BOT_MAIN_NUMBER || '5511999990000';
        const results = await whatsapp.simulateIncomingMessage(phone, text, targetBot);
        res.json({ ok: true, phone, text, botNumber: targetBot, results });
    } catch (e) { next(e); }
});

module.exports = router;
