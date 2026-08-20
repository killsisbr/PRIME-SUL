const db = require('../database/db');
const whatsapp = require('./whatsapp-service');
const antiBan = require('./anti-ban-service');
const botEvents = require('./bot-events-service');

const ALLOWED_TYPES = ['text', 'image', 'link'];

function fmtUtc(d) {
    return d.toISOString().replace('T', ' ').slice(0, 19);
}

// numberIds: null = sem restrição (admin vê todos os posts).
// array = vendedor só vê posts sem número definido (auto) ou dos próprios números.
async function list({ numberIds = null } = {}) {
    if (numberIds && !numberIds.length) {
        return db.all('SELECT * FROM marketing_posts WHERE number_id IS NULL ORDER BY created_at DESC');
    }
    if (numberIds) {
        return db.all(
            `SELECT * FROM marketing_posts WHERE number_id IS NULL OR number_id IN (${numberIds.map(() => '?').join(',')}) ORDER BY created_at DESC`,
            numberIds
        );
    }
    return db.all('SELECT * FROM marketing_posts ORDER BY created_at DESC');
}

async function getById(id) {
    return db.get('SELECT * FROM marketing_posts WHERE id = ?', [id]);
}

async function create({ title, type, message, media_url, color, font, number_id, scheduled_at, recurring }) {
    if (!title) throw new Error('Título obrigatório');
    const postType = ALLOWED_TYPES.includes(type) ? type : 'text';
    const res = await db.run(
        `INSERT INTO marketing_posts (title, type, message, media_url, color, font, number_id, scheduled_at, recurring, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
        [title, postType, message || '', media_url || '', color || 'teal', font || '2',
         number_id || null, scheduled_at || null, recurring ? 1 : 0]
    );
    return db.get('SELECT * FROM marketing_posts WHERE id = ?', [res.lastID]);
}

async function update(id, fields) {
    const existing = await db.get('SELECT * FROM marketing_posts WHERE id = ?', [id]);
    if (!existing) throw new Error('Post não encontrado');
    const merged = { ...existing, ...fields };
    await db.run(
        `UPDATE marketing_posts SET title=?, type=?, message=?, media_url=?, color=?, font=?, number_id=?, scheduled_at=?, recurring=?
         WHERE id=?`,
        [merged.title, merged.type, merged.message || '', merged.media_url || '', merged.color || 'teal',
         merged.font || '2', merged.number_id || null, merged.scheduled_at || null, merged.recurring ? 1 : 0, id]
    );
    return db.get('SELECT * FROM marketing_posts WHERE id = ?', [id]);
}

async function remove(id) {
    return db.run('DELETE FROM marketing_posts WHERE id = ?', [id]);
}

async function setStatus(id, status, error) {
    await db.run('UPDATE marketing_posts SET status = ?, error = ? WHERE id = ?', [status, error || null, id]);
}

// Número que vai postar: o indicado no post, senão o menos usado disponível
async function pickNumber(post) {
    if (post.number_id) {
        const n = await db.get('SELECT * FROM bot_numbers WHERE id = ?', [post.number_id]);
        if (n) return n;
    }
    return antiBan.pickBestNumber();
}

// Publica agora (também usado pelo agendador). Reagenda recorrentes no sucesso.
async function sendNow(id) {
    const post = await db.get('SELECT * FROM marketing_posts WHERE id = ?', [id]);
    if (!post) throw new Error('Post não encontrado');

    const number = await pickNumber(post);
    if (!number) {
        await setStatus(id, 'failed', 'Nenhum bot ativo disponível');
        return { sent: false, reason: 'no_number' };
    }

    const res = await whatsapp.postStatus(number.number, {
        text: post.message,
        imageUrl: post.type === 'image' ? post.media_url : null,
        caption: post.message,
        color: post.color,
        font: post.font
    });

    if (res.sent) {
        await db.run("UPDATE marketing_posts SET status='sent', sent_at=datetime('now'), error=NULL WHERE id=?", [id]);
        await botEvents.log(number.number, 'send_ok', `Status "${post.title}" publicado`, number.label);
        if (post.recurring) {
            // reagenda para amanhã no mesmo horário
            const base = post.scheduled_at ? new Date(post.scheduled_at.replace(' ', 'T') + 'Z') : new Date();
            const next = fmtUtc(new Date(base.getTime() + 86400000));
            await db.run("UPDATE marketing_posts SET status='scheduled', scheduled_at=? WHERE id=?", [next, id]);
            return { sent: true, rescheduled: true };
        }
        return { sent: true };
    }

    await setStatus(id, 'failed', res.reason === 'not_connected' ? 'Nenhum bot conectado' : 'Falha no envio');
    await botEvents.log(number.number, 'send_fail', `Status "${post.title}" (${res.reason})`, number.label);
    return { sent: false, reason: res.reason };
}

// Dispara posts agendados vencidos (chamado pelo intervalo do servidor)
async function processDue() {
    const now = fmtUtc(new Date());
    const due = await db.all(
        "SELECT * FROM marketing_posts WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?",
        [now]
    );
    for (const p of due) {
        await sendNow(p.id).catch(e => console.error(`[marketing] post #${p.id} falhou:`, e.message));
    }
    return due.length;
}

module.exports = { list, getById, create, update, remove, sendNow, processDue };