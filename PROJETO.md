# PRIME SUL — CRM + Disparo de Mensagens com Bot

## Visão Geral

Sistema CRM multi-tenant (por vendedor) integrado a disparo de mensagens em massa via bot, com estratégia **anti-ban** para reduzir banimentos de números.

A empresa tem acesso e permissão do **Banco do Brasil** para oferecer crédito a leads que pediram simulação. O contato do cliente é capturado via site deles e cadastrado no CRM.

## Objetivos

- Cadastrar leads por vendedor (cada vendedor tem sua própria lista).
- Impedir duplicidade de lead entre vendedores (não aceita lead já cadastrado por outro vendedor).
- Disparar mensagens em massa com bots.
- Reduzir a taxa de banimento com números descartáveis e boas práticas.

## Estratégia Anti-Ban

### Problema
Enviar mensagens em massa a partir de um único número gera banimento do número e perda dos contatos.

### Solução
Usar **números descartáveis** como porta de entrada:

1. O **bot principal** envia a mensagem para o lead quente usando um número descartável.
2. A mensagem pergunta se pode pedir para um vendedor encaminhar uma simulação.
3. Se o cliente responder **sim** (ou confirmar de alguma forma), o bot repassa o contato para o **bot do vendedor**.
4. O bot do vendedor entra em contato e finaliza a simulação.

### Racional
- De 1.000 contatos enviados, ~30% respondem "sim".
- Se o número descartável cair, apenas os 30% interessados são trabalhados pelos vendedores.
- Reduz o risco/impacto de banimento em ~70%.
- Combinar com outras boas práticas reduz ainda mais a taxa.

### Parâmetros dinâmicos
- Limite diário de envios por número (`cfg_daily_limit`, configurável no painel).
- Tamanho do lote e delay entre envios (`cfg_batch`, `cfg_delay`).
- Estado por número: `ativo`, `resfriado` (cooldown) ou `banido` (retirado de circulação).

## Fluxo de Trabalho

```
Captura do contato (site do cliente)
        │
        ▼
Cadastro no CRM (lista do vendedor responsável)
        │
        ▼
Regra de duplicidade: lead já cadastrado por outro vendedor é bloqueado
        │
        ▼
Bot principal (número descartável) envia msg de oferta
        │
        ▼
Lead confirma ("sim") ──► Repasse para o bot do vendedor
        │
        ▼
Bot do vendedor contata e finaliza a simulação
        │
        ▼
Acompanhamento no funil (novo → contato → confirmado → concluído)
```

## Funcionalidades Principais

### Multi-Tenant por Vendedor
- Cada vendedor possui seu login e sua lista de leads.
- Cada vendedor tem **X números** para cadastro/disparo.
- Isolamento total de dados entre vendedores.

### Cadastro de Leads
- Importação/entrada manual do contato.
- Validação de duplicidade global (não permite mesmo lead em dois vendedores).
- Status do lead: novo, em contato, confirmado, concluído, bloqueado, duplicado.

### Disparo em Massa (Bot)
- Números descartáveis por campanha/lote.
- Mensagem de oferta padronizada (template editável).
- Detecção de confirmação (sim/ok/1 etc.).
- Repasse automático ao bot do vendedor.

### Painel (`/admin.html`)
- Lista de leads com busca e filtro por status (módulo Leads em popup).
- Cadastro e mudança de status.
- Contadores: total, envios, conversão, confirmados.

### Painel Admin (`/admin.html`)
- App-grid com HUD (atalho **Ctrl+K**) e modais dinâmicos.
- Módulos:
  - **Hub de Disparo** — estratégia anti-ban e limites.
  - **Funil de Vendas** — visualização da conversão por estágio, taxas entre etapas e gargalo.
  - **Leads** — gestão completa com ações rápidas (confirmar/bloquear), score 0-100 por lead e ferramentas de coluna (recalcular score, mover estágio, disparar mensagem, auto-disparo).
  - **Campanhas** — criação, start/pause/cancel do disparo.
  - **Números Anti-Ban** — cadastro e mudança de status (ativo/resfriado/banido).
  - **Vendedores** — criação da equipe e limites.
  - **Configuração** — crédito BB (cnpj/parceiro), template de mensagem e limites dinâmicos.
- Design system Neo-Brutalista unificado (tokens em `public/css/tokens.css`).

## Stack Confirmada

| Camada | Tecnologia |
|--------|------------|
| Backend | Node.js + Express |
| Banco | SQLite (WAL mode) |
| Auth | JWT (bcrypt) |
| WhatsApp | Baileys (multi-session) |
| Fila | Em processo (delay entre envios) |
| Frontend | HTML vanilla + CSS puro (design system próprio, tokens) |

## Estrutura do Projeto

```
PRIME SUL/
├── server/
│   ├── server.js                  # Entry point
│   ├── routes/
│   │   ├── auth.js                # POST /api/auth/login
│   │   ├── sellers.js             # Vendedores (admin) + /me
│   │   ├── leads.js               # CRUD leads + duplicidade + funil
│   │   ├── campaigns.js           # Campanhas + números descartáveis
│   │   ├── config.js              # Settings dinâmicas (admin)
│   │   └── whatsapp.js            # Status dos bots
│   ├── services/
│   │   ├── lead-service.js        # Regra de duplicidade global + funil
│   │   ├── anti-ban-service.js    # Números descartáveis, limites, cooldown
│   │   ├── whatsapp-service.js    # Baileys multi-session
│   │   ├── campaign-service.js    # Fila de disparo em lotes
│   │   ├── bot-flow-service.js    # Confirmação (sim/não) → repasse
│   │   └── settings-service.js    # Leitura de settings dinâmicas
│   ├── middleware/auth.js         # JWT + adminOnly
│   ├── database/
│   │   ├── db.js                  # SQLite helper (promises)
│   │   ├── schema.sql             # Schema completo
│   │   └── seed.js                # Cria admin inicial
│   └── utils/phone.js             # Normalização E.164
├── public/
│   ├── css/
│   │   ├── tokens.css             # Design tokens (única fonte)
│   │   └── design.css             # Base do design system
│   ├── admin/
│   │   ├── css/components.css     # Blocos ps-* compartilhados
│   │   └── components/            # Módulos (html/css/js por módulo)
│   │       ├── hub / funil / leads / campanhas
│   │       ├── numeros / vendedores / config
│   ├── login.html                 # Login (admin e vendedor → admin.html)
│   └── admin.html                 # Painel único (app-grid + HUD Ctrl+K + modais/popups)
├── data/                          # SQLite + sessões Baileys (gitignored)
├── .env.example
└── package.json
```

## Como Rodar

```bash
npm install
cp .env.example .env          # ajuste JWT_SECRET
npm run seed                  # cria admin@primesul.com.br / admin123
npm run dev                   # http://localhost:5000
```

- Login (admin e vendedor) → `/admin.html`; módulos de admin (Bots, Números, Vendedores, Config) só aparecem para role admin.

## API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/leads` | Lista leads do vendedor (filtro por status/busca) |
| POST | `/api/leads` | Cadastra lead (409 se duplicado por outro vendedor) |
| GET | `/api/leads/counts` | Contadores do painel |
| GET | `/api/leads/funnel` | Funil: contagens por estágio + conversões + gargalo |
| PATCH | `/api/leads/:id/status` | Muda status do lead |
| GET | `/api/campaigns` | Campanhas do vendedor |
| POST | `/api/campaigns` | Cria campanha |
| POST | `/api/campaigns/:id/start` | Inicia disparo |
| POST | `/api/campaigns/:id/pause` | Pausa disparo |
| POST | `/api/campaigns/:id/cancel` | Cancela disparo |
| GET | `/api/campaigns/numbers` | Números descartáveis |
| POST | `/api/campaigns/numbers` | Registra número |
| PATCH | `/api/campaigns/numbers/:id` | Status do número (ativo/resfriado/banido) |
| GET | `/api/config` | Settings dinâmicas (admin) |
| PUT | `/api/config` | Salva settings (upsert parcial) |
| GET | `/api/config/bot` | Settings do bot parceiro BB (cnpj/parceiro/template) |
| GET | `/api/sellers` | Lista vendedores (admin) |
| POST | `/api/sellers` | Cria vendedor (admin) |
| GET | `/api/sellers/me` | Perfil do vendedor |
| GET | `/api/whatsapp/status` | Status dos bots |

## Próximos Passos

- [x] Validar stack e arquitetura
- [x] Modelagem do banco (vendedor, lead, campanha, numero, envio)
- [x] Regras de negócio de duplicidade
- [x] Fluxo anti-ban (número descartável → confirmação → repasse)
- [x] Painel do vendedor (login + leads)
- [x] Painel admin (gestão de vendedores, números e configurações)
- [x] Tela de campanhas/disparo
- [x] Módulo funil de vendas
- [ ] Ativar bots (BOT_ENABLED=true + QR code)
- [ ] Integração automática de captura do site (webhook → `/api/leads`)
- [ ] Fila robusta (BullMQ/Redis) para escala
