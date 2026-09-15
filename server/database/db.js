const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { phoneKey } = require('../utils/phone');

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
    score: 'INTEGER',
    cpf: 'TEXT',
    tags: 'TEXT',
    phone2: 'TEXT',
    phone3: 'TEXT',
    lead_code: 'TEXT',
    triage_status: "TEXT NOT NULL DEFAULT 'pending'", // pending|sent|qualified|declined|blocked
    triage_bot_number_id: 'INTEGER',
    agencia: 'TEXT',
    conta: 'TEXT'
};

const NUMBER_MIGRATIONS = {
    cooled_until: 'TEXT',
    messages_reset_at: 'TEXT',
    seller_id: 'INTEGER',
    slot_index: 'INTEGER',   // posição do slot fixo (1..cfg_wa_slots) — null para números cadastrados manualmente
    real_number: 'TEXT',     // WhatsApp de fato vinculado após o scan do QR (pode diferir do "number" interno do slot)
    push_name: 'TEXT',
    daily_limit_override: 'INTEGER', // limite diário próprio deste número — nulo = usa cfg_daily_limit global
    usage_type: "TEXT NOT NULL DEFAULT 'disposable'", // institutional|disposable|seller_attendance|borrowed_disposable
    campaign_enabled: 'INTEGER NOT NULL DEFAULT 1' // 1 = pode ser usado em campanhas/triagem; 0 = só atendimento
};

const CAMPAIGN_MIGRATIONS = {
    error: 'TEXT',
    filters: 'TEXT',
    organization_id: 'INTEGER NOT NULL DEFAULT 1',
    scheduled_at: 'TEXT',
    template_id: 'INTEGER' // qual message_templates gerou a mensagem (nulo = escrita livre) — habilita relatório de resposta/conversão por template
};

const SELLER_MIGRATIONS = { organization_id: 'INTEGER NOT NULL DEFAULT 1' };
const LEAD_ORG_MIGRATIONS = { organization_id: 'INTEGER NOT NULL DEFAULT 1' };
const BOT_ORG_MIGRATIONS = { organization_id: 'INTEGER NOT NULL DEFAULT 1' };

async function addMissingColumns(table, definitions) {
    const cols = await all(`PRAGMA table_info(${table})`);
    const existing = new Set(cols.map(c => c.name));
    for (const [name, def] of Object.entries(definitions)) {
        if (!existing.has(name)) {
            await run(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
            console.log(`[db] migração: coluna ${table}.${name} adicionada`);
        }
    }
}

async function migrateLeadStatusConstraint() {
    const row = await get("SELECT sql FROM sqlite_master WHERE type='table' AND name='leads'");
    const sql = row?.sql || '';
    if (!sql || sql.includes("'novos'") || !sql.includes("'novo'")) return;

    console.log('[db] migração: leads.status → novos/enviados/sim/nao...');
    await run('PRAGMA foreign_keys = OFF');
    await run('BEGIN IMMEDIATE');
    try {
        await run('ALTER TABLE leads RENAME TO leads_old_status');
        await run(`CREATE TABLE leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
            seller_id INTEGER NOT NULL REFERENCES sellers(id),
            name TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            cpf TEXT,
            agencia TEXT,
            conta TEXT,
            tags TEXT,
            city TEXT,
            origem TEXT NOT NULL DEFAULT 'SITE',
            limite_est TEXT,
            renda TEXT,
            valor_desejado TEXT,
            obs TEXT,
            prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('alta','media','baixa')),
            score INTEGER,
            lead_code TEXT,
            triage_status TEXT NOT NULL DEFAULT 'pending',
            triage_bot_number_id INTEGER REFERENCES bot_numbers(id),
            phone2 TEXT,
            phone3 TEXT,
            status TEXT NOT NULL DEFAULT 'novos' CHECK (status IN ('novos','enviados','sim','nao','bloqueado','duplicado')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`);
        await run(`INSERT INTO leads (
            id, organization_id, seller_id, name, phone, cpf, tags, city, origem, limite_est,
            renda, valor_desejado, obs, prioridade, score, lead_code, triage_status,
            triage_bot_number_id, phone2, phone3, status, created_at, updated_at
        )
        SELECT
            id, COALESCE(organization_id, 1), seller_id, name, phone, cpf, tags, city, COALESCE(origem, 'SITE'), limite_est,
            renda, valor_desejado, obs, COALESCE(prioridade, 'media'), score, lead_code,
            COALESCE(triage_status, 'pending'), triage_bot_number_id, phone2, phone3,
            CASE status WHEN 'novo' THEN 'novos' WHEN 'contato' THEN 'enviados' WHEN 'confirmado' THEN 'sim' WHEN 'concluido' THEN 'sim' ELSE status END,
            COALESCE(created_at, datetime('now')), COALESCE(updated_at, datetime('now'))
        FROM leads_old_status`);
        await run('DROP TABLE leads_old_status');
        await run(`UPDATE sqlite_sequence SET seq = COALESCE((SELECT MAX(id) FROM leads), 0) WHERE name = 'leads'`);
        await run('COMMIT');
        console.log('[db] leads.status rebuild concluído');
    } catch (e) {
        await run('ROLLBACK').catch(() => {});
        throw e;
    } finally {
        await run('PRAGMA foreign_keys = ON');
    }
}

async function migrate() {
    await run(`CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    await run("INSERT OR IGNORE INTO organizations (id, name) VALUES (1, 'Prime Sul')");
    await addMissingColumns('sellers', SELLER_MIGRATIONS);
    await addMissingColumns('leads', LEAD_ORG_MIGRATIONS);
    await addMissingColumns('bot_numbers', BOT_ORG_MIGRATIONS);
    await run('CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(organization_id)');
    const leadCols = await all(`PRAGMA table_info(leads)`);
    const leadExisting = new Set(leadCols.map(c => c.name));
    for (const [name, def] of Object.entries(LEAD_MIGRATIONS)) {
        if (!leadExisting.has(name)) {
            await run(`ALTER TABLE leads ADD COLUMN ${name} ${def}`);
            console.log(`[db] migração: coluna leads.${name} adicionada`);
        }
    }
    await migrateLeadStatusConstraint();
    await run("UPDATE leads SET lead_code = 'V' || seller_id || '-' || printf('%06d', id) WHERE lead_code IS NULL OR lead_code = ''");
    await run("UPDATE leads SET status = CASE status WHEN 'novo' THEN 'novos' WHEN 'contato' THEN 'enviados' WHEN 'confirmado' THEN 'sim' WHEN 'concluido' THEN 'sim' ELSE status END WHERE status IN ('novo','contato','confirmado','concluido')");
    await run("UPDATE leads SET triage_status = CASE WHEN status = 'sim' THEN 'qualified' WHEN status = 'nao' THEN 'declined' WHEN status = 'enviados' THEN 'sent' ELSE COALESCE(triage_status, 'pending') END WHERE triage_status IS NULL OR triage_status = 'pending'");
    await run('CREATE INDEX IF NOT EXISTS idx_leads_cpf ON leads(cpf)');
    await run('CREATE INDEX IF NOT EXISTS idx_leads_code ON leads(lead_code)');

    const numCols = await all(`PRAGMA table_info(bot_numbers)`);
    const numExisting = new Set(numCols.map(c => c.name));
    for (const [name, def] of Object.entries(NUMBER_MIGRATIONS)) {
        if (!numExisting.has(name)) {
            await run(`ALTER TABLE bot_numbers ADD COLUMN ${name} ${def}`);
            console.log(`[db] migração: coluna bot_numbers.${name} adicionada`);
        }
    }
    await run(`UPDATE bot_numbers
        SET usage_type = CASE
                WHEN seller_id IS NULL THEN COALESCE(NULLIF(usage_type, ''), 'institutional')
                ELSE 'seller_attendance'
            END,
            campaign_enabled = CASE WHEN seller_id IS NULL THEN COALESCE(campaign_enabled, 1) ELSE 0 END
        WHERE usage_type IS NULL OR usage_type = 'disposable'`);
    await run('CREATE INDEX IF NOT EXISTS idx_bot_numbers_owner ON bot_numbers(organization_id, seller_id, status)');
    await run('CREATE INDEX IF NOT EXISTS idx_bot_numbers_campaign ON bot_numbers(organization_id, campaign_enabled, status)');

    const campCols = await all(`PRAGMA table_info(campaigns)`);
    const campExisting = new Set(campCols.map(c => c.name));
    for (const [name, def] of Object.entries(CAMPAIGN_MIGRATIONS)) {
        if (!campExisting.has(name)) {
            await run(`ALTER TABLE campaigns ADD COLUMN ${name} ${def}`);
            console.log(`[db] migração: coluna campaigns.${name} adicionada`);
        }
    }

    await run(`CREATE TABLE IF NOT EXISTS seller_numbers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
        seller_id INTEGER NOT NULL REFERENCES sellers(id), number TEXT NOT NULL UNIQUE,
        label TEXT, active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    await run('CREATE INDEX IF NOT EXISTS idx_seller_numbers_seller ON seller_numbers(seller_id, active)');
    await run(`CREATE TABLE IF NOT EXISTS opt_outs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
        phone TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (organization_id, phone)
    )`);
    await run(`CREATE TABLE IF NOT EXISTS handoffs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
        lead_id INTEGER NOT NULL REFERENCES leads(id), seller_id INTEGER NOT NULL REFERENCES sellers(id),
        send_id INTEGER REFERENCES sends(id), seller_number_id INTEGER REFERENCES seller_numbers(id),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','replied','failed','cancelled')),
        attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 5,
        run_after TEXT, error TEXT, sent_at TEXT, replied_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (send_id)
    )`);
    await run('CREATE INDEX IF NOT EXISTS idx_handoffs_due ON handoffs(status, run_after)');
    await run('CREATE INDEX IF NOT EXISTS idx_handoffs_seller ON handoffs(seller_id, status)');
    await run(`CREATE TABLE IF NOT EXISTS message_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id), seller_id INTEGER REFERENCES sellers(id),
        name TEXT NOT NULL, purpose TEXT NOT NULL CHECK (purpose IN ('screening','handoff','followup')),
        body TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

    // Preserva o telefone legado do vendedor como seu primeiro número operacional.
    await run(`INSERT OR IGNORE INTO seller_numbers (organization_id, seller_id, number, label)
               SELECT organization_id, id, phone, 'principal' FROM sellers WHERE phone IS NOT NULL AND phone != ''`);

    // Follow-ups usam sends com campaign_id NULL (não fazem parte de campanha)
    const sendCols = await all(`PRAGMA table_info(sends)`);
    const sendCampCol = sendCols.find(c => c.name === 'campaign_id');
    if (sendCampCol && sendCampCol.notnull === 1) {
        console.log('[db] migração: sends.campaign_id → aceita NULL (follow-ups)...');
        await run('PRAGMA foreign_keys = OFF');
        await run('BEGIN IMMEDIATE');
        try {
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
        await run('COMMIT');
        } catch (e) {
            await run('ROLLBACK').catch(() => {});
            throw e;
        } finally {
            await run('PRAGMA foreign_keys = ON');
        }
        console.log('[db] sends rebuild concluído');
    }

    // Tabelas novas (criadas no schema.sql — reforço para bancos antigos)
    await run(`CREATE TABLE IF NOT EXISTS stage_config (
        status     TEXT PRIMARY KEY,
        config     TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    await run(`CREATE TABLE IF NOT EXISTS seller_stage_config (
        organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
        seller_id INTEGER NOT NULL REFERENCES sellers(id), status TEXT NOT NULL,
        config TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (seller_id, status)
    )`);
    await run('CREATE INDEX IF NOT EXISTS idx_seller_stage_config_org ON seller_stage_config(organization_id, seller_id)');
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

    // Caixa de entrada: histórico completo de mensagens (entrada e saída), por
    // "thread" = (número do cliente, número nosso que atendeu). Um lead pode ter
    // vários threads (telefone 1, 2, 3) e ser atendido por bots diferentes.
    await run(`CREATE TABLE IF NOT EXISTS messages (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL DEFAULT 1,
        lead_id         INTEGER REFERENCES leads(id),
        lead_phone      TEXT NOT NULL,
        bot_number      TEXT NOT NULL,
        direction       TEXT NOT NULL CHECK (direction IN ('in','out')),
        body            TEXT,
        wa_message_id   TEXT,
        status          TEXT,
        read_at         TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    await run(`CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id, created_at)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(lead_phone, bot_number, created_at)`);
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_waid ON messages(wa_message_id) WHERE wa_message_id IS NOT NULL`);

    await mergeDuplicateLeadsByPhone();
}

function leadMergeRank(l) {
    const statusScore = { sim: 60, enviados: 50, novos: 40, nao: 20, bloqueado: 5, duplicado: 0 }[l.status] ?? 30;
    const dataScore = (l.cpf ? 3 : 0) + (l.city ? 1 : 0) + (l.obs ? 1 : 0) + (l.tags ? 1 : 0);
    return statusScore + dataScore;
}

function mergeTags(a, b) {
    return [...new Set(String(a || '').split(',').concat(String(b || '').split(',')).map(s => s.trim()).filter(Boolean))].join(',');
}

async function mergeDuplicateLeadsByPhone() {
    const leads = await all('SELECT * FROM leads ORDER BY organization_id, seller_id, id');
    const groups = new Map();
    for (const l of leads) {
        const key = phoneKey(l.phone);
        if (!key) continue;
        const groupKey = `${l.organization_id || 1}|${l.seller_id}|${key}`;
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey).push(l);
    }

    let merged = 0;
    for (const group of groups.values()) {
        if (group.length < 2) continue;
        group.sort((a, b) => {
            const r = leadMergeRank(b) - leadMergeRank(a);
            if (r) return r;
            return Number(a.id) - Number(b.id);
        });
        const keeper = group[0];
        const duplicates = group.slice(1);

        for (const dup of duplicates) {
            await run('BEGIN IMMEDIATE');
            try {
                const next = {
                    cpf: keeper.cpf || dup.cpf || null,
                    tags: mergeTags(keeper.tags, dup.tags) || null,
                    city: keeper.city || dup.city || null,
                    origem: keeper.origem || dup.origem || 'SITE',
                    limite_est: keeper.limite_est || dup.limite_est || null,
                    renda: keeper.renda || dup.renda || null,
                    valor_desejado: keeper.valor_desejado || dup.valor_desejado || null,
                    obs: [keeper.obs, dup.obs && `Mesclado do lead #${dup.id}: ${dup.obs}`].filter(Boolean).join('\n') || null,
                    prioridade: keeper.prioridade === 'alta' || dup.prioridade === 'alta' ? 'alta' : (keeper.prioridade || dup.prioridade || 'media'),
                    score: Math.max(Number(keeper.score || 0), Number(dup.score || 0)) || keeper.score || dup.score || null,
                    triage_status: keeper.triage_status !== 'pending' ? keeper.triage_status : (dup.triage_status || keeper.triage_status || 'pending'),
                    triage_bot_number_id: keeper.triage_bot_number_id || dup.triage_bot_number_id || null
                };
                await run(`UPDATE leads SET cpf=?, tags=?, city=?, origem=?, limite_est=?, renda=?, valor_desejado=?, obs=?, prioridade=?, score=?, triage_status=?, triage_bot_number_id=?, updated_at=datetime('now') WHERE id=?`,
                    [next.cpf, next.tags, next.city, next.origem, next.limite_est, next.renda, next.valor_desejado, next.obs, next.prioridade, next.score, next.triage_status, next.triage_bot_number_id, keeper.id]);

                await run('UPDATE messages SET lead_id=?, lead_phone=? WHERE lead_id=?', [keeper.id, phoneKey(keeper.phone) || keeper.phone, dup.id]);
                await run('UPDATE sends SET lead_id=? WHERE lead_id=?', [keeper.id, dup.id]);
                await run('UPDATE lead_history SET lead_id=? WHERE lead_id=?', [keeper.id, dup.id]);
                await run('UPDATE handoffs SET lead_id=? WHERE lead_id=?', [keeper.id, dup.id]);

                const fups = await all('SELECT * FROM followups WHERE lead_id=?', [dup.id]);
                for (const f of fups) {
                    const exists = await get('SELECT id FROM followups WHERE lead_id=? AND bucket=?', [keeper.id, f.bucket]);
                    if (exists) await run('DELETE FROM followups WHERE id=?', [f.id]);
                    else await run('UPDATE followups SET lead_id=? WHERE id=?', [keeper.id, f.id]);
                }

                await run('DELETE FROM leads WHERE id=?', [dup.id]);
                await run('COMMIT');
                merged++;
                console.log(`[db] lead duplicado mesclado: #${dup.id} → #${keeper.id} (${keeper.phone})`);
            } catch (e) {
                await run('ROLLBACK').catch(() => {});
                throw e;
            }
        }
    }
    if (merged) console.log(`[db] leads mesclados por telefone com/sem 9: ${merged}`);
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
