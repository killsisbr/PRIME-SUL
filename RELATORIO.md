# Relatório — PRIME SUL (SaaS de CRM + Disparo WhatsApp)

> Gerado em 18/08/2026. Estado atual do projeto: funcional e testável localmente.

## 1. Estado geral

Sistema **funcional** rodando em Node.js + Express + SQLite (porta 5000), com frontend completo, autenticação, painéis por perfil e automações de disparo. Os **bots WhatsApp estão desabilitados por hora** (`BOT_ENABLED=false` — modo dry-run), mantendo-se ativos o cadastro de leads, a organização de clientes e o funil de disparo.

- Git: 26 commits; working tree com alterações não commitadas.
- Banco já populado (dados de teste).

## 2. Stack confirmada

| Camada | Tecnologia |
|--------|------------|
| Backend | Node.js + Express |
| Banco | SQLite (WAL mode) — 15 tabelas |
| Auth | JWT em cookie HttpOnly + bcrypt, rate-limit de login |
| WhatsApp | Baileys multi-session (desabilitado no momento) |
| Fila | Em processo, persistente em SQLite |
| Frontend | HTML vanilla + CSS puro (design system neo-brutalista, tokens) |

## 3. Estrutura do projeto

```
PRIME SUL/
├── server/
│   ├── server.js                  # Entry point (bootstrap, intervalos 60s)
│   ├── routes/                    # 12 rotas de API
│   ├── services/                  # 15 serviços de negócio
│   ├── middleware/auth.js         # JWT + adminOnly
│   ├── database/                  # db.js, schema.sql, seed.js
│   └── utils/phone.js             # Normalização E.164
├── public/
│   ├── css/                       # tokens.css + design.css
│   ├── login.html                 # Login → redireciona pelo perfil
│   ├── admin.html                 # Painel admin (app-grid + HUD Ctrl+K)
│   ├── operador.html              # Painel vendedor
│   └── admin/components/          # Módulos (hub, funil, leads, campanhas, ...)
├── data/                          # SQLite + sessões (gitignored)
├── scripts/check.js               # Validação do projeto
├── test/                          # Testes Node (node:test)
└── package.json
```

## 4. Backend — API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login → JWT (cookie HttpOnly) |
| POST | `/api/auth/logout` | Encerra sessão |
| GET | `/api/leads` | Lista leads do vendedor (filtros: status, busca, origem, prioridade, cidade, datas, score) |
| POST | `/api/leads` | Cadastra lead (409 se duplicado por outro vendedor / opt-out) |
| GET | `/api/leads/counts` | Contadores do painel |
| GET | `/api/leads/funnel` | Funil: estágios, conversões e gargalo |
| GET/PATCH | `/api/leads/:id` | Detalhe / edição do lead |
| GET | `/api/leads/:id/history` | Timeline de status |
| PATCH | `/api/leads/:id/status` | Muda status (kanban / ações rápidas) |
| GET/POST | `/api/campaigns` | Lista / cria campanha |
| POST | `/api/campaigns/:id/start\|pause\|cancel\|retry` | Controle do disparo |
| GET | `/api/campaigns/numbers` | Números anti-ban visíveis ao perfil |
| POST/PATCH | `/api/campaigns/numbers` | Registra / muda status do número |
| POST | `/api/campaigns/targets/count` | Estimativa de alvos da campanha |
| GET/PUT | `/api/config` | Settings dinâmicas (admin) |
| GET | `/api/config/bot` | Config do bot parceiro BB (admin) |
| GET/POST | `/api/sellers` | Lista / cria vendedores (admin) |
| GET | `/api/sellers/me` | Perfil do operador |
| GET | `/api/sellers/:id/numbers` | Números operacionais do vendedor |
| POST/PATCH | `/api/sellers/:id/numbers` | Cadastra / ativa-desativa número do vendedor |
| POST | `/api/sellers/connections/:id/connect\|disconnect` | Conecta / desconecta bot do vendedor |
| GET | `/api/sellers/connections/:id/qr` | QR code da sessão |
| GET | `/api/whatsapp/status` | Status dos bots + números anti-ban |
| POST | `/api/whatsapp/connect\|disconnect` | Conecta / desconecta bot |
| GET | `/api/whatsapp/qr` | QR code atual |
| GET | `/api/bots/timeline` | Timeline de eventos (admin) |
| GET | `/api/bots/totals` | Totais agregados de disparos (admin) |
| GET/POST/PUT/DELETE | `/api/marketing/posts` | Posts promocionais de status (admin) |
| POST | `/api/marketing/posts/:id/send-now` | Publica status agora (admin) |
| GET | `/api/tools/jobs` | Fila persistente de jobs |
| POST | `/api/tools/recalc` | Recalcula score da coluna (job em massa) |
| POST | `/api/tools/move` | Move estágio da coluna (job em massa) |
| POST | `/api/tools/send` | Dispara mensagem para a coluna |
| GET/PUT | `/api/tools/stage-config` | Auto-disparo por estágio |
| GET | `/api/handoffs` | Repasses (handoff) do vendedor |
| GET/POST/DELETE | `/api/templates` | Templates de mensagem versionados |

## 5. Serviços de negócio

### Cadastro e organização de clientes
- **lead-service** — CRUD, duplicidade global (bloqueio se outro vendedor já cadastrou), validações, score automático, funil por estágio, histórico de status.
- **score-service** — Score 0-100 explicável (renda, valor desejado, limite, origem, prioridade, estágio), recálculo em massa.

### Funil de disparo
- **campaign-service** — Disparo em massa em lotes com delay, filtros de alvo, progresso ao vivo, pause/resume/cancel, retry de falhas, auto-resume, persistência em fila (sobrevive a restart).
- **job-queue-service** — Fila persistente de jobs (ações em massa como mover estágio e recalcular score), retry com backoff, recuperação após restart.
- **stage-config-service** — Configuração por coluna: auto-disparo ao entrar em Novo/Em contato, isolada por vendedor.

### Anti-ban / bots (desabilitados por hora)
- **anti-ban-service** — Números descartáveis, limite diário, cooldown/resfriamento, rotação (menos usado), reativação automática, detecção de ban.
- **whatsapp-service** — Baileys multi-session, QR code, reconexão com backoff 10→30s, health-check anti-deadlock, quarentena de sessão corrompida, simulação de presença humana.
- **bot-flow-service** — Reconhece sim/não/opt-out, confirmação idempotente.
- **handoff-service** — Repasse persistente ao vendedor, retentativas, arquivar/desarquivar chat.
- **marketing-service** — Posts de status promocionais, agendamento, recorrência diária.
- **followup-service** — Reenvio automático em buckets 3/7/14/30 dias (settings `cfg_followup_*`).

## 6. Banco de dados (schema — 15 tabelas)

| Tabela | Finalidade |
|--------|------------|
| `organizations` | Tenants (nasce com "Prime Sul") |
| `sellers` | Vendedores/admin (multi-tenant) |
| `leads` | Contatos capturados (score, prioridade, status) |
| `lead_history` | Timeline de mudanças de status |
| `bot_numbers` | Números descartáveis anti-ban |
| `campaigns` | Campanhas de disparo |
| `sends` | 1 envio por lead por campanha |
| `settings` | Configurações dinâmicas (painel) |
| `seller_numbers` | Números operacionais do vendedor |
| `opt_outs` | Bloqueio/opt-out permanente |
| `handoffs` | Repasse durável do lead confirmado |
| `message_templates` | Templates versionados (screening/handoff/followup) |
| `stage_config` / `seller_stage_config` | Auto-ferramentas por coluna |
| `jobs` | Fila persistente de jobs |
| `bot_events` | Timeline dos bots |
| `marketing_posts` | Posts promocionais |
| `followups` | Follow-ups agendados |

## 7. Frontend

### Login (`/login.html`)
- Redireciona pelo perfil (admin → `admin.html`, vendedor → `operador.html`).

### Painel admin (`/admin.html`)
- App-grid + HUD (**Ctrl+K**), modais dinâmicos, toasts.
- Módulos: Funil de Vendas, Leads (kanban drag & drop), Campanhas, Vendedores, Configuração.
- Módulos de bot/anti-ban ocultos por hora: Hub de Disparo, Bots WhatsApp, Timeline dos Bots, Marketing & Status, Números Anti-Ban.

### Painel operador (`/operador.html`)
- Módulos: Funil de Vendas, Leads, Campanhas.

### Design system
- `tokens.css` (única fonte de tokens) + `design.css` (base) + blocos `ps-*` compartilhados — Neo-Brutalista.

## 8. Segurança

- JWT em cookie HttpOnly + SameSite=strict (secure em produção).
- Rate-limit de login: 10 tentativas / 15 min por IP.
- `adminOnly` nas rotas de admin; isolamento de dados por `organization_id`/`seller_id`.
- Headers: CSP, nosniff, X-Frame-Options DENY, no-referrer, permissions-policy.
- Erros mascarados no cliente (não expõe stack).

## 9. Testes

- `test/core.test.js` (5 testes): normalização de telefone, isolamento entre vendedores, idempotência de confirmação/handoff, rotação de números, automação isolada por vendedor.
- `test/legacy-migration.test.js` (validação de migração).
- Rodam com `npm test` (DB temporário, bots desligados).

## 10. Como rodar

```bash
npm install
cp .env.example .env          # ajuste JWT_SECRET e SEED_ADMIN_PASS
npm run seed                  # cria o administrador inicial
npm run dev                   # http://localhost:5000
```

Login atual (redefinido para teste local):
- **Admin**: `admin@primesul.com.br` / `admin12345678`

## 11. Pendências

- ⬜ Ativar bots reais (`BOT_ENABLED=true` + escanear QR) quando necessário.
- ⬜ Webhook de captura do site → `/api/leads`.
- ⬜ Migrar a fila para BullMQ/Redis quando houver múltiplas VPS/processos.