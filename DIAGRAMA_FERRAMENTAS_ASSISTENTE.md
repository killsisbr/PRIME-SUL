# DIAGRAMA VISUAL — Ferramentas do Assistente IA

## 🗺️ Mapa Completo do Projeto PRIME SUL

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SISTEMA PRIME SUL - CRM                             │
│                    (Multi-tenant, Banco do Brasil)                          │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │   PAINEL DO      │
                              │   OPERADOR       │
                              │  (/admin.html)   │
                              └────────┬─────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
        ┌───────▼─────────┐    ┌───────▼─────────┐    ┌────────▼────────┐
        │  Carteira de    │    │  Funil de       │    │  Disparo        │
        │  Clientes       │    │  Vendas         │    │  Comercial      │
        │  (22 leads)     │    │  (6 estágios)   │    │  (Campanhas)    │
        └─────────────────┘    └─────────────────┘    └─────────────────┘
                │                      │                      │
                └──────────────────────┼──────────────────────┘
                                       │
                            ┌──────────▼──────────┐
                            │   ASSISTENTE IA     │
                            │   (Card flutuante)  │
                            │                     │
                            │ 🤖 COPILOT DO       │
                            │    OPERADOR         │
                            └─────────────────────┘
```

---

## 🏗️ Arquitetura de Ferramentas Modulares

```
                    ┌─────────────────────────────────────┐
                    │   ASSISTENTE IA OPERADOR            │
                    │   (Conversacional + Ferramentas)    │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
        ┌───────────▼────┐  ┌──────▼──────┐  ┌──▼────────────┐
        │  Chat Manager  │  │ Tools       │  │ UI Controller │
        │  (ConversaÇÃO) │  │ Registry    │  │ (Popup)       │
        └────────────────┘  └──────┬──────┘  └───────────────┘
                                   │
                 ┌─────────────────┼─────────────────┐
                 │                 │                 │
        ┌────────▼────────┐  ┌─────▼──────┐  ┌────▼──────────┐
        │ FERRAMENTAS     │  │ FERRAMENTAS │  │ FERRAMENTAS  │
        │ CRÍTICAS        │  │ SECUNDÁRIAS │  │ OPCIONAIS    │
        │                 │  │             │  │              │
        │ 1️⃣ Carteira    │  │ 5️⃣ Anti-Ban │  │ 9️⃣ Automação│
        │ 2️⃣ Funil       │  │ 6️⃣ Templates│  │ 🔟 Relatórios
        │ 3️⃣ Disparo     │  │ 7️⃣ Alertas  │  │ 1️⃣1️⃣ Admin   │
        │ 4️⃣ WhatsApp    │  │ 8️⃣ Insights │  │ 1️⃣2️⃣ Audit   │
        │                 │  │             │  │              │
        └─────────────────┘  └─────────────┘  └────────────────┘
```

---

## 📊 Fluxo de Interação: Operador → IA → Ação

```
┌─────────────────┐
│   Operador      │
│   (Vendedor)    │
└────────┬────────┘
         │
         │ "Como aumentar minhas conversões?"
         ▼
┌──────────────────────────────────────┐
│   ASSISTENTE IA (Chat Input)         │
│                                      │
│   • Processa pergunta                │
│   • Identifica contexto              │
│   • Seleciona ferramentas relevantes │
└──────────────┬───────────────────────┘
               │
      ┌────────┼────────┐
      │        │        │
      ▼        ▼        ▼
  ┌────────┐ ┌────────┐ ┌────────┐
  │Analisar│ │Buscar  │ │Sugerir │
  │Carteira│ │Insights│ │Ações   │
  └────────┘ └────────┘ └────────┘
      │        │        │
      └────────┼────────┘
               │
               ▼
    ┌──────────────────────┐
    │  POPUP FLUTUANTE     │
    │  (Resposta + Ações)  │
    │                      │
    │ "Encontrei 3 ações"  │
    │ [Ação 1] [Ação 2]    │
    │ [Ação 3] [Mais]      │
    └──────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
    ▼          ▼          ▼
 [Clica]    [Clica]    [Clica]
  Ação1      Ação2      Ação3
    │          │          │
    └──────────┼──────────┘
               │
               ▼
    ┌──────────────────────┐
    │ BACK-END             │
    │ Executa ação + API   │
    │ (POST /campaigns,    │
    │  PATCH /leads, etc)  │
    └──────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ FEEDBACK             │
    │ "✅ 5 leads disparados"
    │ "Resultado em tempo  │
    │  real no popup"      │
    └──────────────────────┘
```

---

## 🔄 Detalhes de Cada Ferramenta Crítica

### **FERRAMENTA 1️⃣: CARTEIRA DE CLIENTES**

```
ENTRADA (Pergunta)
   │
   └─ "Como estão meus leads?"
   └─ "Preciso contatar novos leads"
   └─ "Quem não respondeu?"
       │
       ▼
   ┌──────────────────────────────────┐
   │ IA PROCESSA:                     │
   │ • Busca todos os leads do vendor │
   │ • Calcula status/score           │
   │ • Identifica padrões             │
   │ • Gera sugestões                 │
   └─────────────┬────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │ SAÍDA (Resposta + Ações):        │
   │ • Status atual: X novo, Y ativo │
   │ • Leads prioritários             │
   │ • [Ver Carteira Completa]       │
   │ • [Filtrar por Status]          │
   │ • [Contatar Quentes]            │
   │ • [Exportar]                    │
   └──────────────────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │ BACKEND:                         │
   │ GET /api/leads (com filtros)     │
   │ GET /api/leads/counts            │
   │ PATCH /api/leads/:id/status      │
   │ GET /api/leads/:id/conversations │
   └──────────────────────────────────┘

BANCO DE DADOS:
   leads → {id, seller_id, status, score, phone, name}
   lead_history → {lead_id, from_status, to_status, timestamp}
   messages → {lead_id, sender, text, timestamp}
```

---

### **FERRAMENTA 2️⃣: FUNIL DE VENDAS**

```
ENTRADA
   │
   └─ "Como está meu funil?"
   └─ "Por que baixa conversão?"
   └─ "Qual etapa é gargalo?"
       │
       ▼
   ┌──────────────────────────────────┐
   │ IA ANALISA:                      │
   │ • Contagem por estágio           │
   │ • Taxa conversão (50/100 = 50%)  │
   │ • Compara com histórico/meta     │
   │ • Detecta anomalias              │
   │ • Sugere melhoria                │
   └─────────────┬────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │ SAÍDA:                           │
   │                                  │
   │ NOVOS:    50 (100%)              │
   │   ↓                              │
   │ CONTATO:  20 (40%) ✅            │
   │   ↓                              │
   │ CONFIR.:  12 (60%) ⚠️ GARGALO   │
   │   ↓                              │
   │ CONCLUÍDO: 3 (25%)               │
   │                                  │
   │ [Disparar para Novos]           │
   │ [Re-engajar Contato]            │
   │ [Focar em Confirmados]          │
   └──────────────────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │ BACKEND:                         │
   │ GET /api/leads/funnel            │
   │ GET /api/leads?status=X          │
   │ Cálculo de conversão = B/A       │
   └──────────────────────────────────┘

BANCO:
   leads.status = {novos, enviados, sim, nao, bloqueado, duplicado}
   lead_history para timeline
```

---

### **FERRAMENTA 3️⃣: DISPARO COMERCIAL**

```
ENTRADA
   │
   └─ "Dispara pra meus novos leads?"
   └─ "Cria uma campanha de re-engajamento"
   └─ "Quantos leads tenho pra disparar?"
       │
       ▼
   ┌──────────────────────────────────┐
   │ IA PREPARA:                      │
   │ • Define público-alvo (filtro)   │
   │ • Sugere template melhor         │
   │ • Calcula impacto (estimativas)  │
   │ • Propõe configuração ótima      │
   │ • Simula resultado esperado      │
   └─────────────┬────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │ SAÍDA (Preview):                 │
   │                                  │
   │ Público: 23 leads (status=novo)  │
   │ Template: Triagem BB             │
   │                                  │
   │ PREVIEW:                         │
   │ "Olá João! Temos oportunidade"   │
   │ "Pode oferecer? (SIM/NÃO)"       │
   │                                  │
   │ Config: 8s delay, 3 números      │
   │ Esperado: 23 enviados, 7 sim     │
   │ Duração: ~4 minutos              │
   │                                  │
   │ [Disparar Agora]                │
   │ [Agendar]                        │
   │ [Customizar]                     │
   └──────────────────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │ BACKEND:                         │
   │ POST /api/campaigns              │
   │ POST /api/campaigns/:id/start    │
   │ GET /api/campaigns/:id (stats)   │
   │ WebSocket: updates real-time     │
   └──────────────────────────────────┘

BANCO:
   campaigns → {id, name, message, status, total_target}
   sends → {campaign_id, lead_id, status, replied_at}
   message_templates → {body, purpose}
   jobs → {type: 'campaign_send', status, payload}
```

---

### **FERRAMENTA 4️⃣: MEU WHATSAPP**

```
ENTRADA
   │
   └─ "Alguém respondeu meu WhatsApp?"
   └─ "Conectar novo número"
   └─ "Ver conversa com João"
       │
       ▼
   ┌──────────────────────────────────┐
   │ IA VERIFICA:                     │
   │ • Números conectados (2)         │
   │ • Mensagens não lidas (7)        │
   │ • Threads ativas (3)             │
   │ • Prioriza respostas importantes │
   └─────────────┬────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │ SAÍDA:                           │
   │                                  │
   │ 📱 Números: 2 ativos             │
   │ 💬 Não lidas: 7 mensagens        │
   │                                  │
   │ PRIORITÁRIOS:                    │
   │ 🔥 João: "Sim, tô interessado"  │
   │ ❓ Maria: "Qual o valor?"        │
   │ 💬 Carlos: (conversa ativa)      │
   │                                  │
   │ [Ver Conversas]                 │
   │ [Responder João]                │
   │ [Conectar Novo Número]          │
   │ [QR Code]                       │
   └──────────────────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │ BACKEND:                         │
   │ GET /api/leads/:id/conversations │
   │ WebSocket: msg em tempo real     │
   │ POST /api/whatsapp/send          │
   │ GET /api/whatsapp/qrcode         │
   └──────────────────────────────────┘

BANCO:
   messages → {lead_id, sender, text}
   seller_numbers → {seller_id, number}
   (Baileys sessions = arquivo local)
```

---

## 📱 Ferramentas Secundárias (Fluxo Rápido)

```
┌──────────────────────────────────────┐
│ FERRAMENTA 5️⃣: ANTI-BAN             │
├──────────────────────────────────────┤
│ Entrada: "Meus números estão OK?"   │
│ Ação: Verificar status de cada um    │
│ Saída: [Ativar novo] [Resfriado]    │
│ Backend: GET /api/campaigns/numbers  │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ FERRAMENTA 6️⃣: TEMPLATES            │
├──────────────────────────────────────┤
│ Entrada: "Qual template funciona?"   │
│ Ação: Analisar estatísticas          │
│ Saída: [Top template] [Melhorar]    │
│ Backend: GET /api/templates/stats    │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ FERRAMENTA 7️⃣: ALERTAS              │
├──────────────────────────────────────┤
│ Entrada: "Tá tudo OK?"               │
│ Ação: Verificar eventos críticos     │
│ Saída: 3 alertas pendentes           │
│ Backend: WebSocket + GET /api/alerts │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ FERRAMENTA 8️⃣: INSIGHTS             │
├──────────────────────────────────────┤
│ Entrada: "O que devo fazer?"         │
│ Ação: Sugerir próximas ações         │
│ Saída: [Plano prioritizado]         │
│ Backend: Cálculos + ML simples       │
└──────────────────────────────────────┘
```

---

## 🎨 Interface do Assistente

```
╔═══════════════════════════════════════════════════════════╗
║                    PAINEL DO OPERADOR                     ║
║                                                           ║
║  [Carteira] [Funil] [Campanhas] [Config]  [Profile]      ║
║                                                           ║
║  ┌─────────────────────┐    ┌──────────────────────────┐ ║
║  │ Carteira: 50 leads  │    │                          │ ║
║  │ Status: 22 novos    │    │   ASSISTENTE IA          │ ║
║  │ Envios: 45          │    │   ──────────────────     │ ║
║  │ Conversão: 30%      │    │                          │ ║
║  └─────────────────────┘    │  "Olá! Como posso       │ ║
║                             │   ajudar?"               │ ║
║                             │                          │ ║
║                             │  [Input...]         [→]  │ ║
║                             └──────────────────────────┘ ║
║                                                           ║
║  [Leads]                     [Funil]                     ║
║  [Campanhas]                 [Números]                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

                     ↓ [Operador escreve]

╔═══════════════════════════════════════════════════════════╗
║  ASSISTENTE IA (Popup Flutuante)     [−] [□] [×]         ║
║─────────────────────────────────────────────────────────── ║
║                                                           ║
║ Você: "Como aumentar minha conversão?"                  ║
║                                                           ║
║ IA: "Identifico 3 oportunidades..."                     ║
║                                                           ║
║ ┌──────────────────────────────────────────────────────┐ ║
║ │  🎯 SUGESTÃO 1: Re-engajar 12 sem resposta           │ ║
║ │     → Usar template melhorado                        │ ║
║ │     → Esperado: +4 confirmações                      │ ║
║ │  [EXECUTAR] [DETALHES]                              │ ║
║ └──────────────────────────────────────────────────────┘ ║
║                                                           ║
║ ┌──────────────────────────────────────────────────────┐ ║
║ │  💬 SUGESTÃO 2: Disparar confirmados para simulação  │ ║
║ │     → 8 leads prontos                               │ ║
║ │     → Valor: ~R$ 50k                                │ ║
║ │  [EXECUTAR] [DETALHES]                              │ ║
║ └──────────────────────────────────────────────────────┘ ║
║                                                           ║
║ ┌──────────────────────────────────────────────────────┐ ║
║ │  📊 SUGESTÃO 3: Revisar configuração de números      │ ║
║ │     → Reduzir delay (12s → 8s)                      │ ║
║ │     → Usar 3 números em paralelo                    │ ║
║ │  [REVISAR] [APLICAR]                                │ ║
║ └──────────────────────────────────────────────────────┘ ║
║                                                           ║
║ Mais informações? [Ver Análise Completa]                ║
║                                                           ║
║ ───────────────────────────────────────────────────────── ║
║ [Quer saber mais sobre algo?]                   [Enviar] ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 🔌 Integração: Chat → Backend → Banco

```
┌──────────────────┐
│   Chat Input     │
│  "Dispara?"      │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  IA NLP (Identificar intent)         │
│  • Extrair: ação, contexto, público  │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Tool Selection (Qual ferramenta?)   │
│  • Disparar → Ferramenta 3           │
│  • Quem? → leads status=novo         │
│  • Template? → template_id=1         │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Backend Service                     │
│  POST /api/campaigns {               │
│    seller_id: 5,                     │
│    target_filter: {status:'novo'},   │
│    template_id: 1,                   │
│    numbers: [3,4,5]                  │
│  }                                   │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Database                            │
│  INSERT campaigns (...)              │
│  UPDATE leads SET ... WHERE status=..|
│  INSERT jobs (type: send, ref_id: ..)│
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Response back to Chat               │
│  ✅ 23 leads disparados             │
│  ⏱️ Duração: 4 min                   │
│  📊 Esperado: 7 confirmações        │
└──────────────────────────────────────┘
         │
         ▼
   [Update Popup em tempo real]
```

---

## 📊 Matriz de Permissões

```
┌─────────────────┬──────────┬─────────────┬──────────┐
│ Ferramenta      │ Vendedor │ Admin       │ Público  │
├─────────────────┼──────────┼─────────────┼──────────┤
│ 1. Carteira     │ ✅ Própria│ ✅ Todos   │ ❌       │
│ 2. Funil        │ ✅ Própria│ ✅ Todos   │ ❌       │
│ 3. Disparo      │ ✅ Própria│ ✅ Todos   │ ❌       │
│ 4. WhatsApp     │ ✅ Própria│ ✅ Todos   │ ❌       │
│ 5. Anti-Ban     │ ✅ Própria│ ✅ Global  │ ❌       │
│ 6. Templates    │ ✅ Própria│ ✅ Global  │ ❌       │
│ 7. Alertas      │ ✅ Própria│ ✅ Própria │ ❌       │
│ 8. Insights     │ ✅ Própria│ ✅ Todos   │ ❌       │
│ 9. Automação    │ ✅ Própria│ ✅ Todos   │ ❌       │
│ 10. Relatórios  │ ✅ Própria│ ✅ Todos   │ ❌       │
│ 11. Admin Panel │ ❌       │ ✅        │ ❌       │
│ 12. Compliance  │ ❌       │ ✅        │ ❌       │
└─────────────────┴──────────┴─────────────┴──────────┘

✅ = Acesso completo (dados do próprio | dados da org)
❌ = Sem acesso
```

---

## 🚀 Fluxo de Deploy

```
1. Backend API (Express)
   ├─ GET /api/leads
   ├─ POST /api/campaigns
   ├─ WebSocket /ws
   └─ (Todos os endpoints listados)

2. Frontend (HTML + JS vanilla)
   ├─ /public/admin.html (painel existente)
   │  └─ Integrar card do assistente
   ├─ /public/js/assistant.js (novo)
   │  ├─ Chat UI
   │  ├─ Popup gerenciamento
   │  ├─ Tool executor
   │  └─ WebSocket client
   └─ /public/css/assistant.css

3. AI Service (Node.js local ou API)
   ├─ NLP: identificar intent
   ├─ Tool selection: qual ferramenta usar
   ├─ Response generation: gerar respostas
   └─ Integração com Claude/OpenAI (opcional)

4. Database (SQLite existente)
   └─ Usar tabelas já existentes
      (sem mudanças)
```

---

## ✨ UX Best Practices

1. **Responsividade**: Card se adapta (mobile: compact, desktop: expandido)
2. **Velocidade**: Cache de dados, lazy-load de ferramentas
3. **Feedback Real-time**: WebSocket para atualizações instantâneas
4. **Atalhos**: Ctrl+/ para abrir, Ctrl+Enter para enviar
5. **Histórico**: Últimas 10 mensagens persistidas (localStorage)
6. **Tema**: Seguir design system Neo-Brutalista (tokens CSS)
7. **Acessibilidade**: ARIA labels, contraste suficiente
8. **Error handling**: Mostrar mensagem clara se falha (retry automático)

---

## 🎯 Checklist de Implementação (MVP)

### **FASE 1: Infraestrutura**
- [ ] Card UI HTML/CSS
- [ ] Popup flutuante gerenciável
- [ ] Chat input + submit
- [ ] WebSocket client setup
- [ ] State management (conversas, cache)

### **FASE 2: Ferramentas Críticas**
- [ ] Ferramenta 1: Carteira (GET /api/leads)
- [ ] Ferramenta 2: Funil (GET /api/leads/funnel)
- [ ] Ferramenta 3: Disparo (POST /api/campaigns)
- [ ] Ferramenta 4: WhatsApp (GET conversations)

### **FASE 3: Inteligência**
- [ ] NLP básico (intent detection)
- [ ] Tool selection (qual ferramenta executar)
- [ ] Response generation (montar resposta)
- [ ] Error handling + retry

### **FASE 4: Polimento**
- [ ] Responsividade
- [ ] Performance (cache, lazy-load)
- [ ] Tema Neo-Brutalista
- [ ] Atalhos de teclado
- [ ] Analytics básico

---

## 📚 Arquivos de Referência

- `PROJETO.md` — Visão geral do PRIME SUL
- `DESIGN.md` — Sistema de design Neo-Brutalista
- `/server/routes/leads.js` — API de leads
- `/server/routes/campaigns.js` — API de campanhas
- `/server/services/lead-service.js` — Lógica de leads
- `/public/admin.html` — Painel existente (integração)

---

## 🎓 Conclusão

O **Assistente IA** é um multiplexador inteligente que:
1. **Ouve** o operador (chat conversacional)
2. **Entende** a intenção (NLP + context)
3. **Seleciona** ferramentas relevantes (tool registry)
4. **Executa** ações (API REST)
5. **Fornece** feedback (UI + WebSocket real-time)

Com **4 ferramentas críticas + 4 secundárias**, pode cobrir 80% dos casos de uso do operador.

Próximo passo: **Começar desenvolvimento do card + chat input!** 🚀
