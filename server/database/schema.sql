-- ==================== PRIME SUL — Schema ====================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Empresas/tenants. A instalação atual nasce com uma organização padrão.
CREATE TABLE IF NOT EXISTS organizations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    active     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO organizations (id, name) VALUES (1, 'Prime Sul');

-- Vendedores (multi-tenant)
CREATE TABLE IF NOT EXISTS sellers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    phone       TEXT NOT NULL UNIQUE,           -- bot number do vendedor (com DDI 55)
    role        TEXT NOT NULL DEFAULT 'seller' CHECK (role IN ('seller','admin')),
    active      INTEGER NOT NULL DEFAULT 1,
    max_leads   INTEGER NOT NULL DEFAULT 0,      -- 0 = ilimitado
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Leads (contatos capturados do site)
CREATE TABLE IF NOT EXISTS leads (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
    seller_id     INTEGER NOT NULL REFERENCES sellers(id),
    name          TEXT NOT NULL,
    phone         TEXT NOT NULL UNIQUE,          -- telefone normalizado (E.164)
    cpf           TEXT,                          -- identificador forte (formato livre/limpo)
    tags          TEXT,                          -- lista separada por vírgula (ex.: quente, prioridade)
    city          TEXT,
    origem        TEXT NOT NULL DEFAULT 'SITE',
    limite_est    TEXT,
    renda         TEXT,                          -- renda estimada
    valor_desejado TEXT,                         -- valor desejado de crédito
    obs           TEXT,                          -- observações do vendedor
    prioridade    TEXT NOT NULL DEFAULT 'media'
                  CHECK (prioridade IN ('alta','media','baixa')),
    score         INTEGER,                          -- 0-100 calculado automaticamente
    status        TEXT NOT NULL DEFAULT 'novo'
                  CHECK (status IN ('novo','contato','confirmado','concluido','bloqueado','duplicado')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Histórico de mudanças de status dos leads (timeline)
CREATE TABLE IF NOT EXISTS lead_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id     INTEGER NOT NULL REFERENCES leads(id),
    seller_id   INTEGER NOT NULL REFERENCES sellers(id),
    from_status TEXT,
    to_status   TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Números (descartáveis) do bot principal anti-ban
CREATE TABLE IF NOT EXISTS bot_numbers (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
    seller_id    INTEGER REFERENCES sellers(id), -- NULL = institucional compartilhado
    number       TEXT NOT NULL UNIQUE,           -- E.164
    label        TEXT,
    status       TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','resfriado','banido')),
    messages_sent INTEGER NOT NULL DEFAULT 0,
    messages_reset_at TEXT,
    cooled_until TEXT,                           -- reativação automática (ISO UTC) quando resfriado
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Campanhas de disparo
CREATE TABLE IF NOT EXISTS campaigns (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
    seller_id    INTEGER REFERENCES sellers(id),
    number_id    INTEGER REFERENCES bot_numbers(id),
    name         TEXT NOT NULL,
    message      TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','running','paused','done','cancelled')),
    error        TEXT,                           -- motivo da pausa (ex: not_connected)
    filters      TEXT,                           -- JSON com filtros do alvo usados na criação
    total_target INTEGER NOT NULL DEFAULT 0,
    total_sent   INTEGER NOT NULL DEFAULT 0,
    total_yes    INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Envios (1 por lead por campanha)
CREATE TABLE IF NOT EXISTS sends (
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
);

CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_seller ON leads(seller_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_lead_history_lead ON lead_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_sends_campaign ON sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sends_lead ON sends(lead_id);

-- Configurações do sistema (parceira BB, templates, limites anti-ban)
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- Números operacionais pertencentes a vendedores (separados da triagem institucional).
CREATE TABLE IF NOT EXISTS seller_numbers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
    seller_id       INTEGER NOT NULL REFERENCES sellers(id),
    number          TEXT NOT NULL UNIQUE,
    label           TEXT,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_seller_numbers_seller ON seller_numbers(seller_id, active);

-- Bloqueio/opt-out permanente por empresa.
CREATE TABLE IF NOT EXISTS opt_outs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
    phone           TEXT NOT NULL,
    reason          TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (organization_id, phone)
);

-- Repasse durável do lead confirmado para um número do vendedor.
CREATE TABLE IF NOT EXISTS handoffs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id  INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
    lead_id           INTEGER NOT NULL REFERENCES leads(id),
    seller_id         INTEGER NOT NULL REFERENCES sellers(id),
    send_id           INTEGER REFERENCES sends(id),
    seller_number_id  INTEGER REFERENCES seller_numbers(id),
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','sending','sent','replied','failed','cancelled')),
    attempts          INTEGER NOT NULL DEFAULT 0,
    max_attempts      INTEGER NOT NULL DEFAULT 5,
    run_after         TEXT,
    error             TEXT,
    sent_at           TEXT,
    replied_at        TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (send_id)
);
CREATE INDEX IF NOT EXISTS idx_handoffs_due ON handoffs(status, run_after);
CREATE INDEX IF NOT EXISTS idx_handoffs_seller ON handoffs(seller_id, status);

-- Templates versionados e com finalidade explícita.
CREATE TABLE IF NOT EXISTS message_templates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
    seller_id       INTEGER REFERENCES sellers(id),
    name            TEXT NOT NULL,
    purpose         TEXT NOT NULL CHECK (purpose IN ('screening','handoff','followup')),
    body            TEXT NOT NULL,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Configuração por coluna/estágio (auto-ferramentas: auto-disparo, etc.)
CREATE TABLE IF NOT EXISTS stage_config (
    status     TEXT PRIMARY KEY,
    config     TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Automação individual do funil por vendedor/estágio.
CREATE TABLE IF NOT EXISTS seller_stage_config (
    organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
    seller_id       INTEGER NOT NULL REFERENCES sellers(id),
    status          TEXT NOT NULL,
    config          TEXT NOT NULL DEFAULT '{}',
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (seller_id, status)
);
CREATE INDEX IF NOT EXISTS idx_seller_stage_config_org ON seller_stage_config(organization_id, seller_id);

-- Fila persistente de jobs (ações em massa, execuções longas)
CREATE TABLE IF NOT EXISTS jobs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    type         TEXT NOT NULL,
    ref_id       INTEGER,
    seller_id    INTEGER,
    payload      TEXT,                              -- JSON (progresso, resultados, params)
    status       TEXT NOT NULL DEFAULT 'waiting'
                 CHECK (status IN ('waiting','running','done','failed','cancelled')),
    attempts     INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    run_after    TEXT,                              -- agenda para depois (ISO/UTC)
    error        TEXT,
    result       TEXT,                              -- JSON de conclusão
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    started_at   TEXT,
    finished_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type_ref ON jobs(type, ref_id);
CREATE INDEX IF NOT EXISTS idx_jobs_seller ON jobs(seller_id);
CREATE INDEX IF NOT EXISTS idx_jobs_waiting ON jobs(status, run_after);

-- Timeline dos bots de disparo (eventos de conexão, envios, cooldowns, banimentos)
CREATE TABLE IF NOT EXISTS bot_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    number     TEXT NOT NULL,
    label      TEXT,
    type       TEXT NOT NULL,
    detail     TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bot_events_number ON bot_events(number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_events_created ON bot_events(created_at DESC);

-- Marketing: status promocionais agendados para os bots postarem no WhatsApp
CREATE TABLE IF NOT EXISTS marketing_posts (
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
);
CREATE INDEX IF NOT EXISTS idx_marketing_posts_status ON marketing_posts(status, scheduled_at);
