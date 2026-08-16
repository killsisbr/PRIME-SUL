const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { auth, adminOnly } = require('../middleware/auth');
const { normalizePhone } = require('../utils/phone');
const router = express.Router();

router.use(auth);

// Lista vendedores (admin)
router.get('/', adminOnly, async (req, res, next) => {
    try {
        const rows = await db.all(`
            SELECT s.id, s.name, s.email, s.phone, s.role, s.active, s.max_leads, s.created_at,
                   (SELECT COUNT(*) FROM leads l WHERE l.seller_id = s.id) AS total_leads
            FROM sellers s ORDER BY s.created_at DESC
        `);
        res.json(rows);
    } catch (e) { next(e); }
});

// Cria vendedor (admin)
router.post('/', adminOnly, async (req, res, next) => {
    try {
        const { name, email, password, phone, max_leads } = req.body;
        if (!name || !email || !password || !phone) return res.status(400).json({ error: 'Dados incompletos' });
        const normalized = normalizePhone(phone);
        const existing = await db.get('SELECT id FROM sellers WHERE email = ? OR phone = ?', [email.toLowerCase().trim(), normalized]);
        if (existing) return res.status(409).json({ error: 'E-mail ou telefone já em uso' });
        const hash = await bcrypt.hash(password, 10);
        const result = await db.run(
            'INSERT INTO sellers (name, email, password, phone, max_leads) VALUES (?, ?, ?, ?, ?)',
            [name.trim(), email.toLowerCase().trim(), hash, normalized, max_leads || 0]
        );
        res.status(201).json({ id: result.lastID });
    } catch (e) { next(e); }
});

// Meus dados / perfil
router.get('/me', async (req, res, next) => {
    try {
        const user = await db.get('SELECT id, name, email, phone, role, max_leads FROM sellers WHERE id = ?', [req.user.id]);
        if (!user) return res.status(404).json({ error: 'Vendedor não encontrado' });
        res.json(user);
    } catch (e) { next(e); }
});

module.exports = router;