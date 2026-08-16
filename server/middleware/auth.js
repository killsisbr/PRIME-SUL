const jwt = require('jsonwebtoken');

function sign(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'dev-secret',
        { expiresIn: process.env.JWT_EXPIRES || '12h' }
    );
}

function auth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
        next();
    } catch {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso restrito ao admin' });
    }
    next();
}

module.exports = { sign, auth, adminOnly };