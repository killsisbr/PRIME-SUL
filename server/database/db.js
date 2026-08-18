const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, '..', '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(dataDir, 'prime-sul.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao abrir banco:', err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    db.run('PRAGMA journal_mode = WAL;');
    db.run('PRAGMA foreign_keys = ON;');
});

function init() {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    return new Promise((resolve, reject) => {
        db.exec(schema, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

// Migração: adiciona colunas que não existem em bancos já criados
const LEAD_MIGRATIONS = {
    renda: 'TEXT',
    valor_desejado: 'TEXT',
    obs: 'TEXT',
    prioridade: "TEXT NOT NULL DEFAULT 'media'",
    score: 'INTEGER'
};

const NUMBER_MIGRATIONS = {
    cooled_until: 'TEXT'
};

const CAMPAIGN_MIGRATIONS = {
    error: 'TEXT',
    filters: 'TEXT'
};

async function migrate() {
    const leadCols = await all(`PRAGMA table_info(leads)`);
    const leadExisting = new Set(leadCols.map(c => c.name));
    for (const [name, def] of Object.entries(LEAD_MIGRATIONS)) {
        if (!leadExisting.has(name)) {
            await run(`ALTER TABLE leads ADD COLUMN ${name} ${def}`);
            console.log(`[db] migração: coluna leads.${name} adicionada`);
        }
    }

    const numCols = await all(`PRAGMA table_info(bot_numbers)`);
    const numExisting = new Set(numCols.map(c => c.name));
    for (const [name, def] of Object.entries(NUMBER_MIGRATIONS)) {
        if (!numExisting.has(name)) {
            await run(`ALTER TABLE bot_numbers ADD COLUMN ${name} ${def}`);
            console.log(`[db] migração: coluna bot_numbers.${name} adicionada`);
        }
    }

    const campCols = await all(`PRAGMA table_info(campaigns)`);
    const campExisting = new Set(campCols.map(c => c.name));
    for (const [name, def] of Object.entries(CAMPAIGN_MIGRATIONS)) {
        if (!campExisting.has(name)) {
            await run(`ALTER TABLE campaigns ADD COLUMN ${name} ${def}`);
            console.log(`[db] migração: coluna campaigns.${name} adicionada`);
        }
    }

    // Follow-ups usam sends com campaign_id NULL (não fazem parte de campanha)
    const sendCols = await all(`PRAGMA table_info(sends)`);
    const sendCampCol = sendCols.find(c => c.name === 'campaign_id');
    if (sendCampCol && sendCampCol.notnull === 1) {
        console.log('[db] migração: sends.campaign_id → aceita NULL (follow-ups)...');
        await db.run('PRAGMA foreign_keys = OFF');
        await run(`ALTER TABLE sends RENAME TO sends_old`);
        await run(`CREATE TABLE sends (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER REFERENCES campaigns(id),
            lead_id     INTEGER NOT NULL REFERENCES leads(id),
            number_id   INTEGER NOT NULL REFERENCES bot_numbers(id),
            status      TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','sent','confirmado','recusado','falhou','caiu')),
            wa_message  TEXT,
            sent_at     TEXT,
            replied_at  TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )`);
        await run(`INSERT INTO sends (id, campaign_id, lead_id, number_id, status, wa_message, sent_at, replied_at, created_at)
                   SELECT id, campaign_id, lead_id, number_id, status, wa_message, sent_at, replied_at, created_at FROM sends_old`);
        await run(`DROP TABLE sends_old`);
        await run(`CREATE INDEX IF NOT EXISTS idx_sends_campaign ON sends(campaign_id)`);
        await run(`CREATE INDEX IF NOT EXISTS idx_sends_lead ON sends(lead_id)`);
        await run(`UPDATE sqlite_sequence SET seq = COALESCE((SELECT MAX(id) FROM sends), 0) WHERE name = 'sends'`);
        await db.run('PRAGMA foreign_keys = ON');
        console.log('[db] sends rebuild concluído');
    }

    // Tabelas novas (criadas no schema.sql — reforço para bancos antigos)
    await run(`CREATE TABLE IF NOT EXISTS stage_config (
        status     TEXT PRIMARY KEY,
        config     TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    await run(`CREATE TABLE IF NOT EXISTS jobs (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        type         TEXT NOT NULL,
        ref_id       INTEGER,
        seller_id    INTEGER,
        payload      TEXT,
        status       TEXT NOT NULL DEFAULT 'waiting'
                     CHECK (status IN ('waiting','running','done','failed','cancelled')),
        attempts     INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        run_after    TEXT,
        error        TEXT,
        result       TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        started_at   TEXT,
        finished_at  TEXT
    )`);
    await run(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_jobs_type_ref ON jobs(type, ref_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_jobs_seller ON jobs(seller_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_jobs_waiting ON jobs(status, run_after)`);

    // Timeline dos bots de disparo
    await run(`CREATE TABLE IF NOT EXISTS bot_events (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        number     TEXT NOT NULL,
        label      TEXT,
        type       TEXT NOT NULL,
        detail     TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    await run(`CREATE INDEX IF NOT EXISTS idx_bot_events_number ON bot_events(number, created_at DESC)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_bot_events_created ON bot_events(created_at DESC)`);

    // Marketing: status promocionais agendados para os bots
    await run(`CREATE TABLE IF NOT EXISTS marketing_posts (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        title        TEXT NOT NULL,
        type         TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text','image','link')),
        message      TEXT,
        media_url    TEXT,
        color        TEXT NOT NULL DEFAULT 'teal',
        font         TEXT NOT NULL DEFAULT '2',
        number_id    INTEGER REFERENCES bot_numbers(id),
        scheduled_at TEXT,
        recurring    INTEGER NOT NULL DEFAULT 0,
        status       TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','sent','failed','cancelled')),
        error        TEXT,
        sent_at      TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    await run(`CREATE INDEX IF NOT EXISTS idx_marketing_posts_status ON marketing_posts(status, scheduled_at)`);

    // Follow-up: reenvios automáticos para leads sem resposta
    await run(`CREATE TABLE IF NOT EXISTS followups (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id    INTEGER NOT NULL,
        seller_id  INTEGER NOT NULL,
        bucket     INTEGER NOT NULL,
        due_at     TEXT NOT NULL,
        status     TEXT NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','sent','skipped','cancelled')),
        message    TEXT,
        number_id  INTEGER REFERENCES bot_numbers(id),
        sent_at    TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (lead_id, bucket)
    )`);
    await run(`CREATE INDEX IF NOT EXISTS idx_followups_status ON followups(status, due_at)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_followups_lead ON followups(lead_id)`);
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

module.exports = { db, init, migrate, run, get, all };