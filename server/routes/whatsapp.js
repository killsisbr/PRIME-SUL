const express = require('express');
const whatsapp = require('../services/whatsapp-service');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// Status dos bots conectados
router.get('/status', async (req, res) => {
    res.json({ enabled: whatsapp.enabled(), bots: whatsapp.status() });
});

module.exports = router;