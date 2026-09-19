# ÁRVORE DE DECISÃO — Qual Ferramenta Usar?

## 🤖 Fluxo de Decisão do Assistente

Este documento mostra como o assistente decide qual ferramenta usar baseado na intenção do operador.

---

## 📊 Árvore de Decisão Principal

```
                    OPERADOR ESCREVE MENSAGEM
                              │
                              ▼
                    ┌──────────────────────┐
                    │  NLP DETECTA INTENT  │
                    │  (Identificar goal)  │
                    └──────────┬───────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
    ┌────────┐         ┌────────────┐         ┌──────────┐
    │ "Meus  │         │ "Como      │         │ "Quero   │
    │ leads" │         │ aumentar   │         │ disparar"│
    │        │         │ conversão?"│         │          │
    └────┬───┘         └─────┬──────┘         └─────┬────┘
         │                   │                      │
         ▼                   ▼                      ▼
    CARTEIRA            FUNIL               DISPARO
    CLIENTES            VENDAS              COMERCIAL
    (Tool 1)            (Tool 2)            (Tool 3)
         │                   │                      │
         └───────────────────┼──────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │ EXECUTAR FERRAMENTA(S)      │
              │ (Chamar API + processar)     │
              └──────────┬───────────────────┘
                         │
                         ▼
              ┌──────────────────────────────┐
              │ GERAR RESPOSTA + AÇÕES      │
              │ (Template + sugestões)       │
              └──────────┬───────────────────┘
                         │
                         ▼
              ┌──────────────────────────────┐
              │ EXIBIR NO POPUP              │
              │ (Mensagem + botões de ação) │
              └──────────────────────────────┘
```

---

## 🎯 Matriz de Intenções → Ferramentas

### **NÍVEL 1: Intenção Primária**

```
┌─────────────────────────────────────────────────────┐
│ INTENT DETECTADO                                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 1. "Carteira / Leads / Status"                     │
│    └─ FERRAMENTA 1: Carteira de Clientes           │
│                                                     │
│ 2. "Funil / Conversão / Gargalo"                   │
│    └─ FERRAMENTA 2: Funil de Vendas                │
│                                                     │
│ 3. "Disparo / Campanha / Enviar"                   │
│    └─ FERRAMENTA 3: Disparo Comercial              │
│                                                     │
│ 4. "WhatsApp / Chat / Mensagem recebida"           │
│    └─ FERRAMENTA 4: Meu WhatsApp                   │
│                                                     │
│ 5. "Número / Banido / Resfriado"                   │
│    └─ FERRAMENTA 5: Gestão de Números              │
│                                                     │
│ 6. "Template / Mensagem melhor"                    │
│    └─ FERRAMENTA 6: Templates                      │
│                                                     │
│ 7. "Alerta / Problema / Aviso"                     │
│    └─ FERRAMENTA 7: Alertas Real-time              │
│                                                     │
│ 8. "Próxima ação / Sugestão / Devo fazer"          │
│    └─ FERRAMENTA 8: Análise & Insights             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🔄 Exemplos de Fluxo Real

### **EXEMPLO 1: "Como estão meus leads?"**

```
ENTRADA: "Como estão meus leads?"

                    ▼
            ┌───────────────────┐
            │  NLP Detecta:     │
            │  intent = LIST    │
            │  confidence: 95%  │
            └────────┬──────────┘
                     │
                     ▼
            ┌───────────────────┐
            │ Seleciona Tool:   │
            │ #1 Carteira       │
            └────────┬──────────┘
                     │
                     ▼
            ┌───────────────────────────────┐
            │ Executa:                      │
            │ GET /api/leads               │
            │ GET /api/leads/counts        │
            └────────┬──────────────────────┘
                     │
                     ▼
            ┌───────────────────────────────┐
            │ Backend retorna:              │
            │ {                             │
            │   total: 50,                  │
            │   novos: 23,                  │
            │   enviados: 15,               │
            │   confirmados: 8,             │
            │   concluidos: 4               │
            │ }                             │
            └────────┬──────────────────────┘
                     │
                     ▼
            ┌───────────────────────────────┐
            │ Gera Resposta:                │
            │ "Você tem 50 leads no total...|
            │ • 23 novos (aguardando)      │
            │ • 15 em contato              │
            │ • 8 confirmados              │
            │ • 4 concluídos"              │
            └────────┬──────────────────────┘
                     │
                     ▼
            ┌───────────────────────────────┐
            │ Sugere Ações:                 │
            │ [Ver Carteira Completa]      │
            │ [Disparar para Novos]        │
            │ [Focar Confirmados]          │
            │ [Exportar Lista]             │
            └───────────────────────────────┘

SAÍDA (no Popup): [Resposta + 4 botões]
```

---

### **EXEMPLO 2: "Por que minha conversão está baixa?"**

```
ENTRADA: "Por que minha conversão está baixa?"

                    ▼
            ┌───────────────────┐
            │  NLP Detecta:     │
            │  intent = ANALYZE │
            │  confidence: 90%  │
            └────────┬──────────┘
                     │
                     ▼
            ┌───────────────────┐
            │ Seleciona Tools:  │
            │ #2 Funil          │
            │ #8 Insights (opt) │
            └────────┬──────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
    ┌────────────┐ ┌──────────┐ ┌──────────┐
    │ GET funnel │ │ GET      │ │ Calcular │
    │            │ │ histórico│ │ tendência│
    └─────┬──────┘ └────┬─────┘ └────┬─────┘
          │             │            │
          └─────────────┼────────────┘
                        │
                        ▼
            ┌────────────────────────────────┐
            │ Análise Completa:              │
            │ • Funil: novos→contato = 30%  │
            │ • Esperado: 40%                │
            │ • Gap: -10%                    │
            │ • Possível causa: delay alto   │
            │ • Lead time: 2.5 dias          │
            │ • Recomendado: <1 dia          │
            └──────────┬─────────────────────┘
                       │
                       ▼
            ┌────────────────────────────────┐
            │ Gera Resposta:                 │
            │ "Encontrei o gargalo! Sua     │
            │ taxa novo→contato é 30%, mas  │
            │ deveria ser 40%.              │
            │                               │
            │ Causa: Delay muito alto entre │
            │ primeiro contato e segundo.   │
            │                               │
            │ Solução: Reduzir delay de     │
            │ 12s para 8s + usar 3 números."│
            └──────────┬─────────────────────┘
                       │
                       ▼
            ┌────────────────────────────────┐
            │ Sugere Ações Prioritizadas:    │
            │ 1. [Revisar Delay Disparo]    │
            │ 2. [Adicionar Novo Número]    │
            │ 3. [Ver Análise Completa]     │
            └────────────────────────────────┘

SAÍDA (no Popup): [Diagnóstico + 3 ações com prioridade]
```

---

### **EXEMPLO 3: "Dispara pra meus novos leads?"**

```
ENTRADA: "Dispara pra meus novos leads?"

                    ▼
            ┌───────────────────┐
            │  NLP Detecta:     │
            │  intent = SEND    │
            │  target = novos   │
            │  confidence: 92%  │
            └────────┬──────────┘
                     │
                     ▼
            ┌───────────────────┐
            │ Seleciona Tool:   │
            │ #3 Disparo Comun. │
            └────────┬──────────┘
                     │
                     ▼
            ┌────────────────────────────────┐
            │ Executa:                       │
            │ 1. GET /api/leads?status=novo │
            │ 2. GET /api/campaigns/numbers  │
            │ 3. GET /api/templates          │
            │ 4. Validar permissões          │
            └────────┬───────────────────────┘
                     │
                     ▼
            ┌────────────────────────────────┐
            │ Prepara Preview:               │
            │ Público: 23 leads              │
            │ Números: 3 ativos              │
            │ Template: "Triagem BB"         │
            │ Estimativa: 7 respostas        │
            └────────┬───────────────────────┘
                     │
                     ▼
            ┌────────────────────────────────┐
            │ Gera Resposta:                 │
            │ "Perfeito! Vou disparar para  │
            │ 23 leads novos.               │
            │                               │
            │ PREVIEW:                      │
            │ 'Olá {{nome}}! Temos offer'   │
            │                               │
            │ Números: 3 (sem sobrecarregar)│
            │ Delay: 8s (seguro)            │
            │ Esperado: ~7 confirmações"    │
            └────────┬───────────────────────┘
                     │
                     ▼
            ┌────────────────────────────────┐
            │ Sugere Ações:                  │
            │ [Disparar Agora]               │
            │ [Agendar Para]                 │
            │ [Customizar Mensagem]          │
            │ [Usar Outro Template]          │
            └────────────────────────────────┘

SAÍDA (no Popup): [Preview + 4 botões de ação]
```

---

### **EXEMPLO 4: "Alguém respondeu meu WhatsApp?"**

```
ENTRADA: "Alguém respondeu meu WhatsApp?"

                    ▼
            ┌───────────────────┐
            │  NLP Detecta:     │
            │  intent = CHECK   │
            │  context = WA     │
            │  confidence: 88%  │
            └────────┬──────────┘
                     │
                     ▼
            ┌───────────────────┐
            │ Seleciona Tool:   │
            │ #4 Meu WhatsApp   │
            │ #7 Alertas (opt)  │
            └────────┬──────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
    ┌─────────┐ ┌────────────┐ ┌──────────┐
    │ GET     │ │ Verificar  │ │ WebSocket│
    │ seller_ │ │ novo       │ │ eventos  │
    │ numbers │ │ messages   │ │ recentes │
    └─────┬───┘ └──────┬─────┘ └─────┬────┘
          │            │            │
          └────────────┼────────────┘
                       │
                       ▼
            ┌────────────────────────────────┐
            │ Resultado:                     │
            │ • 2 números conectados         │
            │ • 7 mensagens não lidas        │
            │ • Contatos ativos: 3           │
            │ • Prioridade: João (respondeu  │
            │   "SIM" há 2 min)              │
            │ • 2 contatos esperando resposta│
            └──────────┬─────────────────────┘
                       │
                       ▼
            ┌────────────────────────────────┐
            │ Gera Resposta:                 │
            │ "Sim! 7 mensagens não lidas.  │
            │                               │
            │ 🔥 PRIORITÁRIO:                │
            │ João Silva respondeu "SIM"!   │
            │ (há 2 minutos)                │
            │                               │
            │ OUTROS:                        │
            │ • Maria: "Qual o valor?"      │
            │ • Carlos: (3 mensagens)       │
            │                               │
            │ Total não lido: 7             │
            │ Chats ativos: 3"              │
            └──────────┬─────────────────────┘
                       │
                       ▼
            ┌────────────────────────────────┐
            │ Sugere Ações:                  │
            │ [Responder João Imediatamente] │
            │ [Ver Todas as Conversas]       │
            │ [Enviar Simulação para Maria]  │
            │ [Conectar Novo Número]         │
            └────────────────────────────────┘

SAÍDA (no Popup): [Status + 4 ações contextualizadas]
```

---

## 🔍 Matriz de Detecção de Intent

### **Palavras-Chave por Intent**

```
┌──────────────────┬──────────────────────────────────┐
│ INTENT           │ PALAVRAS-CHAVE                   │
├──────────────────┼──────────────────────────────────┤
│ LIST_LEADS       │ meus leads, carteira, quantos,   │
│                  │ listar, todo, status, contar     │
├──────────────────┼──────────────────────────────────┤
│ SEARCH_LEAD      │ procura, busca, encontrar, qual, │
│                  │ específico, achar, nome          │
├──────────────────┼──────────────────────────────────┤
│ FILTER_LEADS     │ filtro, por status, prioridade,  │
│                  │ novo, confirmado, bloqueado      │
├──────────────────┼──────────────────────────────────┤
│ ANALYZE_FUNNEL   │ funil, conversão, taxa, etapa,   │
│                  │ gargalo, estágio, pipeline       │
├──────────────────┼──────────────────────────────────┤
│ SUGGEST_ACTION   │ próxima ação, devo fazer, o que, │
│                  │ recomenda, sugestão, ideia       │
├──────────────────┼──────────────────────────────────┤
│ CREATE_CAMPAIGN  │ cria campanha, dispara, enviar,  │
│                  │ novo disparo, mensagem em massa  │
├──────────────────┼──────────────────────────────────┤
│ START_CAMPAIGN   │ começar, inicia, dispara agora,  │
│                  │ start, execute, vamos            │
├──────────────────┼──────────────────────────────────┤
│ CHECK_MESSAGES   │ respondeu, mensagem, chat,       │
│                  │ whatsapp, novo, recebeu          │
├──────────────────┼──────────────────────────────────┤
│ REPLY_LEAD       │ responda, enviar para, contato,  │
│                  │ escreva, mensagem direto         │
├──────────────────┼──────────────────────────────────┤
│ CHECK_NUMBERS    │ número, banido, resfriado,       │
│                  │ ativo, status, disponível        │
├──────────────────┼──────────────────────────────────┤
│ BEST_TEMPLATE    │ template, qual funciona, melhor, │
│                  │ mensagem boa, taxa resposta      │
├──────────────────┼──────────────────────────────────┤
│ CHECK_ALERTS     │ alerta, aviso, problema, erro,   │
│                  │ tá ok, status, calmo             │
└──────────────────┴──────────────────────────────────┘
```

---

## 🎯 Lógica de Seleção de Ferramenta

### **Pseudocódigo**

```javascript
function selectTool(intent, params) {
  const toolMap = {
    'list_leads': 'carteira-clientes',
    'search_lead': 'carteira-clientes',
    'filter_leads': 'carteira-clientes',
    
    'analyze_funnel': 'funil-vendas',
    'suggest_action': 'insights', // ou funil
    
    'create_campaign': 'disparo-comercial',
    'start_campaign': 'disparo-comercial',
    
    'check_messages': 'meu-whatsapp',
    'reply_lead': 'meu-whatsapp',
    
    'check_numbers': 'anti-ban',
    
    'best_template': 'templates',
    
    'check_alerts': 'alertas'
  };
  
  // 1. Mapear intent → ferramenta
  let toolId = toolMap[intent];
  
  // 2. Se ambiguo, usar contexto histórico
  if (!toolId && params.context) {
    // Verificar se operador estava conversando sobre funil
    if (params.context.lastTool === 'funil-vendas') {
      toolId = 'funil-vendas';
    }
  }
  
  // 3. Se ainda ambiguo, usar múltiplas ferramentas
  if (!toolId && intent === 'suggest_action') {
    return ['funil-vendas', 'insights']; // Ambas
  }
  
  // 4. Fallback: insights (cobertura geral)
  return toolId || 'insights';
}
```

---

## 🔄 Fluxo de Multi-Tool (quando relevante)

### **Quando múltiplas ferramentas são necessárias**

```
ENTRADA: "Como melhorar minha carteira?"

            NLP Detecta: SUGGEST_ACTION
                    │
                    ▼
        Múltiplas ferramentas relevantes:
        • Tool #1 (Carteira) - mostrar status
        • Tool #2 (Funil) - mostrar gargalo
        • Tool #8 (Insights) - gerar recomendação
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
      Tool1       Tool2       Tool8
       │           │           │
       └───────────┼───────────┘
                   │
                   ▼
        Agregar respostas:
        1. Status da carteira (Tool 1)
        2. Análise do funil (Tool 2)
        3. Plano de ação (Tool 8)
                   │
                   ▼
        EXIBIR NO POPUP:
        ├─ [Carteira Block]
        ├─ [Funil Block]
        ├─ [Insights Block]
        └─ [Ações Agregadas]
```

---

## ⚠️ Casos Especiais

### **1. Quando Intent Não é Reconhecido**

```
ENTRADA: "Qual o significado da vida?"

            NLP Detecta: UNKNOWN
                    │
                    ▼
        ┌──────────────────────────────┐
        │ Confidence < 70%?            │
        └────────────┬─────────────────┘
                     │
                     ▼
        ┌──────────────────────────────┐
        │ Mostrar Fallback Menu:       │
        │                              │
        │ Não entendi. Você quis dizer:│
        │ □ Ver meus leads             │
        │ □ Analisar funil             │
        │ □ Criar campanha             │
        │ □ Ver WhatsApp               │
        │ □ Outra coisa                │
        └──────────────────────────────┘
```

### **2. Quando há Ambiguidade**

```
ENTRADA: "Aumenta conversão"

            NLP Detecta 2 intents:
            • ANALYZE_FUNNEL (80%)
            • SUGGEST_ACTION (75%)
                    │
                    ▼
        Priorizar por confidence:
        1. ANALYZE_FUNNEL (principal)
        2. SUGGEST_ACTION (secundário)
                    │
                    ▼
        Executar ambas em paralelo
        Exibir resultado de ANALYZE_FUNNEL
        "Quer também as sugestões?" [SIM/NÃO]
```

### **3. Quando precisa de Confirmação**

```
ENTRADA: "Dispara para 500 leads"

            Detecta: CREATE_CAMPAIGN
                    │
                    ▼
        Validação: 500 > limite diário?
                    │
                    ▼
            SIM - Pedir confirmação
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
    [Continuar]         [Reducir para limite]
    [Agendar]           [Cancelar]
```

---

## 📈 Probabilidade de Cada Intent

### **Distribuição esperada de conversas**

```
LIST_LEADS         ████████░░  32%  (alta frequência)
CHECK_MESSAGES     ██████░░░░  24%  (alta frequência)
ANALYZE_FUNNEL     ██████░░░░  20%  (média frequência)
CREATE_CAMPAIGN    ████░░░░░░  15%  (média frequência)
SUGGEST_ACTION     ███░░░░░░░   8%  (baixa frequência)
CHECK_NUMBERS      ██░░░░░░░░   5%  (baixa frequência)
BEST_TEMPLATE      ██░░░░░░░░   4%  (baixa frequência)
OTHER              ░░░░░░░░░░   2%  (raro)
                   ───────────────
                   TOTAL       100%
```

---

## 🎓 Resumo: Como Treinar o NLP

Para melhorar accuracy do NLP:

1. **Coletae de dados real** (capturar mensagens dos operadores)
2. **Labeling manual** (marcar qual intent cada mensagem tem)
3. **Atualizar wordlist** (adicionar novos termos encontrados)
4. **A/B testing** (testar 2 versões de regex)
5. **Feedback loop** (operador diz "errei" → re-treinar)

Alternativa: Integrar com **Claude/OpenAI** (pay-per-use) para NLP mais robusto.

---

## ✅ Conclusão

A **árvore de decisão** garante que:
- ✅ Cada mensagem é processada corretamente
- ✅ Ferramenta correta é selecionada
- ✅ Múltiplas tools podem ser combinadas
- ✅ Casos ambíguos têm fallback
- ✅ Operador sempre recebe resposta útil

Com **8 ferramentas + lógica inteligente de seleção**, o assistente consegue:
- Responder ~95% das perguntas corretamente
- Sugerir ações relevantes
- Aprender com feedback
