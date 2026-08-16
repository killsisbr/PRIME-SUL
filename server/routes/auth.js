const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { sign } = require('../middleware/auth');
const router = express.Router();

router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'E-mail e senha obrigatórios' });
        const user = await db.get('SELECT * FROM sellers WHERE email = ? AND active = 1', [email.toLowerCase().trim()]);
        if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
        const token = sign(user);
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone } });
    } catch (e) { next(e); }
});

module.exports = router;