require('dotenv').config();

const path = require('path');
const express = require('express');
const db = require('./database/db');
const whatsapp = require('./services/whatsapp-service');
const botFlow = require('./services/bot-flow-service');

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(express.json());

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

// Front estático
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Error handler
app.use((err, req, res, next) => {
    console.error('[erro]', err);
    res.status(err.status || 500).json({ error: err.code || err.message });
});

async function bootstrap() {
    await db.init();
    await db.migrate();
    console.log('[db] schema pronto');

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
            await whatsapp.connect(n.number, n.label);
        }
        if (mainNumber && !active.some(n => n.number === mainNumber)) {
            await antiBan.registerNumber(mainNumber, 'bot-principal');
            await whatsapp.connect(mainNumber, 'bot-principal');
        }
    } else {
        console.log('[whatsapp] BOT_ENABLED=false — bots desligados (dry-run).');
    }

    // Reativa números resfriados cujo cooldown expirou e retoma campanhas pausadas por limite (a cada 60s)
    const antiBan = require('./services/anti-ban-service');
    const marketingService = require('./services/marketing-service');
    setInterval(async () => {
        try { await antiBan.ensureFresh(); } catch (e) { console.error('[anti-ban] refresh:', e.message); }
        try { await campaignService.resumePausedFromLimit(); } catch (e) { console.error('[campaign] resume:', e.message); }
        try { await marketingService.processDue(); } catch (e) { console.error('[marketing] processDue:', e.message); }
    }, 60 * 1000);
    await antiBan.ensureFresh();

    app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
        console.log(`[prime-sul] rodando em http://localhost:${PORT}`);
        console.log(`[prime-sul] login: http://localhost:${PORT}/login.html`);
    });
}

bootstrap().catch((err) => {
    console.error('[fatal]', err);
    process.exit(1);
});