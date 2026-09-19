# ESPECIFICAÇÃO TÉCNICA — Assistente IA para Operador

## 📋 Resumo Executivo

Implementar um **Assistente IA conversacional** integrado ao painel PRIME SUL que funcione como copilot do operador, oferecendo acesso rápido a 8 ferramentas principais através de um card flutuante e popup interativo.

**Stack:** Node.js backend (Express) + Frontend vanilla (HTML/CSS/JS) + SQLite + WebSocket  
**Escopo MVP:** 4 ferramentas críticas  
**Timeline:** 2-3 semanas  

---

## 🗂️ Arquitetura de Pastas

```
PRIME SUL/
├── server/
│   ├── services/
│   │   ├── copilot-service.js          [NEW] Lógica principal do assistente
│   │   ├── tool-registry.js            [NEW] Registro de ferramentas
│   │   ├── tool-executor.js            [NEW] Executa ações das ferramentas
│   │   └── nlp-service.js              [NEW] NLP básico + intent detection
│   │
│   ├── routes/
│   │   ├── copilot.js                  [NEW] POST /api/copilot/chat
│   │   └── (existentes: leads, campaigns, etc)
│   │
│   └── websocket/
│       └── copilot-ws.js               [NEW] WebSocket para real-time
│
├── public/
│   ├── js/
│   │   ├── assistant.js                [NEW] UI do card + popup
│   │   ├── assistant-chat.js           [NEW] Chat logic (send, receive)
│   │   ├── assistant-tools.js          [NEW] Renderização de ferramentas
│   │   └── assistant-state.js          [NEW] State management
│   │
│   ├── css/
│   │   └── assistant.css               [NEW] Estilos (Neo-Brutalista)
│   │
│   └── admin.html                      [MODIFICAR] Integrar card
│
└── data/
    └── copilot-logs/                   [NEW] Logs de conversas (audit)
```

---

## 🔌 Endpoints da API

### **NOVOS ENDPOINTS (Copilot)**

```
POST /api/copilot/chat
├─ Descrição: Enviar mensagem ao assistente
├─ Auth: JWT (vendedor)
├─ Body: {
│   message: string,
│   context: {carteira_count?, funil_status?, ...}
│ }
├─ Response: {
│   success: boolean,
│   reply: string,
│   tools: [
│     {
│       id: "tool-1",
│       name: "Carteira de Clientes",
│       description: "...",
│       actions: [{label, action, params}]
│     }
│   ],
│   metadata: {timestamp, intent, confidence}
│ }
└─ Status: 200 | 400 | 500

WebSocket /ws/copilot
├─ Descrição: Conexão real-time para eventos
├─ Auth: JWT em header/cookie
├─ Eventos recebidos:
│   - campaign_update (nova envio completo)
│   - lead_updated (lead mudou status)
│   - alert_new (novo alerta crítico)
│   - message_received (nova mensagem do lead)
└─ Eventos enviados:
    - tool_action (operador clicou em ação)
    - chat_message (nova mensagem)

GET /api/copilot/tools
├─ Descrição: Listar ferramentas disponíveis
├─ Auth: JWT (vendedor)
├─ Response: {
│   tools: [
│     {id, name, description, category, available}
│   ]
│ }
└─ Usado para: Auto-complete, sugestões, UI

GET /api/copilot/conversations/:vendorId
├─ Descrição: Histórico de conversas (admin)
├─ Auth: JWT (admin-only)
├─ Query: limit=50, offset=0
└─ Response: [{id, vendor_id, messages:[...], created_at}]

POST /api/copilot/tool-action
├─ Descrição: Executar ação de ferramenta (clique em botão)
├─ Auth: JWT (vendedor)
├─ Body: {
│   tool_id: "disparo-comercial",
│   action: "disparar_agora",
│   params: {campaign_id: 5, ...}
│ }
├─ Response: {success, result, message}
└─ Status: 200 | 400 | 403 | 500
```

### **ENDPOINTS EXISTENTES (Usados pelo Assistente)**

O assistente **não cria** novos dados — usa APIs existentes:

```
GET /api/leads
  └─ Carteira de Clientes

GET /api/leads/funnel
  └─ Funil de Vendas

POST /api/campaigns
GET /api/campaigns
POST /api/campaigns/:id/start
  └─ Disparo Comercial

GET /api/leads/:id/conversations
  └─ Meu WhatsApp

GET /api/campaigns/numbers
PATCH /api/campaigns/numbers/:id
  └─ Anti-Ban

GET /api/templates
POST /api/templates
  └─ Templates

(+ config, config/bot, sellers/me, whatsapp/status, etc.)
```

---

## 🤖 Serviços de Backend (Node.js)

### **1. copilot-service.js** (Orquestrador Principal)

```javascript
class CopilotService {
  async processMessage(vendorId, userMessage, context) {
    // 1. NLP: Identificar intent + extrair parâmetros
    const {intent, confidence, params} = await nlpService.analyze(userMessage);
    
    // 2. Tool selection: Qual(is) ferramenta(s) usar?
    const selectedTools = await toolRegistry.selectTools({
      intent, 
      params,
      vendorId
    });
    
    // 3. Executar ferramentas em paralelo
    const results = await Promise.all(
      selectedTools.map(tool => toolExecutor.run(tool, params))
    );
    
    // 4. Gerar resposta conversacional
    const reply = await responseGenerator.generate({
      intent,
      results,
      params
    });
    
    // 5. Construir resposta com ações
    const tools = results.map(r => ({
      id: r.toolId,
      name: r.toolName,
      description: r.description,
      actions: r.suggestedActions // Array de {label, action, params}
    }));
    
    // 6. Salvar em log (audit)
    await auditLog.save({
      vendor_id: vendorId,
      user_message: userMessage,
      intent,
      confidence,
      tools: tools.map(t => t.id),
      timestamp: new Date()
    });
    
    return {
      success: true,
      reply,
      tools,
      metadata: {
        intent,
        confidence,
        timestamp: new Date()
      }
    };
  }
}

module.exports = new CopilotService();
```

### **2. tool-registry.js** (Registro de Ferramentas)

```javascript
const toolRegistry = {
  // Definição de todas as ferramentas
  tools: {
    'carteira-clientes': {
      name: 'Carteira de Clientes',
      description: 'Visualizar e gerenciar todos os leads',
      category: 'essential',
      intents: ['list_leads', 'search_lead', 'filter_leads'],
      priority: 1,
      executor: 'carteira-executor'
    },
    'funil-vendas': {
      name: 'Funil de Vendas',
      description: 'Analisar conversão e identificar gargalos',
      category: 'essential',
      intents: ['analyze_funnel', 'show_conversion', 'find_bottleneck'],
      priority: 2,
      executor: 'funil-executor'
    },
    'disparo-comercial': {
      name: 'Disparo Comercial',
      description: 'Criar e executar campanhas de mensagens',
      category: 'essential',
      intents: ['create_campaign', 'send_message', 'start_campaign'],
      priority: 3,
      executor: 'disparo-executor'
    },
    'meu-whatsapp': {
      name: 'Meu WhatsApp',
      description: 'Gerenciar conversas e números pessoais',
      category: 'essential',
      intents: ['check_messages', 'reply_lead', 'connect_number'],
      priority: 4,
      executor: 'whatsapp-executor'
    },
    'anti-ban': {
      name: 'Gestão de Números',
      description: 'Monitorar números e status anti-ban',
      category: 'secondary',
      intents: ['check_numbers', 'number_status', 'add_number'],
      priority: 5,
      executor: 'antiban-executor'
    },
    'templates': {
      name: 'Templates de Mensagem',
      description: 'Criar e otimizar templates',
      category: 'secondary',
      intents: ['best_template', 'create_template', 'analyze_template'],
      priority: 6,
      executor: 'template-executor'
    },
    'alertas': {
      name: 'Alertas em Tempo Real',
      description: 'Notificações de eventos críticos',
      category: 'secondary',
      intents: ['check_alerts', 'alert_status'],
      priority: 7,
      executor: 'alert-executor'
    },
    'insights': {
      name: 'Análise & Insights',
      description: 'Sugestões inteligentes baseadas em dados',
      category: 'secondary',
      intents: ['next_action', 'suggest_action', 'analyze_performance'],
      priority: 8,
      executor: 'insight-executor'
    }
  },

  selectTools(criteria) {
    const {intent, vendorId} = criteria;
    // Retorna array de tools que match o intent
    return Object.entries(this.tools)
      .filter(([_, tool]) => tool.intents.includes(intent))
      .sort((a, b) => a[1].priority - b[1].priority)
      .map(([id, tool]) => ({...tool, id}));
  },

  getTool(toolId) {
    return this.tools[toolId];
  }
};

module.exports = toolRegistry;
```

### **3. nlp-service.js** (NLP Básico)

```javascript
class NLPService {
  constructor() {
    // Mapeamento simples: palavras-chave → intent
    this.intentMap = {
      // Carteira
      'meus leads|carteira|listar leads|quantos leads': 'list_leads',
      'procura|busca|encontrar lead|qual lead': 'search_lead',
      'filtro|status|prioridade': 'filter_leads',
      
      // Funil
      'funil|conversão|taxa|gargalo|etapa': 'analyze_funnel',
      'aumentar|melhorar|estratégia': 'suggest_action',
      
      // Disparo
      'dispara|campanha|enviar|mensagem': 'create_campaign',
      'começa|inicia|dispara agora': 'start_campaign',
      
      // WhatsApp
      'respondeu|mensagem|chat|whatsapp': 'check_messages',
      'responda|enviar para|contato': 'reply_lead',
      'conecta|qr code|novo número': 'connect_number',
      
      // Números
      'número|banido|resfriado|ativo': 'check_numbers',
      'adiciona|novo número': 'add_number',
      
      // Templates
      'template|mensagem|qual funciona': 'best_template',
      'cria template': 'create_template',
      
      // Alertas
      'alerta|aviso|problema|erro': 'check_alerts',
      'calmo|tá ok|status': 'alert_status',
      
      // Insights
      'próxima ação|devo fazer|o que faz': 'next_action',
      'sugestão|ideia|recomenda': 'suggest_action'
    };
  }

  async analyze(userMessage) {
    const lower = userMessage.toLowerCase();
    
    // 1. Identificar intent (regex simples)
    let intent = 'unknown';
    let confidence = 0;
    
    for (const [keywords, detectedIntent] of Object.entries(this.intentMap)) {
      const pattern = new RegExp(keywords, 'i');
      if (pattern.test(lower)) {
        intent = detectedIntent;
        confidence = 0.85; // Confiança heurística
        break;
      }
    }
    
    // 2. Extrair parâmetros (números, datas, etc.)
    const params = this._extractParams(userMessage);
    
    return {
      intent,
      confidence,
      params,
      raw: lower
    };
  }

  _extractParams(message) {
    // Extrair: numbers, dates, statuses, etc.
    return {
      numbers: message.match(/\d+/g) || [],
      hasDate: !!message.match(/(\d{1,2}\/\d{1,2}|amanhã|hoje|semana|mês)/),
      status: message.includes('novo') ? 'novo' : null,
      quantity: message.match(/\d+(?:\s+(leads|números|campanhas))/)?.[0]
    };
  }
}

module.exports = new NLPService();
```

### **4. tool-executor.js** (Executor de Ações)

```javascript
class ToolExecutor {
  async run(tool, params, vendorId) {
    const executor = this._getExecutor(tool.id);
    
    try {
      const result = await executor.execute(params, vendorId);
      
      // Formatar resultado com ações sugeridas
      return {
        toolId: tool.id,
        toolName: tool.name,
        description: tool.description,
        success: true,
        data: result.data,
        suggestedActions: result.actions || []
      };
    } catch (error) {
      return {
        toolId: tool.id,
        success: false,
        error: error.message
      };
    }
  }

  _getExecutor(toolId) {
    // Retorna o executor correto para cada ferramenta
    const executors = {
      'carteira-clientes': new CarteiraExecutor(),
      'funil-vendas': new FunilExecutor(),
      'disparo-comercial': new DisparoExecutor(),
      'meu-whatsapp': new WhatsappExecutor(),
      'anti-ban': new AntiBanExecutor(),
      'templates': new TemplateExecutor(),
      'alertas': new AlertaExecutor(),
      'insights': new InsightExecutor()
    };
    
    return executors[toolId];
  }
}

// Exemplo: CarteiraExecutor
class CarteiraExecutor {
  async execute(params, vendorId) {
    // Chamar API existente
    const leads = await leadService.listLeads({
      seller_id: vendorId,
      status: params.status,
      search: params.search
    });
    
    const counts = await leadService.countsBySeller(vendorId);
    
    // Sugerir ações
    const actions = [];
    if (counts.novos > 10) {
      actions.push({
        label: 'Disparar para Novos',
        action: 'start_campaign',
        params: {target: 'novos'}
      });
    }
    
    return {
      data: {
        leads,
        counts,
        summary: `Você tem ${counts.total} leads no total...`
      },
      actions
    };
  }
}

module.exports = new ToolExecutor();
```

### **5. response-generator.js** (Gerador de Respostas)

```javascript
class ResponseGenerator {
  async generate(context) {
    const {intent, results, params} = context;
    
    // Templates de resposta por intent
    const templates = {
      'list_leads': (results) => {
        const {counts, leads} = results[0].data;
        return `
          📋 Sua carteira tem ${counts.total} leads no total:
          • ${counts.novos} novos (aguardando contato)
          • ${counts.enviados} em contato
          • ${counts.sim} confirmados
          • ${counts.nao} recusados
          
          Quer disparar para os novos ou revisar algum estágio?
        `;
      },
      
      'analyze_funnel': (results) => {
        const {funnel} = results[0].data;
        return `
          📊 Seu funil está assim:
          • Novos: ${funnel.novos} leads
          • Em contato: ${funnel.enviados} (${funnel.taxa1}% conversão)
          • Confirmados: ${funnel.sim} (${funnel.taxa2}% conversão)
          • Concluídos: ${funnel.concluido} (${funnel.taxa3}% conversão)
          
          Gargalo detectado: Etapa "novos → em contato" (${funnel.gargalo}%)
        `;
      },
      
      'create_campaign': (results) => {
        const {campaign} = results[0].data;
        return `
          ✅ Campanha criada com sucesso!
          • Público: ${campaign.targetCount} leads
          • Mensagem: ${campaign.message.substring(0, 50)}...
          • Números: ${campaign.numbers.length} disponíveis
          
          Pronto para disparar? [Vou aguardar seu sinal]
        `;
      }
      
      // ... mais templates
    };
    
    const template = templates[intent];
    if (!template) {
      return "Entendi sua pergunta, mas ainda estou aprendendo sobre isso. Quer tentar outra coisa?";
    }
    
    return template(results);
  }
}

module.exports = new ResponseGenerator();
```

---

## 🎨 Frontend (HTML/CSS/JS)

### **assistant.html** (Card + Popup)

```html
<!-- Card do Assistente (sempre visível) -->
<div id="copilot-card" class="copilot-card">
  <div class="copilot-card-header">
    <span class="copilot-label">🤖 Assistente IA</span>
    <button class="copilot-close" aria-label="Fechar">×</button>
  </div>
  
  <div class="copilot-card-content">
    <p class="copilot-greeting">Olá! Como posso ajudar?</p>
    
    <form class="copilot-form" id="copilot-form">
      <input
        type="text"
        id="copilot-input"
        class="copilot-input"
        placeholder="Pergunte algo (ex: 'Quantos leads tenho?')"
        autocomplete="off"
      />
      <button type="submit" class="copilot-send" title="Enviar (Ctrl+Enter)">
        →
      </button>
    </form>
  </div>
</div>

<!-- Popup Flutuante (abre ao enviar) -->
<div id="copilot-popup" class="copilot-popup hidden">
  <div class="copilot-popup-header">
    <span class="copilot-popup-title">Assistente IA</span>
    <div class="copilot-popup-controls">
      <button class="copilot-minimize" title="Minimizar">−</button>
      <button class="copilot-expand" title="Expandir">□</button>
      <button class="copilot-close-popup" title="Fechar">×</button>
    </div>
  </div>
  
  <div class="copilot-popup-content" id="copilot-messages">
    <!-- Mensagens adicionadas dinamicamente -->
  </div>
  
  <div class="copilot-popup-footer">
    <form class="copilot-popup-form" id="copilot-popup-form">
      <input
        type="text"
        class="copilot-popup-input"
        placeholder="Quer saber mais sobre algo?"
        autocomplete="off"
      />
      <button type="submit" class="copilot-popup-send">→</button>
    </form>
  </div>
</div>
```

### **assistant.css** (Estilos Neo-Brutalista)

```css
/* ==================== CARD ==================== */
.copilot-card {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 320px;
  background: var(--v3-cream);
  border: 3px solid var(--v3-ink);
  border-radius: 16px;
  box-shadow: 6px 6px 0 var(--v3-ink);
  z-index: 999;
  transition: all 0.3s ease;
}

.copilot-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 2px dashed var(--v3-ink);
  font-weight: 700;
  font-size: 0.95rem;
  text-transform: uppercase;
}

.copilot-card-content {
  padding: 16px;
  text-align: center;
  color: #756d67;
  font-size: 0.9rem;
  line-height: 1.4;
}

.copilot-form {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.copilot-input {
  flex: 1;
  padding: 10px 12px;
  border: 2.5px solid var(--v3-ink);
  border-radius: 8px;
  font-weight: 600;
  font-family: var(--v3-font);
  font-size: 0.85rem;
  background: white;
  transition: border-color 0.2s;
}

.copilot-input:focus {
  outline: none;
  border-color: var(--v3-orange);
}

.copilot-send {
  padding: 10px 16px;
  background: var(--v3-orange);
  color: white;
  border: 2.5px solid var(--v3-ink);
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s;
}

.copilot-send:hover {
  transform: translate(-2px, -2px);
  box-shadow: 3px 3px 0 var(--v3-ink);
}

/* ==================== POPUP ==================== */
.copilot-popup {
  position: fixed;
  bottom: 380px;
  right: 20px;
  width: 420px;
  max-height: 600px;
  background: var(--v3-cream);
  border: 3.5px solid var(--v3-ink);
  border-radius: 20px;
  box-shadow: 10px 10px 0 var(--v3-coral);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  opacity: 1;
  transition: opacity 0.3s;
}

.copilot-popup.hidden {
  opacity: 0;
  pointer-events: none;
  display: none;
}

.copilot-popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 2.5px solid var(--v3-ink);
  background: white;
  border-radius: 16px 16px 0 0;
}

.copilot-popup-title {
  font-weight: 800;
  font-size: 1rem;
  text-transform: uppercase;
}

.copilot-popup-controls {
  display: flex;
  gap: 8px;
}

.copilot-popup-controls button {
  width: 32px;
  height: 32px;
  border: 2px solid var(--v3-ink);
  background: transparent;
  cursor: pointer;
  font-weight: 700;
  font-size: 1rem;
  transition: all 0.2s;
  border-radius: 4px;
}

.copilot-popup-controls button:hover {
  background: var(--v3-yellow);
  transform: translate(-1px, -1px);
}

.copilot-popup-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Mensagens de usuário e IA */
.copilot-message {
  display: flex;
  gap: 8px;
  animation: slideIn 0.3s ease;
}

.copilot-message.user {
  justify-content: flex-end;
}

.copilot-message.ai {
  justify-content: flex-start;
}

.copilot-message-text {
  max-width: 80%;
  padding: 12px 14px;
  background: white;
  border: 2px solid var(--v3-ink);
  border-radius: 10px;
  font-size: 0.9rem;
  line-height: 1.4;
  color: #181716;
}

.copilot-message.user .copilot-message-text {
  background: var(--v3-orange);
  color: white;
  border-color: var(--v3-ink);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Tools / Ações */
.copilot-tools {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.copilot-tool-action {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: white;
  border: 2px solid var(--v3-ink);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.copilot-tool-action:hover {
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--v3-ink);
}

.copilot-tool-name {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--v3-orange);
  text-transform: uppercase;
}

.copilot-tool-description {
  font-size: 0.8rem;
  color: #756d67;
  line-height: 1.3;
}

.copilot-tool-buttons {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.copilot-btn {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid var(--v3-ink);
  background: var(--v3-yellow);
  color: var(--v3-ink);
  font-weight: 700;
  font-size: 0.75rem;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.copilot-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 2px 2px 0 var(--v3-ink);
}

.copilot-btn.primary {
  background: var(--v3-orange);
  color: white;
}

/* ==================== RESPONSIVE ==================== */
@media (max-width: 768px) {
  .copilot-card {
    width: 280px;
    right: 10px;
    bottom: 10px;
  }
  
  .copilot-popup {
    width: min(90vw, 400px);
    max-height: 70vh;
    bottom: auto;
    top: 50%;
    transform: translateY(-50%);
  }
  
  .copilot-message-text {
    max-width: 90%;
  }
}
```

### **assistant.js** (Lógica do Chat)

```javascript
class CopilotAssistant {
  constructor() {
    this.ws = null;
    this.state = {
      isOpen: false,
      isMinimized: false,
      messages: [],
      vendorId: null
    };
    this.init();
  }

  async init() {
    // 1. Obter vendor_id do JWT
    this.state.vendorId = this.getVendorFromAuth();
    
    // 2. Carregar histórico (localStorage)
    this.state.messages = this.loadHistory();
    
    // 3. Setup UI listeners
    this.setupUIListeners();
    
    // 4. Conectar WebSocket
    this.connectWebSocket();
  }

  setupUIListeners() {
    const form = document.getElementById('copilot-form');
    const input = document.getElementById('copilot-input');
    const closeBtn = document.querySelector('.copilot-close');
    const closePopupBtn = document.querySelector('.copilot-close-popup');
    const minimizeBtn = document.querySelector('.copilot-minimize');
    
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendMessage(input.value);
      input.value = '';
    });
    
    closeBtn.addEventListener('click', () => this.toggleCard());
    closePopupBtn.addEventListener('click', () => this.closePopup());
    minimizeBtn.addEventListener('click', () => this.toggleMinimize());
    
    // Atalho: Ctrl+/
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        input.focus();
      }
    });
  }

  async sendMessage(userMessage) {
    if (!userMessage.trim()) return;
    
    // Adicionar mensagem do usuário ao UI
    this.addMessageToUI('user', userMessage);
    
    // Chamar API
    try {
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({
          message: userMessage,
          context: {} // Dados contextuais (opcional)
        })
      });
      
      if (!response.ok) throw new Error('Erro ao processar mensagem');
      
      const data = await response.json();
      
      // Abrir popup
      this.openPopup();
      
      // Adicionar resposta da IA
      this.addMessageToUI('ai', data.reply);
      
      // Adicionar tools/ações
      if (data.tools && data.tools.length > 0) {
        this.renderTools(data.tools);
      }
      
      // Salvar histórico
      this.saveHistory();
      
    } catch (error) {
      this.addMessageToUI('error', 'Desculpe, não consegui processar sua mensagem.');
      console.error(error);
    }
  }

  addMessageToUI(role, text) {
    const messagesContainer = document.getElementById('copilot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `copilot-message ${role}`;
    
    const textDiv = document.createElement('div');
    textDiv.className = 'copilot-message-text';
    textDiv.textContent = text;
    
    messageDiv.appendChild(textDiv);
    messagesContainer.appendChild(messageDiv);
    
    // Auto-scroll
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Salvar em state
    this.state.messages.push({
      role,
      text,
      timestamp: new Date()
    });
  }

  renderTools(tools) {
    const messagesContainer = document.getElementById('copilot-messages');
    
    for (const tool of tools) {
      const toolDiv = document.createElement('div');
      toolDiv.className = 'copilot-tool-action';
      
      toolDiv.innerHTML = `
        <div class="copilot-tool-name">${tool.name}</div>
        <div class="copilot-tool-description">${tool.description}</div>
        <div class="copilot-tool-buttons">
          ${tool.actions.map(action => `
            <button class="copilot-btn" data-action="${action.action}" data-params='${JSON.stringify(action.params)}'>
              ${action.label}
            </button>
          `).join('')}
        </div>
      `;
      
      // Adicionar listeners aos botões de ação
      toolDiv.querySelectorAll('.copilot-btn').forEach(btn => {
        btn.addEventListener('click', () => this.executeToolAction(
          tool.id,
          btn.dataset.action,
          JSON.parse(btn.dataset.params)
        ));
      });
      
      messagesContainer.appendChild(toolDiv);
    }
  }

  async executeToolAction(toolId, action, params) {
    // Chamar API para executar ação
    try {
      const response = await fetch('/api/copilot/tool-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({
          tool_id: toolId,
          action,
          params
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.addMessageToUI('ai', `✅ ${data.message}`);
      } else {
        this.addMessageToUI('error', `❌ ${data.message}`);
      }
    } catch (error) {
      this.addMessageToUI('error', 'Erro ao executar ação.');
      console.error(error);
    }
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws/copilot`);
    
    this.ws.addEventListener('open', () => {
      console.log('WebSocket conectado');
      // Enviar autenticação
      this.ws.send(JSON.stringify({
        type: 'auth',
        token: this.getToken()
      }));
    });
    
    this.ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      
      // Processar eventos do servidor
      if (data.type === 'lead_updated') {
        this.addMessageToUI('system', `📢 Lead ${data.leadName} mudou para "${data.newStatus}"`);
      } else if (data.type === 'campaign_update') {
        this.addMessageToUI('system', `📊 Campanha: ${data.sent}/${data.total} enviados`);
      } else if (data.type === 'alert') {
        this.addMessageToUI('system', `🚨 ${data.message}`);
      }
    });
    
    this.ws.addEventListener('error', (error) => {
      console.error('WebSocket erro:', error);
    });
  }

  openPopup() {
    document.getElementById('copilot-popup').classList.remove('hidden');
    this.state.isOpen = true;
  }

  closePopup() {
    document.getElementById('copilot-popup').classList.add('hidden');
    this.state.isOpen = false;
  }

  toggleCard() {
    const card = document.getElementById('copilot-card');
    card.style.display = card.style.display === 'none' ? 'block' : 'none';
  }

  toggleMinimize() {
    const popup = document.getElementById('copilot-popup');
    popup.classList.toggle('hidden');
    this.state.isMinimized = !this.state.isMinimized;
  }

  saveHistory() {
    localStorage.setItem('copilot-history', JSON.stringify(this.state.messages));
  }

  loadHistory() {
    const stored = localStorage.getItem('copilot-history');
    return stored ? JSON.parse(stored) : [];
  }

  getToken() {
    // Extrair JWT do cookie ou localStorage
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.split('=');
      if (name.trim() === 'token') return decodeURIComponent(value);
    }
    return null;
  }

  getVendorFromAuth() {
    const token = this.getToken();
    if (!token) return null;
    
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id;
  }
}

// Inicializar quando documento carregar
document.addEventListener('DOMContentLoaded', () => {
  window.copilot = new CopilotAssistant();
});
```

---

## 📊 Database (SQLite)

### **Nova Tabela: copilot_conversations**

```sql
CREATE TABLE IF NOT EXISTS copilot_conversations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
    seller_id    INTEGER NOT NULL REFERENCES sellers(id),
    messages     TEXT NOT NULL DEFAULT '[]',  -- JSON array de mensagens
    intent       TEXT,                        -- intent detectado
    tools_used   TEXT,                        -- JSON array de tool_ids
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_copilot_seller ON copilot_conversations(seller_id, created_at DESC);
```

---

## 🔒 Segurança

### **Autenticação & Autorização**

```javascript
// Middleware: verificar JWT
app.use('/api/copilot', auth, (req, res, next) => {
  // req.user.id = vendedor_id (extraído do JWT)
  // req.user.organization_id = org_id
  next();
});

// Executar ferramenta com isolamento de dados
async function executeTool(toolId, params, vendorId) {
  // Validar: vendedor tem permissão de usar ferramenta X?
  const tool = toolRegistry.getTool(toolId);
  if (tool.requiresAdmin && !isAdmin(vendorId)) {
    throw new Error('Acesso negado');
  }
  
  // Filtrar dados: mostrar apenas leads deste vendedor
  const params_safe = {
    ...params,
    seller_id: vendorId,  // FORÇA isolamento
    organization_id: getOrgId(vendorId)
  };
  
  return await toolExecutor.run(tool, params_safe, vendorId);
}
```

### **Rate Limiting**

```javascript
const rateLimit = require('express-rate-limit');

const copilotLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // 10 mensagens/min
  message: 'Muitas mensagens muito rápido. Aguarde um pouco.'
});

app.post('/api/copilot/chat', copilotLimiter, auth, async (req, res) => {
  // ...
});
```

---

## 🚀 Deploy & Produção

### **Checklist de Implementação**

- [x] Criar estrutura de pastas
- [ ] Implementar `copilot-service.js`
- [ ] Implementar NLP básico
- [ ] Criar 4 executores (carteira, funil, disparo, whatsapp)
- [ ] Setup de WebSocket
- [ ] Frontend HTML/CSS/JS
- [ ] Testes unitários
- [ ] Integração com painel existente
- [ ] Deploy em produção
- [ ] Monitoramento & logs

### **Variáveis de Ambiente**

```bash
# .env
COPILOT_ENABLED=true
COPILOT_NLP_PROVIDER=local # ou openai, anthropic
COPILOT_LOG_CONVERSATIONS=true
COPILOT_MAX_HISTORY=50
```

---

## 📚 Referências

- Backend: `/server/services/lead-service.js`, `/server/routes/leads.js`
- Database: `/server/database/schema.sql`
- Frontend existente: `/public/admin.html`
- Design: `DESIGN.md` (tokens CSS)

---

## ✅ Conclusão

Com esta especificação técnica, o desenvolvedor consegue:
1. ✅ Construir serviços backend modularmente
2. ✅ Implementar ferramentas sem afetar API existente
3. ✅ Criar UI responsiva e acessível
4. ✅ Integrar WebSocket para real-time
5. ✅ Garantir segurança de dados

**Próximo passo:** Começar pela estrutura base (pastas + middleware) e depois implementar ferramenta por ferramenta.
