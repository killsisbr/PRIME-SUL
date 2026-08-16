const db = require('../database/db');

// ================= FILA PERSISTENTE DE JOBS =================
// Ações em massa (mover, recalcular score) e execuções longas são persistidas aqui,
// sobrevivem a restart e podem ser re-executadas/retry.

const handlers = new Map();
let workerTimer = null;
let workerBusy = false;
const POLL_MS = 1500;
const CONCURRENCY = 2;

function isoNow() { return new Date().toISOString(); }

async function enqueue({ type, ref_id = null, seller_id = null, payload = null, max_attempts = 3, run_after = null }) {
    const r = await db.run(
        `INSERT INTO jobs (type, ref_id, seller_id, payload, status, max_attempts, run_after)
         VALUES (?, ?, ?, ?, 'waiting', ?, ?)`,
        [type, ref_id, seller_id, payload ? JSON.stringify(payload) : null, max_attempts, run_after]
    );
    return db.get('SELECT * FROM jobs WHERE id = ?', [r.lastID]);
}

function register(type, handler) { handlers.set(type, handler); }

async function get(id) {
    return db.get('SELECT * FROM jobs WHERE id = ?', [id]);
}

async function getActiveCount(type, ref_id) {
    const row = await db.get(
        "SELECT COUNT(*) AS c FROM jobs WHERE type = ? AND ref_id = ? AND status IN ('waiting','running')",
        [type, ref_id]
    );
    return row ? row.c : 0;
}

async function listForSeller(seller_id, limit = 30) {
    return db.all(
        `SELECT * FROM jobs WHERE seller_id = ? ORDER BY id DESC LIMIT ?`,
        [seller_id, limit]
    );
}

async function cancel(id) {
    return db.run("UPDATE jobs SET status = 'cancelled', finished_at = datetime('now') WHERE id = ? AND status IN ('waiting','running')", [id]);
}

async function cancelForRef(type, ref_id) {
    return db.run(
        "UPDATE jobs SET status = 'cancelled', finished_at = datetime('now') WHERE type = ? AND ref_id = ? AND status IN ('waiting','running')",
        [type, ref_id]
    );
}

async function markRunning(id) {
    return db.run("UPDATE jobs SET status = 'running', started_at = datetime('now'), attempts = attempts + 1 WHERE id = ? AND status = 'waiting'", [id]);
}

async function updatePayload(id, payload) {
    return db.run('UPDATE jobs SET payload = ? WHERE id = ?', [JSON.stringify(payload), id]);
}

async function complete(id, result = null) {
    return db.run("UPDATE jobs SET status = 'done', result = ?, finished_at = datetime('now') WHERE id = ?",
        [result ? JSON.stringify(result) : null, id]);
}

async function fail(id, error) {
    return db.run("UPDATE jobs SET status = 'failed', error = ?, finished_at = datetime('now') WHERE id = ?", [String(error || 'erro'), id]);
}

// Após restart: jobs travados em 'running' voltam para 'waiting' (são reprocessados).
async function recover() {
    const r = await db.run("UPDATE jobs SET status = 'waiting', started_at = NULL, run_after = datetime('now') WHERE status = 'running'");
    if (r.changes) console.log(`[jobs] ${r.changes} job(s) recuperado(s) após restart`);
    return r.changes;
}

async function tick() {
    if (workerBusy) return;
    const job = await db.get(
        `SELECT * FROM jobs
         WHERE status = 'waiting' AND type != 'campaign_run'
           AND (run_after IS NULL OR run_after <= datetime('now'))
         ORDER BY id ASC LIMIT 1`
    );
    if (!job) return;

    const taken = await markRunning(job.id);
    if (!taken.changes) return; // outro worker pegou
    workerBusy = true;
    try {
        const handler = handlers.get(job.type);
        if (!handler) { await fail(job.id, 'nenhum handler registrado para ' + job.type); return; }
        await handler(job);
    } catch (e) {
        const j = await get(job.id);
        if (!j || j.status !== 'running') return;
        const backoffSec = (j.attempts || 1) * 5;
        await db.run(
            "UPDATE jobs SET status = 'waiting', error = ?, run_after = datetime('now', '+' || ? || ' seconds') WHERE id = ?",
            [String(e.message || e), backoffSec, job.id]
        );
        if (j.attempts >= j.max_attempts) {
            await fail(job.id, String(e.message || e));
            console.error(`[jobs] job #${job.id} (${job.type}) falhou definitivamente:`, e.message);
        } else {
            console.warn(`[jobs] job #${job.id} (${job.type}) erro (tentativa ${j.attempts}/${j.max_attempts}): ${e.message}`);
        }
    } finally {
        workerBusy = false;
    }
}

function start() {
    if (workerTimer) return;
    workerTimer = setInterval(async () => {
        try {
            await tick();
            if (CONCURRENCY > 1) await tick();
        } catch (e) {
            console.error('[jobs] worker error:', e.message);
        }
    }, POLL_MS);
    console.log('[jobs] fila persistente ativa');
}

module.exports = { enqueue, register, get, getActiveCount, listForSeller, cancel, cancelForRef, markRunning, updatePayload, complete, fail, recover, start };
