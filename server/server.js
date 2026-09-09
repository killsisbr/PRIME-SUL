require('dotenv').config();

const path = require('path');
const express = require('express');
const db = require('./database/db');
const whatsapp = require('./services/whatsapp-service');
const botFlow = require('./services/bot-flow-service');

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Necessário quando atrás de reverse proxy (Nginx, Cloudflare) para req.ip correto
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' blob: https://cdnjs.cloudflare.com; connect-src 'self'");
    next();
});
app.use(express.json({ limit: '256kb' }));

// Rotas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sellers', require('./routes/sellers'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/config', require('./routes/config'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/bots', require('./routes/bots'));
app.use('/api/marketing', require('./routes/marketing'));
app.use('/api/tools', require('./routes/tools'));
app.use('/api/handoffs', require('./routes/handoffs'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/sends', require('./routes/sends'));
app.use('/api/public', require('./routes/public'));
app.use('/api/copilot', require('./routes/copilot'));

// TEMPORÁRIO — editor de site via IA (só admin). Desativado em produção.
if (process.env.NODE_ENV !== 'production') {
    app.use('/api/ai-editor', require('./routes/ai-editor'));
}

// Imagens enviadas (status de marketing) — data/ fica fora do git, não junto do front estático
app.use('/uploads', express.static(path.join(__dirname, '..', 'data', 'uploads')));

// Front estático
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('[erro]', err);
    const status = err.status || (String(err.message).includes('UNIQUE constraint') ? 409 : 500);
    res.status(status).json({ error: status >= 500 ? 'Erro interno' : (err.code || err.message) });
});

async function bootstrap() {
    await db.init();
    await db.migrate();
    console.log('[db] schema pronto');

    // Pausa temporária de bots (runtime, persistida em settings) — carrega estado salvo no boot
    const settings = require('./services/settings-service');
    const savedSettings = await settings.get();
    whatsapp.setRuntimeEnabled(savedSettings.cfg_bot_enabled !== 'false');

    // Registra fluxo anti-ban de confirmação
    botFlow.register();

    // Reinicia campanhas pausadas por bot offline quando qualquer bot reconecta
    const campaignService = require('./services/campaign-service');
    whatsapp.onConnected(() => campaignService.resumePausedFromOffline());

    // Fila persistente de jobs (ações em massa, retomada após restart)
    const jobQueue = require('./services/job-queue-service');
    await jobQueue.recover();
    await campaignService.recoverInterrupted();
    jobQueue.start();

    if (whatsapp.enabled()) {
        const antiBan = require('./services/anti-ban-service');
        const mainNumber = process.env.BOT_MAIN_NUMBER;
        const active = await db.all("SELECT * FROM bot_numbers WHERE status = 'ativo'");
        for (const n of active) {
            try { await whatsapp.connect(n.number, n.label); }
            catch (e) { console.error(`[whatsapp] falha ao conectar ${n.number} no boot:`, e.message); }
        }
        if (mainNumber && !active.some(n => n.number === mainNumber)) {
            try {
                await antiBan.registerNumber(mainNumber, 'bot-principal');
                await whatsapp.connect(mainNumber, 'bot-principal');
            } catch (e) { console.error(`[whatsapp] falha ao registrar/conectar BOT_MAIN_NUMBER (${mainNumber}):`, e.message); }
        }
        const sellerNumbers = await db.all('SELECT * FROM seller_numbers WHERE active=1');
        for (const n of sellerNumbers) {
            try { await whatsapp.connect(n.number, `vendedor-${n.seller_id}`); }
            catch (e) { console.error(`[whatsapp] falha ao conectar vendedor ${n.number} no boot:`, e.message); }
        }
    } else {
        console.log('[whatsapp] BOT_ENABLED=false — bots desligados (dry-run).');
    }

    // Reativa números resfriados, retoma campanhas pausadas, processa marketing, follow-up e health-check (a cada 60s)
    const antiBan = require('./services/anti-ban-service');
    const marketingService = require('./services/marketing-service');
    const followupService = require('./services/followup-service');
    const handoffService = require('./services/handoff-service');
    let followupTicks = 0;
    setInterval(async () => {
        try { await antiBan.ensureFresh(); } catch (e) { console.error('[anti-ban] refresh:', e.message); }
        try { await campaignService.resumePausedFromLimit(); } catch (e) { console.error('[campaign] resume:', e.message); }
        try { await campaignService.processScheduled(); } catch (e) { console.error('[campaign] scheduled:', e.message); }
        try { await marketingService.processDue(); } catch (e) { console.error('[marketing] processDue:', e.message); }
        try { await followupService.processDue(); } catch (e) { console.error('[followup] processDue:', e.message); }
        try { await handoffService.processDue(); } catch (e) { console.error('[handoff] processDue:', e.message); }
        if (++followupTicks % 10 === 0) {
            try { await followupService.schedule(); } catch (e) { console.error('[followup] schedule:', e.message); }
        }
        try { await whatsapp.healthCheck(); } catch (e) { console.error('[whatsapp] health-check:', e.message); }
    }, 60 * 1000);
    await antiBan.ensureFresh();
    await whatsapp.cleanupSessions();
    await followupService.schedule();
    await handoffService.processDue();

    const wsService = require('./services/websocket-service');
    const server = app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
        console.log(`[prime-sul] rodando em http://localhost:${PORT}`);
        console.log(`[prime-sul] login: http://localhost:${PORT}/login.html`);
    });
    wsService.init(server);
}

bootstrap().catch((err) => {
    console.error('[fatal]', err);
    process.exit(1);
});

// --- Handlers globais de erros não capturados ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] unhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[FATAL] uncaughtException:', err);
    process.exit(1);
});
