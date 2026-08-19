const express = require('express');
const leadService = require('../services/lead-service');
const products = require('../services/site-products-service');
const { normalizePhone } = require('../utils/phone');

const router = express.Router();

// ---------- Rate-limit por IP (evita flood de cadastros) ----------
// Configurável via RATE_LIMIT_ENABLED (false desativa em dev/teste)
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';
const attempts = new Map();
const LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const LIMIT_MAX = 10;                    // 10 cadastros / 15 min por IP

function rateLimit(req, res, next) {
    if (!RATE_LIMIT_ENABLED) return next();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = attempts.get(key) || { count: 0, reset: now + LIMIT_WINDOW_MS };
    if (entry.reset <= now) { entry.count = 0; entry.reset = now + LIMIT_WINDOW_MS; }
    entry.count++;
    attempts.set(key, entry);
    if (entry.count > LIMIT_MAX) {
        return res.status(429).json({ error: 'Muitas solicitações. Tente novamente mais tarde.' });
    }
    next();
}

// ---------- Rotas ----------

// Produtos da vitrine (nomes/taglines configuráveis no painel admin → settings site_products)
router.get('/products', async (req, res, next) => {
    try {
        res.json(await products.list());
    } catch (e) { next(e); }
});

// Cadastro de lead vindo do site vitrine → origem SIMULACAO, integrado ao CRM.
// Anti-spam: honeypot (campo invisível) + rate-limit por IP.
router.post('/lead', rateLimit, async (req, res, next) => {
    try {
        const body = req.body || {};

        // Honeypot: bots preenchem campos escondidos
        if (body.website) {
            return res.status(200).json({ ok: true, fake: true });
        }

        const { name, phone, city, product_id, valor, renda, prioridade } = body;
        if (!name || !String(name).trim() || String(name).trim().length < 2) {
            return res.status(400).json({ error: 'Informe seu nome' });
        }
        const normalized = normalizePhone(phone);
        if (!normalized) {
            return res.status(400).json({ error: 'Telefone inválido' });
        }

        const product = await products.getById(product_id);
        const obs = [
            product ? `Interesse: ${product.name}` : null,
            valor ? `Valor desejado: ${valor}` : null,
            renda ? `Renda: ${renda}` : null
        ].filter(Boolean).join(' | ');

        const result = await leadService.createLead({
            seller_id: 1, // distribuição padrão (admin/organização); redirecionar depois
            organization_id: 1,
            name: String(name).trim(),
            phone: normalized,
            city: city || null,
            origem: 'SIMULACAO',
            renda: renda || null,
            valor_desejado: valor || null,
            obs: obs || null,
            prioridade: ['alta', 'media', 'baixa'].includes(prioridade) ? prioridade : 'media'
        });

        res.status(201).json({ ok: true, lead_id: result.lead.id, already_mine: result.already_mine });
    } catch (e) {
        if (e.status === 409 && e.code === 'DUPLICATE_LEAD') {
            return res.status(409).json({ error: 'Este telefone já está em atendimento. Em breve nossa equipe entra em contato.' });
        }
        if (e.status === 409 && e.code === 'OPTED_OUT') {
            return res.status(409).json({ error: 'Este número optou por não receber contatos.' });
        }
        if (e.status === 409 && e.code === 'LEAD_LIMIT') {
            return res.status(503).json({ error: 'Estamos em capacidade máxima no momento. Tente novamente em breve.' });
        }
        next(e);
    }
});

module.exports = router;