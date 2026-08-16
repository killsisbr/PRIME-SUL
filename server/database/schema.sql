-- ==================== PRIME SUL — Schema ====================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Vendedores (multi-tenant)
CREATE TABLE IF NOT EXISTS sellers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
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
    seller_id     INTEGER NOT NULL REFERENCES sellers(id),
    name          TEXT NOT NULL,
    phone         TEXT NOT NULL UNIQUE,          -- telefone normalizado (E.164)
    city          TEXT,
    origem        TEXT NOT NULL DEFAULT 'SITE',
    limite_est    TEXT,
    renda         TEXT,                          -- renda estimada
    valor_desejado TEXT,                         -- valor desejado de crédito
    obs           TEXT,                          -- observações do vendedor
    prioridade    TEXT NOT NULL DEFAULT 'media'
                  CHECK (prioridade IN ('alta','media','baixa')),
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
    number       TEXT NOT NULL UNIQUE,           -- E.164
    label        TEXT,
    status       TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','resfriado','banido')),
    messages_sent INTEGER NOT NULL DEFAULT 0,
    cooled_until TEXT,                           -- reativação automática (ISO UTC) quando resfriado
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Campanhas de disparo
CREATE TABLE IF NOT EXISTS campaigns (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
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
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
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