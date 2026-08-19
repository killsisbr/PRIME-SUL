const express = require('express');
const db = require('../database/db');
const { auth } = require('../middleware/auth');
const router = express.Router();
router.use(auth);

router.get('/', async (req, res, next) => {
    try {
        const params = [req.user.organization_id];
        let where = 'h.organization_id=?';
        if (req.user.role !== 'admin') { where += ' AND h.seller_id=?'; params.push(req.user.id); }
        const rows = await db.all(`SELECT h.*, l.name AS lead_name, l.phone, sn.number AS seller_number
            FROM handoffs h JOIN leads l ON l.id=h.lead_id
            LEFT JOIN seller_numbers sn ON sn.id=h.seller_number_id
            WHERE ${where} ORDER BY h.id DESC LIMIT 200`, params);
        res.json(rows);
    } catch (e) { next(e); }
});

module.exports = router;
