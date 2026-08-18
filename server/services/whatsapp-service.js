const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const antiBan = require('./anti-ban-service');
const botEvents = require('./bot-events-service');

const sessionsDir = process.env.BOT_SESSIONS_DIR || path.join(__dirname, '..', '..', 'data', 'sessions');
fs.mkdirSync(sessionsDir, { recursive: true });

// Bots ativos: { [number]: { sock, status, lastActivity, connectedAt, qr, label } }
const bots = new Map();

// Handlers registrados quando mensagem de confirmação chega
const messageHandlers = [];
// Handlers registrados quando um bot conecta (ex: auto-resume de campanhas)
const connectedHandlers = [];

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
    botEvents.log(number, 'connect_queued', 'Sessão iniciando — aguardando conexão', label);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR emitido enquanto aguarda o scan
        if (qr) {
            if (!entry.qr) botEvents.log(number, 'qr', 'QR gerado — aguardando leitura no celular', label);
            entry.status = 'connecting';
            entry.qr = qr;
            console.log(`[whatsapp] Bot ${number} aguardando scan do QR...`);
        }

        if (connection === 'open') {
            entry.status = 'connected';
            entry.connectedAt = Date.now();
            entry.qr = null;
            await antiBan.ensureFresh();
            botEvents.log(number, 'connected', label ? `${label} conectado` : 'Bot conectado', label);
            console.log(`[whatsapp] Bot conectado: ${number} (${label || ''})`);
            for (const fn of connectedHandlers) {
                try { await fn(number); } catch (e) { console.error('[whatsapp] onConnected handler error:', e); }
            }
        } else if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const banned = statusCode === DisconnectReason.forbidden || statusCode === 403;
            entry.qr = null;

            if (banned) {
                entry.status = 'banned';
                botEvents.log(number, 'banned', 'Banido pelo WhatsApp (código 403)', label);
                // Marca o número como banido no banco (se existir)
                const n = await antiBan.registerNumber(number, label);
                if (n) await antiBan.markBanned(n.id);
                console.error(`[whatsapp] Bot ${number} BANIDO (code=${statusCode}). Número retirado de circulação.`);
                return; // não reconecta
            }

            entry.status = 'disconnected';
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            botEvents.log(number, 'disconnected', statusCode ? `Conexão fechada (código ${statusCode})` : 'Conexão fechada', label);
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
function onConnected(fn) { connectedHandlers.push(fn); }

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

// Cores de fundo dos status (mesmo mapeamento do painel)
const STATUS_COLORS = {
    teal: '#075e54', purple: '#833ab4', blue: '#1e3c72',
    red: '#ff416c', orange: '#fcb045', dark: '#0f2027'
};

// Publica um status promocional no WhatsApp (status@broadcast) usando um bot conectado
async function postStatus(botNumber, { text, imageUrl, caption, color = 'teal', font = 2 }) {
    const bot = bots.get(botNumber);
    if (!bot || bot.status !== 'connected') {
        console.warn(`[whatsapp] Bot ${botNumber} não conectado — status não publicado`);
        return { sent: false, reason: 'not_connected' };
    }
    try {
        const payload = imageUrl
            ? { image: { url: imageUrl }, caption: caption || text || '' }
            : { text: text || '' };
        await bot.sock.sendMessage('status@broadcast', payload, {
            backgroundColor: STATUS_COLORS[color] || STATUS_COLORS.teal,
            font: Number(font) || 2,
            statusJidList: []
        });
        bot.lastActivity = Date.now();
        return { sent: true };
    } catch (e) {
        console.error(`[whatsapp] Erro ao postar status de ${botNumber}:`, e.message);
        return { sent: false, reason: 'error' };
    }
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

module.exports = { enabled, connect, disconnect, logout, sendMessage, postStatus, onMessage, onConnected, getQR, status };
