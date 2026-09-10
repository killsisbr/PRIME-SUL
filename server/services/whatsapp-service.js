const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const db = require('../database/db');
const antiBan = require('./anti-ban-service');
const botEvents = require('./bot-events-service');
const { normalizePhone, phoneVariants } = require('../utils/phone');

// Cache de resolução de JID (qual variante do número — com/sem o 9 — está no
// WhatsApp). Evita bater no onWhatsApp() a cada mensagem. TTL curto.
const jidCache = new Map(); // phone -> { jid, at }
const JID_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// Descobre o JID real do contato testando as duas formas (com o 9 e sem o 9).
// - retorna a string do JID quando o WhatsApp confirma a existência
// - retorna null quando conseguiu checar e NENHUMA variante existe
// - retorna `${phone}@s.whatsapp.net` (fallback) quando não deu pra checar
async function resolveWhatsAppJid(sock, phone) {
    const cached = jidCache.get(phone);
    if (cached && Date.now() - cached.at < JID_CACHE_TTL_MS) return cached.jid;

    const variants = phoneVariants(phone);
    if (!variants.length) return null;

    let checkedAny = false;
    for (const v of variants) {
        try {
            const r = await sock.onWhatsApp(`${v}@s.whatsapp.net`);
            checkedAny = true;
            const hit = Array.isArray(r) ? r.find(x => x && x.exists) : null;
            if (hit) {
                const jid = hit.jid || `${v}@s.whatsapp.net`;
                jidCache.set(phone, { jid, at: Date.now() });
                return jid;
            }
        } catch (e) { /* tenta a próxima variante */ }
    }
    if (checkedAny) {
        jidCache.set(phone, { jid: null, at: Date.now() });
        return null; // checou e não achou -> número sem WhatsApp
    }
    return `${normalizePhone(phone)}@s.whatsapp.net`; // não deu pra checar -> deixa o WhatsApp decidir
}

const sessionsDir = process.env.BOT_SESSIONS_DIR || path.join(__dirname, '..', '..', 'data', 'sessions');
fs.mkdirSync(sessionsDir, { recursive: true });
const uploadsDir = path.join(__dirname, '..', '..', 'data', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// Extrai com precisão o número de telefone real do WhatsApp conectado após o scan do QR
function extractRealNumber(sock) {
    if (!sock) return null;
    const candidates = [
        sock.user?.id,
        sock.authState?.creds?.me?.id,
        sock.user?.phone,
        sock.authState?.creds?.me?.phone,
        sock.user?.jid,
        sock.user?.lid,
        sock.authState?.creds?.me?.lid
    ];
    for (const c of candidates) {
        if (!c) continue;
        const s = String(c);
        if (s.includes('@s.whatsapp.net') || (!s.includes('@lid') && /^\d{10,15}/.test(s))) {
            const num = s.split(':')[0].split('@')[0].replace(/\D/g, '');
            if (num.length >= 10 && num.length <= 15) return num;
        }
    }
    for (const c of candidates) {
        if (!c) continue;
        const num = String(c).split(':')[0].split('@')[0].replace(/\D/g, '');
        if (num.length >= 10 && num.length <= 15) return num;
    }
    return null;
}

function extractPushName(sock) {
    if (!sock) return null;
    return sock.user?.name || sock.user?.notify || sock.authState?.creds?.me?.name || null;
}

// Bots ativos: { [number]: { sock, status, lastActivity, connectedAt, qr, label, startedAt, forceClosing } }
const bots = new Map();
// Estado de reconexão (backoff exponencial): { [number]: { attempts, timer } }
const reconnectState = new Map();

const HUMAN_MODE = process.env.BOT_HUMAN_MODE !== 'false';
const RECONNECT_BASE_MS = Number(process.env.BOT_RECONNECT_BASE_MS) || 10000;
const RECONNECT_MAX_MS = Number(process.env.BOT_RECONNECT_MAX_MS) || 30000;
const STUCK_QR_MS = Number(process.env.BOT_STUCK_QR_MS) || 120000;
// Portado do saas-web: se o QR não for escaneado em 120s, encerra a sessão e
// NÃO reconecta sozinho — sem isso o bot fica gerando QR novo pra sempre
// (reconecta, QR expira, reconecta, QR expira...), gastando conexões com o
// WhatsApp à toa e deixando o painel de bots "piscando" QR sem parar.
const QR_SCAN_TIMEOUT_MS = Number(process.env.BOT_QR_SCAN_TIMEOUT_MS) || 120000;
const CONTACT_COOLDOWN_MS = Math.max(0, Number(process.env.BOT_CONTACT_COOLDOWN_MS) || 10 * 60 * 1000);

// Evita reenviar para o mesmo contato em sequência muito curta, mesmo quando o
// envio vem de módulos diferentes (campanha, follow-up, handoff).
const recentContactSends = new Map();

function contactKey(organizationId, phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return `${Number(organizationId) || 1}:${normalized}`;
}

function pruneRecentContactSends(now = Date.now()) {
    for (const [key, sentAt] of recentContactSends.entries()) {
        if (sentAt + CONTACT_COOLDOWN_MS <= now) recentContactSends.delete(key);
    }
}

async function isOptedOut(organizationId, phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return false;
    const row = await db.get(
        'SELECT id FROM opt_outs WHERE organization_id = ? AND phone = ?',
        [Number(organizationId) || 1, normalized]
    );
    return !!row;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Handlers registrados quando mensagem de confirmação chega
const messageHandlers = [];
// Handlers registrados quando um bot conecta (ex: auto-resume de campanhas)
const connectedHandlers = [];

// Pausa temporária em runtime (não requer restart), separada do BOT_ENABLED do .env
// (esse continua sendo o "disjuntor" de ambiente — precisa estar true pra qualquer conexão acontecer).
let runtimeEnabled = true;
function setRuntimeEnabled(value) { runtimeEnabled = !!value; }
function isRuntimeEnabled() { return runtimeEnabled; }
function envEnabled() { return process.env.BOT_ENABLED === 'true'; }
function isMock() { return process.env.MOCK_WHATSAPP === 'true'; }

function enabled() {
    return envEnabled() && runtimeEnabled;
}

async function connect(number, label) {
    if (!enabled()) {
        console.warn(`[whatsapp] BOT_ENABLED=false — bot ${number} não conecta (dry-run)`);
        return null;
    }
    if (isMock()) {
        const existing = bots.get(number);
        if (existing && existing.status === 'connected') return existing.sock;
        const entry = {
            sock: {
                sendMessage: async (jid, content) => {
                    console.log(`[whatsapp-mock] 📨 Mensagem para ${jid}:`, content?.text || content);
                    return { key: { id: 'mock_' + Date.now() } };
                },
                sendPresenceUpdate: async () => {},
                chatModify: async () => {},
                end: () => {}
            },
            status: 'connected',
            lastActivity: Date.now(),
            connectedAt: Date.now(),
            qr: null,
            label: label || 'mock-bot',
            startedAt: Date.now(),
            forceClosing: false,
            realNumber: number,
            pushName: 'Simulador WhatsApp (Mock)',
            qrTimer: null
        };
        bots.set(number, entry);
        botEvents.log(number, 'connected', 'Bot conectado em MODO SIMULAÇÃO (Mock)', label);
        console.log(`[whatsapp-mock] ✅ Bot ${number} (${label || 'sem label'}) conectado em MODO SIMULAÇÃO.`);
        db.run('UPDATE bot_numbers SET real_number = ?, push_name = ? WHERE number = ?', [number, 'Simulador WhatsApp', number]).catch(() => {});
        connectedHandlers.forEach(h => {
            try { h(number); } catch (e) { console.error('[whatsapp-mock] erro no connectedHandler:', e.message); }
        });
        return entry.sock;
    }
    if (bots.has(number)) {
        const existing = bots.get(number);
        if (existing.status === 'connecting' || existing.status === 'connected') return existing.sock;
        clearQrTimeout(existing);
        bots.delete(number); // entrada antiga (disconnected) — reconecta do zero
    }

    // Sessão corrompida (falha ao carregar o store) → isola e gera QR novo
    let state, saveCreds;
    try {
        ({ state, saveCreds } = await useMultiFileAuthState(path.join(sessionsDir, number)));
    } catch (e) {
        console.error(`[whatsapp] Sessão de ${number} corrompida:`, e.message);
        const quarantine = `${path.join(sessionsDir, number)}-corrupted-${Date.now()}`;
        try { await fs.promises.rename(path.join(sessionsDir, number), quarantine); } catch (e2) { /* sem diretório */ }
        botEvents.log(number, 'session_corrupted', 'Sessão corrompida — isolada, novo QR gerado', label);
        ({ state, saveCreds } = await useMultiFileAuthState(path.join(sessionsDir, number)));
    }

    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: true,
        markOnlineOnConnect: true,
        browser: ['Chrome (Linux)', 'Chrome', '110.0.5481.77']
    });

    const entry = { sock, status: 'connecting', lastActivity: Date.now(), connectedAt: null, qr: null, label, startedAt: Date.now(), forceClosing: false, realNumber: null, pushName: null, qrTimer: null };
    bots.set(number, entry);
    botEvents.log(number, 'connect_queued', 'Sessão iniciando — aguardando conexão', label);

    sock.ev.on('creds.update', () => {
        saveCreds();
        if (entry.status === 'connected' && !entry.realNumber) {
            entry.realNumber = extractRealNumber(sock);
            entry.pushName = extractPushName(sock);
            if (entry.realNumber) {
                db.run('UPDATE bot_numbers SET real_number = ?, push_name = ? WHERE number = ?', [entry.realNumber, entry.pushName, number]).catch(() => {});
            }
        }
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR emitido enquanto aguarda o scan
        if (qr) {
            if (!entry.qr) {
                botEvents.log(number, 'qr', 'QR gerado — aguardando leitura no celular', label);
                scheduleQrTimeout(number, entry, label); // conta 120s a partir do 1º QR desta tentativa
            }
            entry.status = 'connecting';
            entry.qr = qr;
            console.log(`[whatsapp] Bot ${number} aguardando scan do QR...`);
        }

        if (connection === 'open') {
            clearQrTimeout(entry);
            entry.status = 'connected';
            entry.connectedAt = Date.now();
            entry.startedAt = Date.now();
            entry.qr = null;
            // Número real e nome vinculados pelo scan — identificados automaticamente
            entry.realNumber = extractRealNumber(sock);
            entry.pushName = extractPushName(sock);
            if (entry.realNumber) {
                await db.run('UPDATE bot_numbers SET real_number = ?, push_name = ? WHERE number = ?', [entry.realNumber, entry.pushName, number]).catch(e => console.error('[whatsapp] db real_number:', e.message));
                console.log(`[whatsapp] ✅ WhatsApp conectado com sucesso: +${entry.realNumber} (${entry.pushName || 'Sem nome'}) [sessão: ${number}]`);
            }
            // Se estava banido no banco e reconectou com sucesso, reativa automaticamente
            try {
                const botRow = await db.get("SELECT id, status FROM bot_numbers WHERE number = ?", [number]);
                if (botRow && botRow.status === 'banido') {
                    await db.run("UPDATE bot_numbers SET status = 'ativo', messages_sent = 0, cooled_until = NULL WHERE id = ?", [botRow.id]);
                    botEvents.log(number, 'reactivated', 'Reativado automaticamente após reconexão bem-sucedida', label);
                    console.log(`[whatsapp] 🔄 Número ${number} reativado automaticamente (estava banido)`);
                }
            } catch (e) { console.error('[whatsapp] erro ao reativar número reconectado:', e.message); }
            try {
                require('./websocket-service').broadcast('whatsapp:connected', {
                    number,
                    realNumber: entry.realNumber,
                    pushName: entry.pushName,
                    status: 'connected'
                });
            } catch (e) {}
            resetBackoff(number);
            await antiBan.ensureFresh();
            botEvents.log(number, 'connected', entry.realNumber ? `Conectado: +${entry.realNumber}` : (label ? `${label} conectado` : 'Bot conectado'), label);
            console.log(`[whatsapp] Bot conectado: ${number} (${label || ''})`);
            for (const fn of connectedHandlers) {
                try { await fn(number); } catch (e) { console.error('[whatsapp] onConnected handler error:', e); }
            }
        } else if (connection === 'close') {
            clearQrTimeout(entry);
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const banned = statusCode === DisconnectReason.forbidden || statusCode === 403;
            entry.qr = null;

            if (banned) {
                entry.status = 'banned';
                clearScheduled(number);
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
            if (shouldReconnect && !entry.forceClosing) {
                scheduleReconnect(number, label);
            } else {
                entry.forceClosing = false;
                if (!shouldReconnect) {
                    clearScheduled(number);
                    entry.status = 'logged_out';
                    botEvents.log(number, 'logged_out', 'Sessão encerrada pelo usuário (logout)', label);
                }
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

    // Persiste a mensagem de entrada na caixa (best-effort — não bloqueia os handlers)
    try {
        const msgs = require('./message-service');
        const botRow = await db.get('SELECT organization_id FROM bot_numbers WHERE number = ?', [botNumber]);
        const orgId = botRow?.organization_id || 1;
        const lead = await msgs.findLeadByPhone(orgId, phone);
        const id = await msgs.record({
            organizationId: orgId,
            leadId: lead ? lead.id : null,
            leadPhone: phone,
            botNumber,
            direction: 'in',
            body: text,
            waMessageId: msg.key?.id || null
        });
        if (id && lead) {
            try {
                require('./websocket-service').broadcast('lead:message', {
                    lead_id: lead.id, direction: 'in',
                    lead_phone: phone, bot_number: botNumber, body: text
                });
            } catch (e) { /* ws opcional */ }
        }
    } catch (e) {
        console.error('[whatsapp] erro ao persistir mensagem de entrada:', e.message);
    }

    for (const h of messageHandlers) {
        try { await h({ botNumber, phone, text, message: msg }); } catch (e) { console.error('[whatsapp] handler error:', e); }
    }
}

function extractText(msg) {
    return msg.conversation || msg.extendedTextMessage?.text || null;
}

function onMessage(fn) { messageHandlers.push(fn); }
function onConnected(fn) { connectedHandlers.push(fn); }

async function sendMessage(botNumber, toPhone, text, options = {}) {
    if (isMock()) {
        let bot = bots.get(botNumber);
        if (!bot || bot.status !== 'connected') {
            await connect(botNumber, 'mock-bot');
            bot = bots.get(botNumber);
        }
        const normalizedPhone = normalizePhone(toPhone);
        if (!normalizedPhone) {
            return { sent: false, reason: 'invalid_phone' };
        }
        const organizationId = Number(options.organizationId) || 1;
        const key = contactKey(organizationId, normalizedPhone);
        if (!key) {
            return { sent: false, reason: 'invalid_phone' };
        }

        pruneRecentContactSends();
        const lastSentAt = recentContactSends.get(key);
        if (!options.skipCooldown && lastSentAt && CONTACT_COOLDOWN_MS > 0 && Date.now() - lastSentAt < CONTACT_COOLDOWN_MS) {
            return { sent: false, reason: 'cooldown' };
        }

        if (!options.skipOptOut && await isOptedOut(organizationId, normalizedPhone)) {
            return { sent: false, reason: 'opt_out' };
        }

        await sleep(250);
        const preview = (text || '').replace(/\r?\n/g, ' ').slice(0, 65);
        console.log(`[whatsapp-mock] 🚀 Disparo simulado de [${botNumber}] para [${normalizedPhone}]: "${preview}..."`);
        if (bot) bot.lastActivity = Date.now();
        recentContactSends.set(key, Date.now());
        botEvents.log(botNumber, 'send_ok', `Mock: Mensagem para ${normalizedPhone}`, bot ? bot.label : '');
        await recordOutbound(botNumber, normalizedPhone, text, options);
        return { sent: true, mock: true };
    }
    const bot = bots.get(botNumber);
    if (!bot || bot.status !== 'connected') {
        console.warn(`[whatsapp] Bot ${botNumber} não conectado — msg não enviada para ${toPhone}`);
        return { sent: false, reason: 'not_connected' };
    }
    const normalizedPhone = normalizePhone(toPhone);
    if (!normalizedPhone) {
        return { sent: false, reason: 'invalid_phone' };
    }
    const organizationId = Number(options.organizationId) || 1;
    const key = contactKey(organizationId, normalizedPhone);
    if (!key) {
        return { sent: false, reason: 'invalid_phone' };
    }

    pruneRecentContactSends();
    const lastSentAt = recentContactSends.get(key);
    if (!options.skipCooldown && lastSentAt && CONTACT_COOLDOWN_MS > 0 && Date.now() - lastSentAt < CONTACT_COOLDOWN_MS) {
        return { sent: false, reason: 'cooldown' };
    }

    if (!options.skipOptOut && await isOptedOut(organizationId, normalizedPhone)) {
        return { sent: false, reason: 'opt_out' };
    }

    // Resolve qual forma do número (com o 9 ou sem o 9) está de fato no WhatsApp
    let jid;
    try {
        jid = await resolveWhatsAppJid(bot.sock, normalizedPhone);
    } catch (e) {
        jid = `${normalizedPhone}@s.whatsapp.net`;
    }
    if (jid === null) {
        return { sent: false, reason: 'no_whatsapp' };
    }

    try {
        if (HUMAN_MODE) {
            await bot.sock.sendPresenceUpdate('composing', jid);
            await sleep(humanDelay(text));
        }
        const r = await bot.sock.sendMessage(jid, { text });
        bot.lastActivity = Date.now();
        recentContactSends.set(key, Date.now());
        if (HUMAN_MODE) await bot.sock.sendPresenceUpdate('available').catch(() => {});
        await recordOutbound(botNumber, normalizedPhone, text, options, r?.key?.id || null);
        return { sent: true };
    } catch (e) {
        console.error(`[whatsapp] Erro ao enviar de ${botNumber} para ${normalizedPhone}:`, e.message);
        return { sent: false, reason: 'error' };
    }
}

// Persiste a mensagem de saída na caixa de entrada (best-effort).
async function recordOutbound(botNumber, phone, text, options = {}, waId = null) {
    try {
        const msgs = require('./message-service');
        let leadId = options.leadId || null;
        const orgId = Number(options.organizationId) || 1;
        if (!leadId) {
            const lead = await msgs.findLeadByPhone(orgId, phone);
            leadId = lead ? lead.id : null;
        }
        await msgs.record({
            organizationId: orgId, leadId, leadPhone: phone, botNumber,
            direction: 'out', body: text, waMessageId: waId, status: 'sent'
        });
    } catch (e) {
        console.error('[whatsapp] erro ao persistir mensagem de saída:', e.message);
    }
}

function getQR(number) {
    const bot = bots.get(number);
    return bot ? bot.qr || null : null;
}

async function setArchived(botNumber, phone, archive) {
    const bot = bots.get(botNumber);
    if (!bot || bot.status !== 'connected' || typeof bot.sock.chatModify !== 'function') return false;
    await bot.sock.chatModify({ archive, lastMessages: [] }, `${phone}@s.whatsapp.net`);
    return true;
}

function archiveChat(botNumber, phone) { return setArchived(botNumber, phone, true); }
function unarchiveChat(botNumber, phone) { return setArchived(botNumber, phone, false); }

// Cores de fundo dos status (mesmo mapeamento do painel)
const STATUS_COLORS = {
    teal: '#075e54', purple: '#833ab4', blue: '#1e3c72',
    red: '#ff416c', orange: '#fcb045', dark: '#0f2027'
};

// Publica um status promocional no WhatsApp (status@broadcast) usando um bot conectado
async function postStatus(botNumber, { text, imageUrl, caption, color = 'teal', font = 2 }) {
    if (isMock()) {
        console.log(`[whatsapp-mock] 📢 Status promocional simulado por [${botNumber}]: ${text || caption || 'Mídia'}`);
        return { sent: true, mock: true };
    }
    const bot = bots.get(botNumber);
    if (!bot || bot.status !== 'connected') {
        console.warn(`[whatsapp] Bot ${botNumber} não conectado — status não publicado`);
        return { sent: false, reason: 'not_connected' };
    }
    try {
        // Upload local (via /api/marketing/upload) vira caminho relativo /uploads/<arquivo> —
        // o Baileys só sabe buscar via HTTP (http/https) ou ler direto do disco, então resolve
        // pro caminho absoluto do arquivo em vez de tentar um GET nele mesmo.
        const resolvedImage = imageUrl && imageUrl.startsWith('/uploads/')
            ? path.join(uploadsDir, path.basename(imageUrl))
            : imageUrl;
        const payload = resolvedImage
            ? { image: { url: resolvedImage }, caption: caption || text || '' }
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
    // Sem isso, o handler assíncrono de 'connection.update' (close) do socket antigo
    // ainda referencia esse mesmo `entry` e reagenda reconexão sozinho — o número
    // "volta" com QR novo pouco depois de desconectado/removido, parecendo bug.
    bot.forceClosing = true;
    clearScheduled(number);
    try {
        bot.sock.end(undefined);
    } catch (e) { /* já desconectado */ }
    bots.delete(number);
    return { ok: true };
}

async function logout(number) {
    clearScheduled(number);
    await disconnect(number);
    await fs.promises.rm(path.join(sessionsDir, number), { recursive: true, force: true });
    await db.run('UPDATE bot_numbers SET real_number = NULL, push_name = NULL WHERE number = ?', [number]).catch(() => {});
    return { ok: true };
}

// --- Resiliência ---

// Delay de digitação proporcional ao texto (simula presença humana), com teto
function humanDelay(text) {
    return Math.min(800 + (text || '').length * 6, 2600);
}

// Reconexão com backoff exponencial (10s → 20s → ... → 30s)
function scheduleReconnect(number, label) {
    const st = reconnectState.get(number) || { attempts: 0, timer: null };
    st.attempts++;
    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, st.attempts - 1), RECONNECT_MAX_MS);
    clearTimeout(st.timer);
    st.timer = setTimeout(() => {
        reconnectState.delete(number);
        connect(number, label).catch((e) => console.error(`[whatsapp] erro ao reconectar ${number}:`, e.message));
    }, delay);
    reconnectState.set(number, st);
    console.log(`[whatsapp] Reconexão de ${number} em ${Math.round(delay / 1000)}s (tentativa ${st.attempts})`);
}

function resetBackoff(number) {
    const st = reconnectState.get(number);
    if (st) {
        clearTimeout(st.timer);
        reconnectState.delete(number);
    }
}

// Portado do saas-web: conta QR_SCAN_TIMEOUT_MS (120s) a partir do primeiro QR
// emitido nesta tentativa. Se ninguém escanear a tempo, encerra a sessão sem
// reconectar sozinho — o usuário precisa clicar em "conectar" de novo pra
// gerar um QR novo. Evita o loop infinito de reconecta→QR→expira→reconecta.
function scheduleQrTimeout(number, entry, label) {
    clearQrTimeout(entry);
    entry.qrTimer = setTimeout(() => {
        if (bots.get(number) !== entry) return; // já reconectou/trocou de sessão nesse meio tempo
        console.warn(`[whatsapp] QR de ${number} expirou sem leitura (${QR_SCAN_TIMEOUT_MS / 1000}s) — encerrando sessão`);
        botEvents.log(number, 'qr_timeout', `QR expirou sem leitura em ${QR_SCAN_TIMEOUT_MS / 1000}s — conecte novamente quando for escanear`, label);
        entry.forceClosing = true; // impede o handler de 'close' de reagendar reconexão
        clearScheduled(number);
        try { entry.sock.end(undefined); } catch (e) { /* já desconectado */ }
        bots.delete(number);
    }, QR_SCAN_TIMEOUT_MS);
}

function clearQrTimeout(entry) {
    if (entry?.qrTimer) {
        clearTimeout(entry.qrTimer);
        entry.qrTimer = null;
    }
}

function clearScheduled(number) {
    const st = reconnectState.get(number);
    if (st) {
        clearTimeout(st.timer);
        reconnectState.delete(number);
    }
}

// Força uma reconexão limpa (usado pelo health-check) sem duplicar reconexões
function forceReconnect(number, label) {
    const entry = bots.get(number);
    if (!entry) return;
    entry.forceClosing = true;
    clearScheduled(number);
    try { entry.sock.end(undefined); } catch (e) { /* já encerrado */ }
    entry.status = 'disconnected';
    scheduleReconnect(number, label);
}

// Health-check: detecta socket morto (deadlock) e conexões travadas sem QR
async function healthCheck() {
    if (isMock()) return 0;
    let fixed = 0;
    for (const [number, entry] of bots) {
        if (entry.status === 'connected') {
            const alive = entry.sock?.ws?.readyState === 1 && !!entry.sock?.user;
            if (!alive) {
                console.warn(`[whatsapp] Health-check: ${number} socket morto — reconectando`);
                botEvents.log(number, 'deadlock', 'Socket morto detectado pelo health-check — reconectando', entry.label);
                forceReconnect(number, entry.label);
                fixed++;
            }
        } else if (entry.status === 'connecting' && !entry.qr && !entry.sock?.user && Date.now() - entry.startedAt > STUCK_QR_MS) {
            console.warn(`[whatsapp] Health-check: ${number} conexão travada sem QR — reiniciando`);
            botEvents.log(number, 'stuck', 'Conexão travada (sem QR) — reiniciando sessão', entry.label);
            forceReconnect(number, entry.label);
            fixed++;
        }
    }
    return fixed;
}

// Remove sessões corrompidas antigas (7+ dias) — executa no boot
async function cleanupSessions() {
    let removed = 0;
    let dirs;
    try { dirs = await fs.promises.readdir(sessionsDir); } catch (e) { return 0; }
    const now = Date.now();
    for (const d of dirs) {
        if (!d.includes('-corrupted')) continue;
        const full = path.join(sessionsDir, d);
        const st = await fs.promises.stat(full).catch(() => null);
        if (st && now - st.mtimeMs > 7 * 24 * 3600 * 1000) {
            await fs.promises.rm(full, { recursive: true, force: true });
            console.log(`[whatsapp] Sessão corrompida antiga removida: ${d}`);
            removed++;
        }
    }
    return removed;
}

function status() {
    const out = {};
    for (const [number, entry] of bots) {
        out[number] = {
            status: entry.status,
            label: entry.label,
            lastActivity: entry.lastActivity,
            connectedAt: entry.connectedAt,
            waitingQr: !!entry.qr,
            realNumber: entry.realNumber,
            pushName: entry.pushName,
            reconnectAttempts: reconnectState.get(number)?.attempts || 0
        };
    }
    return out;
}

async function simulateIncomingMessage(fromPhone, text, toBotNumber) {
    const norm = normalizePhone(fromPhone);
    console.log(`[whatsapp-mock] 📥 Mensagem recebida simulada de [${norm}] para bot [${toBotNumber}]: "${text}"`);
    // Passa pelo mesmo caminho de uma mensagem real: persiste na caixa + roda os handlers
    const fakeMsg = {
        key: { remoteJid: `${norm}@s.whatsapp.net`, fromMe: false, id: 'sim_' + Date.now() },
        message: { conversation: text }
    };
    await routeIncoming(toBotNumber, fakeMsg);
    return [{ simulated: true }];
}

module.exports = { enabled, connect, disconnect, logout, sendMessage, archiveChat, unarchiveChat, postStatus, onMessage, onConnected, getQR, status, healthCheck, cleanupSessions, setRuntimeEnabled, isRuntimeEnabled, envEnabled, isMock, simulateIncomingMessage };
