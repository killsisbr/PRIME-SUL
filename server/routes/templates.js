const express = require('express');
const db = require('../database/db');
const { auth } = require('../middleware/auth');
const router = express.Router();
const PURPOSES = ['screening','handoff','followup'];
router.use(auth);

router.get('/', async (req, res, next) => {
    try {
        res.json(await db.all(`SELECT * FROM message_templates WHERE organization_id=?
            AND (seller_id IS NULL OR seller_id=?) AND active=1 ORDER BY purpose,name`, [req.user.organization_id, req.user.id]));
    } catch (e) { next(e); }
});

// Relatório: quantos templates existem, quantas campanhas cada um gerou e a
// taxa de resposta (qualquer reply) / conversão (lead chegou em "concluido")
// de cada um. Admin apenas — é uma visão gerencial cruzando toda a organização.
router.get('/stats', async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Somente admin' });
        const rows = await db.all(`
            SELECT
                t.id, t.name, t.purpose, t.active, t.seller_id, t.created_at,
                COUNT(DISTINCT c.id) AS campaigns_count,
                COUNT(s.id) AS sends_count,
                SUM(CASE WHEN s.status IN ('confirmado','recusado') THEN 1 ELSE 0 END) AS responded_count,
                SUM(CASE WHEN s.status = 'confirmado' THEN 1 ELSE 0 END) AS confirmado_count,
                COUNT(DISTINCT CASE WHEN l.status = 'concluido' THEN l.id END) AS converted_count
            FROM message_templates t
            LEFT JOIN campaigns c ON c.template_id = t.id
            LEFT JOIN sends s ON s.campaign_id = c.id AND s.status IN ('sent','confirmado','recusado')
            LEFT JOIN leads l ON l.id = s.lead_id
            WHERE t.organization_id = ? AND t.active = 1
            GROUP BY t.id
            ORDER BY t.purpose, t.name
        `, [req.user.organization_id]);

        res.json(rows.map(r => ({
            ...r,
            response_rate: r.sends_count ? Math.round((r.responded_count / r.sends_count) * 1000) / 10 : 0,
            conversion_rate: r.sends_count ? Math.round((r.converted_count / r.sends_count) * 1000) / 10 : 0
        })));
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const { name, purpose, body, shared } = req.body;
        if (!name || !body || !PURPOSES.includes(purpose)) return res.status(400).json({ error: 'Template inválido' });
        if (shared && req.user.role !== 'admin') return res.status(403).json({ error: 'Somente admin cria template compartilhado' });
        const r = await db.run(`INSERT INTO message_templates (organization_id,seller_id,name,purpose,body) VALUES (?,?,?,?,?)`,
            [req.user.organization_id, shared ? null : req.user.id, String(name).trim(), purpose, String(body)]);
        res.status(201).json(await db.get('SELECT * FROM message_templates WHERE id=?', [r.lastID]));
    } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const params = [req.params.id, req.user.organization_id];
        let sql = 'UPDATE message_templates SET active=0,updated_at=datetime(\'now\') WHERE id=? AND organization_id=?';
        if (req.user.role !== 'admin') { sql += ' AND seller_id=?'; params.push(req.user.id); }
        const r = await db.run(sql, params);
        if (!r.changes) return res.status(404).json({ error: 'Template não encontrado' });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

module.exports = router;
