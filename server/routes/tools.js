const express = require('express');
const db = require('../database/db');
const { auth } = require('../middleware/auth');
const leadService = require('../services/lead-service');
const campaignService = require('../services/campaign-service');
const scoreService = require('../services/score-service');
const stageConfig = require('../services/stage-config-service');
const jobQueue = require('../services/job-queue-service');
const followupService = require('../services/followup-service');

const router = express.Router();
router.use(auth);

const ALL_STATUSES = ['novo', 'contato', 'confirmado', 'concluido', 'bloqueado', 'duplicado'];
const MESSAGE_STATUSES = ['novo', 'contato'];
const MANUAL_SEND_LIMIT = Number(process.env.MANUAL_SEND_LIMIT) || 6;
const MANUAL_SEND_WINDOW_MS = Number(process.env.MANUAL_SEND_WINDOW_MS) || 60 * 1000;
const operatorRateLimits = new Map();

// ---------- Jobs (fila persistente) ----------

router.get('/jobs', async (req, res, next) => {
    try {
        const rows = await jobQueue.listForSeller(req.user.id, 30);
        res.json(rows.map(j => {
            let payload = null, result = null;
            try { payload = j.payload ? JSON.parse(j.payload) : null; } catch (e) { /* ignore */ }
            try { result = j.result ? JSON.parse(j.result) : null; } catch (e) { /* ignore */ }
            return { ...j, payload, result };
        }));
    } catch (e) { next(e); }
});

router.get('/jobs/:id', async (req, res, next) => {
    try {
        const job = await jobQueue.get(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job não encontrado' });
        if (job.seller_id && job.seller_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        let payload = null;
        let result = null;
        try { payload = job.payload ? JSON.parse(job.payload) : null; } catch (e) { /* ignore */ }
        try { result = job.result ? JSON.parse(job.result) : null; } catch (e) { /* ignore */ }
        res.json({ ...job, payload, result });
    } catch (e) { next(e); }
});

router.post('/jobs/:id/cancel', async (req, res, next) => {
    try {
        const job = await jobQueue.get(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job não encontrado' });
        if (job.seller_id && job.seller_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        await jobQueue.cancel(req.params.id);
        res.json({ ok: true });
    } catch (e) { next(e); }
});

// ---------- Configuração por coluna (auto-ferramentas) ----------

// Retornos de hoje + atrasados e próximos (follow-ups)
router.get('/followups', async (req, res, next) => {
    try {
        const days = Number(req.query.days) || 7;
        const [today, upcoming] = await Promise.all([
            followupService.listToday(req.user.id),
            followupService.listUpcoming(req.user.id, days)
        ]);
        res.json({ today, upcoming });
    } catch (e) { next(e); }
});

router.get('/stage-config', async (req, res, next) => {
    try {
        res.json(await stageConfig.getMap(req.user.id, req.user.organization_id));
    } catch (e) { next(e); }
});

router.put('/stage-config', async (req, res, next) => {
    try {
        const { status, config } = req.body;
        if (!ALL_STATUSES.includes(status)) return res.status(400).json({ error: 'Status inválido' });
        res.json(await stageConfig.saveForSeller(status, config || {}, req.user.id, req.user.organization_id));
    } catch (e) { next(e); }
});

// ---------- Ações em massa (ferramentas de coluna) ----------

function parseLimit(raw) {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 10000) : null;
}

// Recalcula o score dos leads da coluna
router.post('/recalc', async (req, res, next) => {
    try {
        const { status, limit } = req.body;
        const lim = parseLimit(limit);
        const rows = await db.all(
            `SELECT id FROM leads WHERE seller_id = ? AND status = ?
             ORDER BY id ASC${lim ? ' LIMIT ' + lim : ''}`,
            [req.user.id, status || 'novo']
        );
        if (!rows.length) return res.status(400).json({ error: 'Nenhum lead nessa coluna' });
        const job = await jobQueue.enqueue({
            type: 'recalc_scores',
            seller_id: req.user.id,
            payload: { ids: rows.map(r => r.id), done: 0, total: rows.length, changed: 0 },
            max_attempts: 2
        });
        res.status(201).json({ job, total: rows.length });
    } catch (e) { next(e); }
});

// Move leads da coluna para outro estágio (com histórico)
router.post('/move', async (req, res, next) => {
    try {
        const { status, to_status, limit } = req.body;
        if (!ALL_STATUSES.includes(to_status)) return res.status(400).json({ error: 'Status de destino inválido' });
        const lim = parseLimit(limit);
        const rows = await db.all(
            `SELECT id FROM leads WHERE seller_id = ? AND status = ?
             ORDER BY id ASC${lim ? ' LIMIT ' + lim : ''}`,
            [req.user.id, status || 'novo']
        );
        if (!rows.length) return res.status(400).json({ error: 'Nenhum lead nessa coluna' });
        const job = await jobQueue.enqueue({
            type: 'move_stage',
            seller_id: req.user.id,
            payload: { ids: rows.map(r => r.id), to_status, done: 0, total: rows.length, ok: 0, fail: 0 },
            max_attempts: 2
        });
        res.status(201).json({ job, total: rows.length });
    } catch (e) { next(e); }
});

// Dispara mensagem para a coluna (cria campanha e inicia — reaproveita o fluxo de confirmação)
router.post('/send', async (req, res, next) => {
    try {
        const { status, message, limit, number_id } = req.body;
        if (!MESSAGE_STATUSES.includes(status || 'novo')) return res.status(400).json({ error: 'Disparo automático permitido somente em Novo ou Em contato' });
        if (!message || !message.trim()) return res.status(400).json({ error: 'Mensagem obrigatória' });

        const now = Date.now();
        const recent = (operatorRateLimits.get(req.user.id) || []).filter(ts => now - ts < MANUAL_SEND_WINDOW_MS);
        if (recent.length >= MANUAL_SEND_LIMIT) {
            operatorRateLimits.set(req.user.id, recent);
            return res.status(429).json({
                error: 'Limite de disparo manual atingido. Aguarde alguns segundos e tente novamente.',
                retry_after_seconds: Math.max(1, Math.ceil((MANUAL_SEND_WINDOW_MS - (now - recent[0])) / 1000))
            });
        }
        recent.push(now);
        operatorRateLimits.set(req.user.id, recent);

        const campaign = await campaignService.createCampaign({
            seller_id: req.user.id,
            organization_id: req.user.organization_id,
            name: `[COLUNA ${String(status || 'novo').toUpperCase()}] Disparo manual`,
            message,
            number_ids: number_id ? [Number(number_id)] : [],
            filters: { status: [status || 'novo'], limit: parseLimit(limit) || undefined }
        });
        const started = await campaignService.startCampaign(campaign.id);
        res.status(201).json({ campaign, job_id: started.job_id, started: started.started });
    } catch (e) { next(e); }
});

// ---------- Handlers dos jobs ----------

jobQueue.register('move_stage', async (job) => {
    const p = JSON.parse(job.payload || '{}');
    const { ids = [], to_status } = p;
    const sellerId = job.seller_id || p.seller_id;
    let ok = 0, fail = 0, done = 0;
    for (const id of ids) {
        try {
            const r = await leadService.updateStatus(id, sellerId, to_status);
            if (!r) { fail++; } else { ok++; }
        } catch (e) {
            fail++;
        }
        done++;
        if (done % 5 === 0 || done === ids.length) {
            await jobQueue.updatePayload(job.id, { ...p, done, ok, fail, total: ids.length });
        }
    }
    await jobQueue.complete(job.id, { ok, fail, total: ids.length });
});

jobQueue.register('recalc_scores', async (job) => {
    const p = JSON.parse(job.payload || '{}');
    const { ids = [] } = p;
    const res = await scoreService.recalcScoresFor(ids);
    await jobQueue.complete(job.id, res);
});

module.exports = router;
