const jwt = require('jsonwebtoken');
const db = require('../database/db');

function secret() {
    const value = process.env.JWT_SECRET;
    if (!value || value === 'dev-secret' || value === 'troque-esta-chave') {
        if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET seguro é obrigatório em produção');
        return 'dev-secret';
    }
    return value;
}

function sign(user) {
    return jwt.sign(
        { id: user.id, organization_id: user.organization_id || 1, email: user.email, role: user.role },
        secret(),
        { expiresIn: process.env.JWT_EXPIRES || '12h' }
    );
}

async function auth(req, res, next) {
    const header = req.headers.authorization || '';
    const cookies = Object.fromEntries(String(req.headers.cookie || '').split(';').map(v => v.trim().split(/=(.*)/s).slice(0, 2)).filter(x => x[0]));
    const token = header.startsWith('Bearer ') ? header.slice(7) : cookies.prime_sul_token;
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    try {
        const claims = jwt.verify(token, secret());
        const user = await db.get(
            'SELECT id, organization_id, email, role FROM sellers WHERE id = ? AND organization_id = ? AND active = 1',
            [claims.id, claims.organization_id || 1]
        );
        if (!user) return res.status(401).json({ error: 'Usuário inativo ou inexistente' });
        req.user = user;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso restrito ao admin' });
    }
    next();
}

module.exports = { sign, auth, adminOnly, secret };
