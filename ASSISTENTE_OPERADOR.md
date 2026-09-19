# Assistente IA para Operador - Especificação Técnica

## 📋 Visão Geral
Sistema interativo integrado ao painel do vendedor que permite aos operadores interagir com IA para otimizar operações de vendas usando ferramentas modulares.

---

## 🎨 Componentes UI/UX

### 1. Card do Assistente
**Localização:** Lado direito do painel do vendedor  
**Tamanho:** Responsivo (505px em mobile, expansível em desktop)  
**Estados:**
- `closed`: Card minimizado mostrando apenas ícone + label
- `active`: Card expandido com chat input visível
- `floating`: Popup flutuante após envio de mensagem

```
┌─────────────────────────────┐
│ ASSISTENTE IA OPERADOR  [×] │
├─────────────────────────────┤
│  Olá! Como posso ajudar?    │
│                             │
│  [Input de chat]      [→]   │
└─────────────────────────────┘
```

### 2. Input de Chat
- Placeholder: "Pergunte algo ao assistente..."
- Atalho de teclado: `Ctrl+/` para focar
- Suporta múltiplas linhas (max 4 linhas)
- Botão enviar ou Enter para submeter

### 3. Popup Flutuante
**Comportamento:**
- Abre ao enviar mensagem
- Fica flutuante sobre a interface
- Posicionamento: centro-direita ou onde houver espaço
- Pode ser minimizado/maximizado/fechado
- Resizável
- Persistente durante sessão do usuário

**Conteúdo:**
```
┌──────────────────────────────────────┐
│ Assistente IA  [−] [□] [×]           │
├──────────────────────────────────────┤
│ Você: Como aumentar conversões?      │
│                                      │
│ IA: Analisando seus dados...         │
│ → Sugestão 1: Revisar funil          │
│ → Sugestão 2: Ativar ferramenta X    │
│                                      │
│ [Ação 1] [Ação 2] [Mais opções ↓]    │
├──────────────────────────────────────┤
│ [Input de continuação...]      [→]   │
└──────────────────────────────────────┘
```

---

## 🔧 Arquitetura de Ferramentas Modulares

### Sistema Base
```
AssistenteOperador
├── ChatManager (gerencia conversação)
├── ToolsRegistry (registro de ferramentas)
├── UIController (gerencia popups/cards)
└── IntegrationBridge (conecta ao painel)
```

### Ferramentas Disponíveis (Modulares)

#### 🎯 Ferramenta 1: CARTEIRA DE CLIENTES
**Descrição:** Análise e sugestões sobre clientes cadastrados  
**Entrada:** Pergunta do operador  
**Saída:** Lista de clientes + ações sugeridas  
**Ações possíveis:**
- Ver todos os clientes
- Filtrar por estágio
- Exportar lista
- Atribuir seguimento

```javascript
{
  id: "carteira-clientes",
  name: "Carteira de Clientes",
  icon: "👥",
  enabled: true,
  actions: [
    { label: "Ver Todos", action: "openClients" },
    { label: "Exportar", action: "exportList" },
    { label: "Filtrar", action: "filterClients" }
  ]
}
```

#### 📊 Ferramenta 2: FUNIL DE VENDAS
**Descrição:** Análise do funil e sugestões de melhoria  
**Entrada:** Análise do funil atual  
**Saída:** Gargalos identificados + ações  
**Ações possíveis:**
- Visualizar funil
- Aumentar leads
- Melhorar conversão
- Relatório detalhado

```javascript
{
  id: "funil-vendas",
  name: "Funil de Vendas",
  icon: "📈",
  enabled: true,
  actions: [
    { label: "Visualizar", action: "viewFunnel" },
    { label: "Aumentar Leads", action: "leadsStrategy" },
    { label: "Relatório", action: "generateReport" }
  ]
}
```

#### 💬 Ferramenta 3: DISPARO COMERCIAL
**Descrição:** Criar e disparar mensagens em massa com templates  
**Entrada:** Tipo de mensagem + público-alvo  
**Saída:** Preview + confirmação de envio  
**Ações possíveis:**
- Criar campanha
- Usar template
- Preview
- Disparar agora

```javascript
{
  id: "disparo-comercial",
  name: "Disparo Comercial",
  icon: "📩",
  enabled: true,
  actions: [
    { label: "Criar Campanha", action: "newCampaign" },
    { label: "Templates", action: "showTemplates" },
    { label: "Disparar", action: "sendCampaign" }
  ]
}
```

#### 📱 Ferramenta 4: MEU WHATSAPP
**Descrição:** Gerenciar contatos e envios via WhatsApp  
**Entrada:** Mensagem + destinatário  
**Saída:** Status do envio  
**Ações possíveis:**
- Conectar número
- Enviar mensagem
- Escanear QR Code
- Histórico

```javascript
{
  id: "meu-whatsapp",
  name: "Meu WhatsApp",
  icon: "💬",
  enabled: true,
  actions: [
    { label: "Conectar", action: "connectWhatsapp" },
    { label: "Enviar", action: "sendMessage" },
    { label: "QR Code", action: "showQRCode" }
  ]
}
```

#### 🤖 Ferramenta 5: GERADOR DE CONTEÚDO (Exemplo Extensível)
**Descrição:** Gerar textos de vendas otimizados  
**Entrada:** Produto/Serviço + público  
**Saída:** Sugestões de conteúdo  

---

## 💻 Stack Técnico Recomendado

### Frontend
```
React/Vue + TypeScript
├── @radix-ui (componentes acessíveis)
├── framer-motion (animações flutuantes)
├── zustand (state management)
└── axios (API calls)
```

### Backend (IA)
```
Node.js/Python
├── OpenAI API / Anthropic Claude
├── Redis (cache de ferramentas)
├── PostgreSQL (histórico conversas)
└── WebSocket (real-time updates)
```

### Integração
```
├── Eventos customizados (painel → assistente)
├── Context API / Store global
├── LocalStorage (preferências usuário)
└── API REST (dados operacionais)
```

---

## 🔄 Fluxo de Interação

```
1. Usuário clica no card do assistente
   ↓
2. Card expande, input de chat fica visível
   ↓
3. Usuário digita pergunta (ex: "Como aumentar conversões?")
   ↓
4. Envia mensagem (Enter ou botão)
   ↓
5. IA processa → identifica ferramentas relevantes
   ↓
6. Popup flutuante abre com resposta
   ↓
7. Popup mostra:
   - Resposta conversacional
   - Ferramentas sugeridas com ações
   - Botões de ação rápida
   ↓
8. Usuário clica em ação (ex: "Aumentar Leads")
   ↓
9. Ferramenta se integra ao painel
   ↓
10. Conversa continua no popup (usuário faz follow-ups)
```

---

## 📝 Exemplo de Conversa

```
Operador: "Como melhorar minha carteira de 50 leads?"

IA: "Analisando sua carteira... Encontrei oportunidades:
    
    ✓ 15 leads estão há +30 dias sem contato → RISCO
    ✓ 8 leads prontos para proposta → ALTA PRIORIDADE
    ✓ 27 leads em prospecção → ATIVA"

[Ferramentas Sugeridas]
┌─────────────────────────────┐
│ 👥 Carteira de Clientes     │
│ → Visualizar em tempo real  │
│                             │
│ 📧 Disparo Comercial        │
│ → Campanha de re-engajamento│
│                             │
│ 📊 Funil de Vendas          │
│ → Aumentar taxa conversão   │
└─────────────────────────────┘

Operador: "Dispara uma mensagem pro grupo de 30+ dias?"

IA: "Ótimo! Preparei template de re-engajamento.
    
    [Preview]
    'Oi [Nome]! Tudo bem? 
    Vi que nos últimos 30 dias não temos contato...
    Gostaria de agendar uma conversa? Tenho novidades!'"

[Pré-visualizar] [Editar Template] [Disparar Agora]
```

---

## 🎛️ Configurações & Preferences

```json
{
  "assistente": {
    "enabled": true,
    "position": "right", // left, right, center
    "autoOpen": false,
    "theme": "light", // light, dark, auto
    "soundNotification": true,
    "tools": {
      "carteira-clientes": { "enabled": true },
      "funil-vendas": { "enabled": true },
      "disparo-comercial": { "enabled": true },
      "meu-whatsapp": { "enabled": true }
    },
    "shortcuts": {
      "openAssistant": "Ctrl+/",
      "sendMessage": "Ctrl+Enter"
    }
  }
}
```

---

## 🚀 Roadmap de Desenvolvimento

### Fase 1: MVP (2 semanas)
- ✅ Card + Input básico
- ✅ Popup flutuante
- ✅ Integração com CarteiradeClientes
- ✅ IA conversacional básica

### Fase 2: Ferramentas (3 semanas)
- ⏳ Integração Funil de Vendas
- ⏳ Disparo Comercial com templates
- ⏳ WhatsApp nativo
- ⏳ Histórico de conversas

### Fase 3: Advanced (4 semanas)
- ⏳ Análise preditiva
- ⏳ Automações inteligentes
- ⏳ Custom tools por usuário
- ⏳ Analytics & insights

---

## 📊 KPIs de Sucesso

- **Adoção:** % de operadores usando diariamente
- **Tempo economizado:** média minutos/dia por operador
- **Aumento de conversão:** impacto nas métricas do funil
- **Satisfação:** NPS do assistente
- **Uso de ferramentas:** quais tools mais usadas

---

## 🔐 Segurança & Compliance

- Autenticação via JWT
- Validação de permissões antes de cada ação
- Logs de todas as operações
- LGPD compliance para dados de clientes
- Rate limiting de API calls

---

## 📞 Contato & Suporte

Dúvidas sobre a arquitetura? Entre em contato com o time de produto.

**Versão:** 1.0  
**Data:** 2024  
**Status:** Em desenvolvimento
