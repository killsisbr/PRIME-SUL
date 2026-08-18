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