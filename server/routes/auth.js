const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { sign } = require('../middleware/auth');
const router = express.Router();
const attempts = new Map();

// Rate-limit de login configurável (RATE_LIMIT_ENABLED=false desativa em dev/teste)
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';

function loginLimit(req, res, next) {
    if (!RATE_LIMIT_ENABLED) {
        // rate-limit desativado: registra no-ops para o handler não quebrar
        req.loginLimit = { key: null, entry: null };
        return next();
    }
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = attempts.get(key) || { count: 0, reset: now + 15 * 60_000 };
    if (entry.reset <= now) { entry.count = 0; entry.reset = now + 15 * 60_000; }
    if (entry.count >= 10) return res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });
    req.loginLimit = { key, entry };
    next();
}

// Incrementa a contagem de tentativas (no-op quando o rate-limit está desativado)
function registerAttempt(req) {
    if (!req.loginLimit || !req.loginLimit.key || !req.loginLimit.entry) return;
    req.loginLimit.entry.count++;
    attempts.set(req.loginLimit.key, req.loginLimit.entry);
}

function clearAttempts(req) {
    if (!req.loginLimit || !req.loginLimit.key) return;
    attempts.delete(req.loginLimit.key);
}

router.post('/login', loginLimit, async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'E-mail e senha obrigatórios' });
        const user = await db.get('SELECT * FROM sellers WHERE email = ? AND active = 1', [email.toLowerCase().trim()]);
        if (!user) { registerAttempt(req); return res.status(401).json({ error: 'Credenciais inválidas' }); }
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) { registerAttempt(req); return res.status(401).json({ error: 'Credenciais inválidas' }); }
        clearAttempts(req);
        const token = sign(user);
        res.cookie('prime_sul_token', token, {
            httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
            maxAge: 12 * 60 * 60 * 1000, path: '/'
        });
        res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone } });
    } catch (e) { next(e); }
});

router.post('/logout', (req, res) => {
    res.clearCookie('prime_sul_token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
    res.json({ ok: true });
});

module.exports = router;
