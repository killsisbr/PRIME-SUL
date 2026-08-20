// ============================================================================
// AI SITE EDITOR — módulo TEMPORÁRIO, feito pra o admin editar o front-end
// mais rápido via IA. Isolado de propósito: uma rota, um arquivo de front,
// uma linha de <script> no admin.html. Pra remover depois:
//   1) apagar essa linha de app.use() no server.js
//   2) apagar este arquivo
//   3) apagar public/js/site-editor.js e a linha <script> no admin.html
// ============================================================================
const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

router.use(auth);
router.use(adminOnly);

const ROOT = path.resolve(__dirname, '..', '..');
const EDITABLE_EXT = new Set(['.html', '.css', '.js']);
const HISTORY_FILE = path.join(ROOT, 'data', 'ai-editor-history.json');
const MAX_HISTORY = 50;

const NVIDIA_BASE_URL = process.env.OPENAI_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY;
const NVIDIA_MODEL = process.env.AI_EDITOR_MODEL || process.env.OPENAI_MODEL || 'meta/llama-3.1-8b-instruct';

// -------- lista de arquivos editáveis (whitelist, evita path traversal) --------
async function listEditableFiles() {
    const roots = [
        path.join(ROOT, 'public'),
    ];
    const out = [];
    async function walk(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const ent of entries) {
            if (ent.name.startsWith('.') || ent.name === 'node_modules' || ent.name === 'uploads') continue;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) await walk(full);
            else if (EDITABLE_EXT.has(path.extname(ent.name))) out.push(path.relative(ROOT, full).replace(/\\/g, '/'));
        }
    }
    for (const r of roots) await walk(r);
    return out.sort();
}

function resolveSafe(relPath) {
    if (typeof relPath !== 'string' || !relPath.startsWith('public/')) {
        const e = new Error('Caminho inválido — só arquivos dentro de public/ podem ser editados');
        e.status = 400;
        throw e;
    }
    const full = path.resolve(ROOT, relPath);
    if (!full.startsWith(path.join(ROOT, 'public'))) {
        const e = new Error('Caminho fora da pasta public/');
        e.status = 400;
        throw e;
    }
    if (!EDITABLE_EXT.has(path.extname(full))) {
        const e = new Error('Só arquivos .html, .css ou .js podem ser editados');
        e.status = 400;
        throw e;
    }
    return full;
}

function countOccurrences(haystack, needle) {
    if (!needle) return 0;
    let count = 0, idx = 0;
    while ((idx = haystack.indexOf(needle, idx)) !== -1) { count++; idx += needle.length; }
    return count;
}

async function loadHistory() {
    try { return JSON.parse(await fs.readFile(HISTORY_FILE, 'utf8')); } catch { return []; }
}
async function saveHistory(history) {
    await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history.slice(-MAX_HISTORY), null, 2));
}

async function callLLM(beforeSnippet, prompt) {
    if (!NVIDIA_API_KEY) {
        const e = new Error('NVIDIA_API_KEY / OPENAI_API_KEY não configurada no .env');
        e.status = 500;
        throw e;
    }
    const system = [
        'Você edita trechos de HTML, CSS ou JS de um painel administrativo web.',
        'Receberá um TRECHO EXATO extraído de um arquivo e um pedido de mudança.',
        'Responda APENAS com o trecho já modificado, sem markdown, sem explicação,',
        'sem crases, sem comentários extras — só o código que vai substituir o original.',
        'Preserve indentação, aspas e estrutura ao redor tanto quanto possível.',
        'Não invente IDs ou classes usadas em outro lugar do sistema sem necessidade.'
    ].join(' ');

    const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: NVIDIA_MODEL,
            temperature: 0.2,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: `TRECHO ORIGINAL:\n\`\`\`\n${beforeSnippet}\n\`\`\`\n\nPEDIDO: ${prompt}` }
            ]
        })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const e = new Error(data?.error?.message || `Erro na API de IA (${res.status})`);
        e.status = 502;
        throw e;
    }
    let out = data?.choices?.[0]?.message?.content || '';
    out = out.trim();
    // remove eventual cerca de markdown que o modelo tenha colocado mesmo pedindo pra não
    out = out.replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim();
    return out;
}

// -------- rotas --------

router.get('/files', async (req, res, next) => {
    try { res.json(await listEditableFiles()); } catch (e) { next(e); }
});

router.get('/history', async (req, res, next) => {
    try { res.json((await loadHistory()).slice(-20).reverse()); } catch (e) { next(e); }
});

// Prévia: pede a edição pra IA e devolve o "depois", sem gravar nada ainda
router.post('/preview', async (req, res, next) => {
    try {
        const { file, before, prompt } = req.body;
        if (!before?.trim()) return res.status(400).json({ error: 'Selecione um trecho antes de pedir a edição' });
        if (!prompt?.trim()) return res.status(400).json({ error: 'Descreva a mudança desejada' });

        const full = resolveSafe(file);
        const content = await fs.readFile(full, 'utf8');
        const occurrences = countOccurrences(content, before);
        if (occurrences === 0) {
            return res.status(409).json({ error: 'Trecho não encontrado no arquivo (pode já ter mudado). Selecione de novo.' });
        }
        if (occurrences > 1) {
            return res.status(409).json({ error: `Trecho aparece ${occurrences}x no arquivo — preciso de um trecho mais específico pra não editar o lugar errado.` });
        }

        const after = await callLLM(before, prompt);
        res.json({ before, after, file, prompt });
    } catch (e) { next(e); }
});

// Aplica de fato: grava o arquivo e registra no histórico (pra dar undo depois)
router.post('/apply', async (req, res, next) => {
    try {
        const { file, before, after, prompt } = req.body;
        if (!before || after == null) return res.status(400).json({ error: 'Faltou o trecho antes/depois' });

        const full = resolveSafe(file);
        const content = await fs.readFile(full, 'utf8');
        const occurrences = countOccurrences(content, before);
        if (occurrences !== 1) {
            return res.status(409).json({ error: 'Trecho mudou desde a prévia — peça a edição de novo antes de aplicar.' });
        }

        const updated = content.replace(before, after);
        await fs.writeFile(full, updated, 'utf8');

        const history = await loadHistory();
        history.push({ id: Date.now(), file, before, after, prompt: prompt || '', at: new Date().toISOString(), by: req.user.email });
        await saveHistory(history);

        res.json({ ok: true });
    } catch (e) { next(e); }
});

// Desfaz a última edição aplicada nesse arquivo
router.post('/undo', async (req, res, next) => {
    try {
        const { file } = req.body;
        const history = await loadHistory();
        const idx = [...history].reverse().findIndex(h => h.file === file);
        if (idx === -1) return res.status(404).json({ error: 'Nenhuma edição registrada pra desfazer nesse arquivo' });
        const realIdx = history.length - 1 - idx;
        const entry = history[realIdx];

        const full = resolveSafe(entry.file);
        const content = await fs.readFile(full, 'utf8');
        const occurrences = countOccurrences(content, entry.after);
        if (occurrences !== 1) {
            return res.status(409).json({ error: 'O trecho já foi alterado por outra edição — não dá pra desfazer automaticamente.' });
        }
        const reverted = content.replace(entry.after, entry.before);
        await fs.writeFile(full, reverted, 'utf8');

        history.splice(realIdx, 1);
        await saveHistory(history);

        res.json({ ok: true });
    } catch (e) { next(e); }
});

module.exports = router;
