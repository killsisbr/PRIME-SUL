const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const express = require('express');
const marketing = require('../services/marketing-service');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

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
router.post('/upload', adminOnly, upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Envie uma imagem (JPG, PNG, WEBP ou GIF) de até 8MB' });
        res.status(201).json({ url: `/uploads/${req.file.filename}` });
    } catch (e) { next(e); }
});

router.get('/posts', adminOnly, async (req, res, next) => {
    try { res.json(await marketing.list()); } catch (e) { next(e); }
});

router.post('/posts', adminOnly, async (req, res, next) => {
    try { res.json(await marketing.create(req.body)); } catch (e) { next(e); }
});

router.put('/posts/:id', adminOnly, async (req, res, next) => {
    try { res.json(await marketing.update(Number(req.params.id), req.body)); } catch (e) { next(e); }
});

router.delete('/posts/:id', adminOnly, async (req, res, next) => {
    try { await marketing.remove(Number(req.params.id)); res.json({ ok: true }); } catch (e) { next(e); }
});

router.post('/posts/:id/send-now', adminOnly, async (req, res, next) => {
    try { res.json(await marketing.sendNow(Number(req.params.id))); } catch (e) { next(e); }
});

module.exports = router;