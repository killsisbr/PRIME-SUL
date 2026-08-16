const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

const sessionsDir = process.env.BOT_SESSIONS_DIR || path.join(__dirname, '..', '..', 'data', 'sessions');
fs.mkdirSync(sessionsDir, { recursive: true });

// Bots ativos: { [number]: { sock, status, lastActivity, connectedAt } }
const bots = new Map();

// Handlers registrados quando mensagem de confirmação chega
const messageHandlers = [];

function enabled() {
    return process.env.BOT_ENABLED === 'true';
}

async function connect(number, label) {
    if (!enabled()) {
        console.warn(`[whatsapp] BOT_ENABLED=false — bot ${number} não conecta (dry-run)`);
        return null;
    }
    if (bots.has(number)) return bots.get(number).sock;

    const { state, saveCreds } = await useMultiFileAuthState(path.join(sessionsDir, number));
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: true,
        markOnlineOnConnect: true,
        browser: ['Chrome (Linux)', 'Chrome', '110.0.5481.77']
    });

    const entry = { sock, status: 'connecting', lastActivity: Date.now(), connectedAt: null };
    bots.set(number, entry);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            entry.status = 'connected';
            entry.connectedAt = Date.now();
            console.log(`[whatsapp] Bot conectado: ${number} (${label || ''})`);
        } else if (connection === 'close') {
            entry.status = 'disconnected';
            const code = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = code !== DisconnectReason.loggedOut;
            console.log(`[whatsapp] Bot ${number} desconectado (code=${code}). Reconectar=${shouldReconnect}`);
            if (shouldReconnect && entry.status !== 'banned') {
                setTimeout(() => connect(number, label), 3000);
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;
            await routeIncoming(number, msg);
        }
    });

    return sock;
}

async function routeIncoming(botNumber, msg) {
    const remote = msg.key.remoteJid || '';
    const phone = remote.replace('@s.whatsapp.net', '');
    const text = extractText(msg.message) || '';
    const entry = bots.get(botNumber);
    if (entry) entry.lastActivity = Date.now();

    for (const h of messageHandlers) {
        try { await h({ botNumber, phone, text, message: msg }); } catch (e) { console.error('[whatsapp] handler error:', e); }
    }
}

function extractText(msg) {
    return msg.conversation || msg.extendedTextMessage?.text || null;
}

function onMessage(fn) { messageHandlers.push(fn); }

async function sendMessage(botNumber, toPhone, text) {
    const bot = bots.get(botNumber);
    if (!bot || bot.status !== 'connected') {
        console.warn(`[whatsapp] Bot ${botNumber} não conectado — msg não enviada para ${toPhone}`);
        return { sent: false, reason: 'not_connected' };
    }
    await bot.sock.sendMessage(`${toPhone}@s.whatsapp.net`, { text });
    bot.lastActivity = Date.now();
    return { sent: true };
}

function status() {
    const out = {};
    for (const [number, entry] of bots) {
        out[number] = { status: entry.status, lastActivity: entry.lastActivity, connectedAt: entry.connectedAt };
    }
    return out;
}

function getBot(number) { return bots.get(number) || null; }

module.exports = { enabled, connect, sendMessage, onMessage, status, getBot };