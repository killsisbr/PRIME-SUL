const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const antiBan = require('./anti-ban-service');

const sessionsDir = process.env.BOT_SESSIONS_DIR || path.join(__dirname, '..', '..', 'data', 'sessions');
fs.mkdirSync(sessionsDir, { recursive: true });

// Bots ativos: { [number]: { sock, status, lastActivity, connectedAt, qr, label } }
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

    const entry = { sock, status: 'connecting', lastActivity: Date.now(), connectedAt: null, qr: null, label };
    bots.set(number, entry);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR emitido enquanto aguarda o scan
        if (qr) {
            entry.status = 'connecting';
            entry.qr = qr;
            console.log(`[whatsapp] Bot ${number} aguardando scan do QR...`);
        }

        if (connection === 'open') {
            entry.status = 'connected';
            entry.connectedAt = Date.now();
            entry.qr = null;
            await antiBan.ensureFresh();
            console.log(`[whatsapp] Bot conectado: ${number} (${label || ''})`);
        } else if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const banned = statusCode === DisconnectReason.forbidden || statusCode === 403;
            entry.qr = null;

            if (banned) {
                entry.status = 'banned';
                // Marca o número como banido no banco (se existir)
                const n = await antiBan.registerNumber(number, label);
                if (n) await antiBan.markBanned(n.id);
                console.error(`[whatsapp] Bot ${number} BANIDO (code=${statusCode}). Número retirado de circulação.`);
                return; // não reconecta
            }

            entry.status = 'disconnected';
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`[whatsapp] Bot ${number} desconectado (code=${statusCode}). Reconectar=${shouldReconnect}`);
            if (shouldReconnect) {
                bots.delete(number);
                setTimeout(() => connect(number, label), 3000);
            } else {
                bots.delete(number);
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
    try {
        await bot.sock.sendMessage(`${toPhone}@s.whatsapp.net`, { text });
        bot.lastActivity = Date.now();
        return { sent: true };
    } catch (e) {
        console.error(`[whatsapp] Erro ao enviar de ${botNumber} para ${toPhone}:`, e.message);
        return { sent: false, reason: 'error' };
    }
}

function getQR(number) {
    const bot = bots.get(number);
    return bot ? bot.qr || null : null;
}

async function disconnect(number) {
    const bot = bots.get(number);
    if (!bot) return { ok: false, reason: 'not_found' };
    try {
        bot.sock.end(undefined);
    } catch (e) { /* já desconectado */ }
    bots.delete(number);
    return { ok: true };
}

async function logout(number) {
    await disconnect(number);
    await fs.promises.rm(path.join(sessionsDir, number), { recursive: true, force: true });
    return { ok: true };
}

function status() {
    const out = {};
    for (const [number, entry] of bots) {
        out[number] = {
            status: entry.status,
            label: entry.label,
            lastActivity: entry.lastActivity,
            connectedAt: entry.connectedAt,
            waitingQr: !!entry.qr
        };
    }
    return out;
}

function getBot(number) { return bots.get(number) || null; }

module.exports = { enabled, connect, disconnect, logout, sendMessage, onMessage, getQR, status, getBot };
