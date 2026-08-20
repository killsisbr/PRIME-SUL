const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const express = require('express');
const db = require('../database/db');
const marketing = require('../services/marketing-service');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// null = sem restrição (admin). array = ids dos próprios números do vendedor.
async function allowedNumberIds(req) {
    if (req.user.role === 'admin') return null;
    const rows = await db.all('SELECT id FROM bot_numbers WHERE organization_id = ? AND seller_id = ?', [req.user.organization_id, req.user.id]);
    return rows.map(r => r.id);
}

// Confere se o post é visível/editável pelo usuário (admin sempre; vendedor só se
// o post não tem número definido ou pertence a um número seu).
async function assertPostAccess(req, post) {
    if (!post) { const e = new Error('Post não encontrado'); e.status = 404; throw e; }
    if (req.user.role === 'admin') return;
    const ids = await allowedNumberIds(req);
    if (post.number_id != null && !ids.includes(post.number_id)) {
        const e = new Error('Post não encontrado'); e.status = 404; throw e;
    }
}

const ALLOWED_IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const upload = multer({
    storage: multer.diskStorage({
        destination: path.join(__dirname, '..', '..', 'data', 'uploads'),
        filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED_IMAGE_TYPES[file.mimetype] || ''}`)
    }),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, !!ALLOWED_IMAGE_TYPES[file.mimetype])
});

// Upload de imagem pro status (substitui colar URL manualmente)
router.post('/upload', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Envie uma imagem (JPG, PNG, WEBP ou GIF) de até 8MB' });
        res.status(201).json({ url: `/uploads/${req.file.filename}` });
    } catch (e) { next(e); }
});

router.get('/posts', async (req, res, next) => {
    try { res.json(await marketing.list({ numberIds: await allowedNumberIds(req) })); } catch (e) { next(e); }
});

router.post('/posts', async (req, res, next) => {
    try {
        const ids = await allowedNumberIds(req);
        if (ids && req.body.number_id && !ids.includes(Number(req.body.number_id))) {
            return res.status(400).json({ error: 'Número não pertence a você' });
        }
        res.json(await marketing.create(req.body));
    } catch (e) { next(e); }
});

router.put('/posts/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        await assertPostAccess(req, await marketing.getById(id));
        const ids = await allowedNumberIds(req);
        if (ids && req.body.number_id && !ids.includes(Number(req.body.number_id))) {
            return res.status(400).json({ error: 'Número não pertence a você' });
        }
        res.json(await marketing.update(id, req.body));
    } catch (e) { next(e); }
});

router.delete('/posts/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        await assertPostAccess(req, await marketing.getById(id));
        await marketing.remove(id);
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.post('/posts/:id/send-now', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        await assertPostAccess(req, await marketing.getById(id));
        res.json(await marketing.sendNow(id));
    } catch (e) { next(e); }
});

module.exports = router;