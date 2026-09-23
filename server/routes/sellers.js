const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { auth, adminOnly } = require('../middleware/auth');
const { normalizePhone } = require('../utils/phone');
const whatsapp = require('../services/whatsapp-service');
const antiBan = require('../services/anti-ban-service');
const campaignService = require('../services/campaign-service');
const QRCode = require('qrcode');
const router = express.Router();

router.use(auth);

// Lista vendedores (admin)
router.get('/', adminOnly, async (req, res, next) => {
    try {
        const rows = await db.all(`
            SELECT s.id, s.name, s.email, s.phone, s.role, s.active, s.max_leads, s.created_at,
                   (SELECT COUNT(*) FROM leads l WHERE l.seller_id = s.id) AS total_leads
            FROM sellers s WHERE s.organization_id = ? ORDER BY s.created_at DESC
        `, [req.user.organization_id]);
        res.json(rows);
    } catch (e) { next(e); }
});

// Relatório de performance por vendedor (admin): funil real de leads (novo/contato/
// confirmado/concluido/bloqueado — os status que existem de fato no schema; a versão
// anterior desse endpoint usava estágios de um funil diferente que nunca existiu aqui
// e sempre voltava zerado), envios/resposta/conversão e números WhatsApp ativos.
router.get('/with-stats', adminOnly, async (req, res, next) => {
    try {
        const rows = await db.all(`
            SELECT s.id, s.name, s.email, s.phone, s.role, s.active, s.max_leads,
                   (SELECT COUNT(*) FROM leads l WHERE l.seller_id = s.id) AS total_leads,
                   (SELECT COUNT(*) FROM leads l WHERE l.seller_id = s.id AND l.status = 'novos') AS novos,
                   (SELECT COUNT(*) FROM leads l WHERE l.seller_id = s.id AND l.status = 'enviados') AS enviados,
                   (SELECT COUNT(*) FROM leads l WHERE l.seller_id = s.id AND l.status = 'sim') AS sim,
                   (SELECT COUNT(*) FROM leads l WHERE l.seller_id = s.id AND l.status = 'nao') AS nao,
                   (SELECT COUNT(*) FROM leads l WHERE l.seller_id = s.id AND l.status = 'bloqueado') AS bloqueado,
                   (SELECT COUNT(sd.id) FROM sends sd JOIN leads l2 ON l2.id = sd.lead_id
                        WHERE l2.seller_id = s.id AND sd.status IN ('sent','confirmado','recusado')) AS total_sends,
                   (SELECT COUNT(sd.id) FROM sends sd JOIN leads l2 ON l2.id = sd.lead_id
                        WHERE l2.seller_id = s.id AND sd.status IN ('confirmado','recusado')) AS responded,
                   (SELECT COUNT(*) FROM bot_numbers bn WHERE bn.seller_id = s.id AND bn.status = 'ativo') AS active_numbers
            FROM sellers s WHERE s.organization_id = ? AND s.role != 'admin' ORDER BY s.name
        `, [req.user.organization_id]);
        res.json(rows.map(r => ({
            ...r,
            response_rate: r.total_sends ? Math.round((r.responded / r.total_sends) * 1000) / 10 : 0,
            conversion_rate: r.total_leads ? Math.round((r.sim / r.total_leads) * 1000) / 10 : 0
        })));
    } catch (e) { next(e); }
});

// Cria vendedor (admin)
router.post('/', adminOnly, async (req, res, next) => {
    try {
        const { name, email, password, phone, max_leads } = req.body;
        if (!name || !email || !password || !phone) return res.status(400).json({ error: 'Dados incompletos' });
        const normalized = normalizePhone(phone);
        const existing = await db.get('SELECT id FROM sellers WHERE organization_id = ? AND (email = ? OR phone = ?)', [req.user.organization_id, email.toLowerCase().trim(), normalized]);
        if (existing) return res.status(409).json({ error: 'E-mail ou telefone já em uso' });
        const hash = await bcrypt.hash(password, 10);
        const result = await db.run(
            'INSERT INTO sellers (organization_id, name, email, password, phone, max_leads) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.organization_id, name.trim(), email.toLowerCase().trim(), hash, normalized, max_leads || 0]
        );
        await db.run('INSERT INTO seller_numbers (organization_id, seller_id, number, label) VALUES (?, ?, ?, ?)',
            [req.user.organization_id, result.lastID, normalized, 'principal']);
        res.status(201).json({ id: result.lastID });
    } catch (e) { next(e); }
});

// Meus dados / perfil
router.get('/me', async (req, res, next) => {
    try {
        const user = await db.get('SELECT id, name, email, phone, role, max_leads, bot_campaign_msg, bot_attendance_msg FROM sellers WHERE id = ?', [req.user.id]);
        if (!user) return res.status(404).json({ error: 'Vendedor não encontrado' });
        res.json(user);
    } catch (e) { next(e); }
});

// Mensagens configuradas do bot de campanha e do bot de atendimento do operador/vendedor
router.get('/me/bot-messages', async (req, res, next) => {
    try {
        const seller = await db.get('SELECT id, name, bot_campaign_msg, bot_attendance_msg FROM sellers WHERE id = ?', [req.user.id]);
        if (!seller) return res.status(404).json({ error: 'Vendedor não encontrado' });

        const defaultCampaignMsg = process.env.BOT_MAIN_WELCOME ||
            'Olá {primeiro-nome}! Aqui é a Prime Sul. Você pediu uma simulação de crédito. Posso pedir para um vendedor encaminhar a simulação? Responda SIM para continuar.';
        const defaultAttendanceMsg = process.env.BOT_SELLER_WELCOME ||
            'Olá {nome}! Sou {vendedor} da equipe Prime Sul. Recebemos sua confirmação e vou continuar sua simulação de crédito por aqui.';

        res.json({
            bot_campaign_msg: seller.bot_campaign_msg ?? '',
            bot_attendance_msg: seller.bot_attendance_msg ?? '',
            default_campaign_msg: defaultCampaignMsg,
            default_attendance_msg: defaultAttendanceMsg
        });
    } catch (e) { next(e); }
});

router.patch('/me/bot-messages', async (req, res, next) => {
    try {
        const { bot_campaign_msg, bot_attendance_msg } = req.body;
        const updates = [];
        const params = [];

        if (bot_campaign_msg !== undefined) {
            updates.push('bot_campaign_msg = ?');
            params.push(bot_campaign_msg === null ? null : String(bot_campaign_msg).trim());
        }
        if (bot_attendance_msg !== undefined) {
            updates.push('bot_attendance_msg = ?');
            params.push(bot_attendance_msg === null ? null : String(bot_attendance_msg).trim());
        }

        if (!updates.length) {
            return res.status(400).json({ error: 'Nenhum campo fornecido para atualização.' });
        }

        params.push(req.user.id);
        await db.run(`UPDATE sellers SET ${updates.join(', ')} WHERE id = ?`, params);

        const updated = await db.get('SELECT id, name, bot_campaign_msg, bot_attendance_msg FROM sellers WHERE id = ?', [req.user.id]);
        res.json({
            ok: true,
            bot_campaign_msg: updated.bot_campaign_msg ?? '',
            bot_attendance_msg: updated.bot_attendance_msg ?? ''
        });
    } catch (e) { next(e); }
});

router.get('/me/bot-setup', async (req, res, next) => {
    try {
        const setup = await campaignService.getSellerBotSetup(req.user.organization_id || 1, req.user.id);
        res.json({
            ready: setup.ready,
            missing: setup.missing,
            campaign_bot: setup.campaignBot ? {
                id: setup.campaignBot.id,
                label: setup.campaignBot.label,
                number: setup.campaignBot.number,
                status: setup.campaignBot.status
            } : null,
            attendance_bot: setup.attendanceBot ? {
                id: setup.attendanceBot.id,
                label: setup.attendanceBot.label,
                number: setup.attendanceBot.number,
                active: !!setup.attendanceBot.active
            } : null
        });
    } catch (e) { next(e); }
});

router.get('/:sellerId/numbers', async (req, res, next) => {
    try {
        const sellerId = Number(req.params.sellerId);
        if (req.user.role !== 'admin' && sellerId !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
        const rows = await db.all(`SELECT sn.*, bn.id AS bot_number_id, bn.usage_type, bn.campaign_enabled, bn.status AS bot_status
            FROM seller_numbers sn
            JOIN sellers s ON s.id=sn.seller_id
            LEFT JOIN bot_numbers bn ON bn.organization_id = sn.organization_id AND bn.number = sn.number
            WHERE sn.seller_id=? AND sn.organization_id=? ORDER BY sn.id`, [sellerId, req.user.organization_id]);
        res.json(rows);
    } catch (e) { next(e); }
});

router.post('/:sellerId/numbers', async (req, res, next) => {
    try {
        const sellerId = Number(req.params.sellerId);
        if (req.user.role !== 'admin' && sellerId !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
        const number = normalizePhone(req.body.number);
        if (!number || number.length < 12 || number.length > 15) return res.status(400).json({ error: 'Número inválido' });
        const seller = await db.get('SELECT id FROM sellers WHERE id=? AND organization_id=?', [sellerId, req.user.organization_id]);
        if (!seller) return res.status(404).json({ error: 'Vendedor não encontrado' });
        const screening = await db.get('SELECT id FROM bot_numbers WHERE number=?', [number]);
        if (screening) return res.status(409).json({ error: 'Número já pertence à triagem institucional' });
        const result = await db.run('INSERT INTO seller_numbers (organization_id,seller_id,number,label) VALUES (?,?,?,?)',
            [req.user.organization_id, sellerId, number, String(req.body.label || 'operacional').trim()]);
        res.status(201).json(await db.get('SELECT * FROM seller_numbers WHERE id=?', [result.lastID]));
    } catch (e) { if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Número já cadastrado' }); next(e); }
});

router.patch('/:sellerId/numbers/:id', async (req, res, next) => {
    try {
        const sellerId = Number(req.params.sellerId);
        if (req.user.role !== 'admin' && sellerId !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
        const active = req.body.active ? 1 : 0;
        const result = await db.run('UPDATE seller_numbers SET active=? WHERE id=? AND seller_id=? AND organization_id=?',
            [active, req.params.id, sellerId, req.user.organization_id]);
        if (!result.changes) return res.status(404).json({ error: 'Número não encontrado' });
        res.json(await db.get('SELECT * FROM seller_numbers WHERE id=?', [req.params.id]));
    } catch (e) { next(e); }
});

router.post('/:sellerId/numbers/:id/campaign-usage', adminOnly, async (req, res, next) => {
    try {
        const sellerId = Number(req.params.sellerId);
        const sn = await db.get('SELECT * FROM seller_numbers WHERE id=? AND seller_id=? AND organization_id=?', [req.params.id, sellerId, req.user.organization_id]);
        if (!sn) return res.status(404).json({ error: 'Número não encontrado' });
        const enabled = !!req.body.campaign_enabled;
        const n = await antiBan.importSellerNumber(sn.id, req.user.organization_id, enabled);
        res.json(n);
    } catch (e) { next(e); }
});

async function ownedNumber(req, res) {
    const row = await db.get(`SELECT sn.* FROM seller_numbers sn WHERE sn.id=? AND sn.organization_id=?`,
        [req.params.id, req.user.organization_id]);
    if (!row) { res.status(404).json({ error: 'Número não encontrado' }); return null; }
    if (req.user.role !== 'admin' && row.seller_id !== req.user.id) { res.status(403).json({ error: 'Acesso negado' }); return null; }
    return row;
}

router.post('/connections/:id/connect', async (req, res, next) => {
    try {
        const number = await ownedNumber(req, res); if (!number) return;
        if (!number.active) return res.status(409).json({ error: 'Número inativo' });
        await whatsapp.connect(number.number, `vendedor-${number.seller_id}`);
        res.json({ ok: true, status: whatsapp.enabled() ? 'connecting' : 'queued' });
    } catch (e) { next(e); }
});

router.get('/connections/:id/qr', async (req, res, next) => {
    try {
        const number = await ownedNumber(req, res); if (!number) return;
        const qr = whatsapp.getQR(number.number);
        res.json({ qr: qr ? await QRCode.toDataURL(qr, { margin: 1, width: 300 }) : null,
            status: whatsapp.status()[number.number]?.status || 'offline' });
    } catch (e) { next(e); }
});

router.post('/connections/:id/disconnect', async (req, res, next) => {
    try {
        const number = await ownedNumber(req, res); if (!number) return;
        res.json(req.body.removeSession ? await whatsapp.logout(number.number) : await whatsapp.disconnect(number.number));
    } catch (e) { next(e); }
});

module.exports = router;
