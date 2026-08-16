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
app.use('/api/whatsapp', require('./routes/whatsapp'));

// Front estático
app.use(express.static(path.join(__dirname, '..', 'public')));

// Error handler
app.use((err, req, res, next) => {
    console.error('[erro]', err);
    res.status(err.status || 500).json({ error: err.code || err.message });
});

async function bootstrap() {
    await db.init();
    console.log('[db] schema pronto');

    // Registra fluxo anti-ban de confirmação
    botFlow.register();

    if (whatsapp.enabled()) {
        const mainNumber = process.env.BOT_MAIN_NUMBER;
        if (mainNumber) {
            const antiBan = require('./services/anti-ban-service');
            await antiBan.registerNumber(mainNumber, 'bot-principal');
            await whatsapp.connect(mainNumber, 'bot-principal');
        }
    } else {
        console.log('[whatsapp] BOT_ENABLED=false — bots desligados (dry-run).');
    }

    app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
        console.log(`[prime-sul] rodando em http://localhost:${PORT}`);
        console.log(`[prime-sul] login: http://localhost:${PORT}/login.html`);
    });
}

bootstrap().catch((err) => {
    console.error('[fatal]', err);
    process.exit(1);
});