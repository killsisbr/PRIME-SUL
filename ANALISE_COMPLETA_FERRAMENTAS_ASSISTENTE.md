# ANÁLISE COMPLETA — Ferramentas para Assistente IA do Operador

## 📊 Visão Geral do Projeto PRIME SUL

**Sistema:** CRM multi-tenant com disparo em massa, bot anti-ban e integração com Banco do Brasil  
**Usuários alvo:** Operadores (vendedores) e Administrador  
**Fluxo principal:** Captura lead → Triagem → Confirmação → Repasse → Acompanhamento no funil

---

## 🎯 Mapeamento de Processos & Ramificações

### **NÍVEL 1: PROCESSOS MACRO**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. GESTÃO DE LEADS (Carteira de Clientes)                   │
└─────────────────────────────────────────────────────────────┘
   ├─ 1.1 Cadastro e Importação de Leads
   ├─ 1.2 Detecção de Duplicidade
   ├─ 1.3 Gestão de Status (6 estados)
   ├─ 1.4 Scoring Automático (0-100)
   ├─ 1.5 Busca e Filtros Avançados
   ├─ 1.6 Timeline/Histórico de Mudanças
   ├─ 1.7 Exportação e Relatórios
   └─ 1.8 Backup e Recuperação

┌─────────────────────────────────────────────────────────────┐
│ 2. FLUXO DE MENSAGENS (Bot Anti-Ban)                        │
└─────────────────────────────────────────────────────────────┘
   ├─ 2.1 Triagem (números institucionais)
   ├─ 2.2 Confirmação (SIM/NÃO)
   ├─ 2.3 Repasse para Vendedor (handoff)
   ├─ 2.4 Monitoramento de Respostas
   ├─ 2.5 Retry Automático (5 tentativas)
   ├─ 2.6 Opt-out e Bloqueios Permanentes
   └─ 2.7 Cooldown e Rotação de Números

┌─────────────────────────────────────────────────────────────┐
│ 3. CAMPANHAS E DISPARO (Operações em Massa)                 │
└─────────────────────────────────────────────────────────────┘
   ├─ 3.1 Criação de Campanha
   ├─ 3.2 Seleção de Público-Alvo
   ├─ 3.3 Escolha de Template de Mensagem
   ├─ 3.4 Agendamento e Disparo
   ├─ 3.5 Pausa e Retomada de Campanha
   ├─ 3.6 Cancelamento e Rollback
   ├─ 3.7 Histórico e Auditoria de Envios
   └─ 3.8 Estatísticas por Campanha

┌─────────────────────────────────────────────────────────────┐
│ 4. FUNIL DE VENDAS (Analytics & Estratégia)                 │
└─────────────────────────────────────────────────────────────┘
   ├─ 4.1 Visualização por Estágios (6 status)
   ├─ 4.2 Taxa de Conversão entre Etapas
   ├─ 4.3 Detecção de Gargalos
   ├─ 4.4 Previsões Baseadas em Histórico
   ├─ 4.5 Automação por Estágio (auto-disparo, auto-follow-up)
   ├─ 4.6 Comparação Periódica (dia/semana/mês)
   └─ 4.7 Relatórios de Performance

┌─────────────────────────────────────────────────────────────┐
│ 5. NÚMEROS E ANTI-BAN (Gestão de Recursos)                  │
└─────────────────────────────────────────────────────────────┘
   ├─ 5.1 Cadastro de Números Descartáveis
   ├─ 5.2 Monitoramento de Status (ativo/resfriado/banido)
   ├─ 5.3 Limite de Mensagens por Número
   ├─ 5.4 Cooldown Automático (resfriamento)
   ├─ 5.5 Rotação Inteligente de Números
   ├─ 5.6 Histórico de Eventos do Bot
   ├─ 5.7 Análise de Taxa de Banimento
   └─ 5.8 Recuperação de Números em Cooldown

┌─────────────────────────────────────────────────────────────┐
│ 6. MEU WHATSAPP (Números Operacionais do Vendedor)          │
└─────────────────────────────────────────────────────────────┘
   ├─ 6.1 Conexão de Número Pessoal
   ├─ 6.2 QR Code para Autenticação
   ├─ 6.3 Histórico de Conversas por Lead
   ├─ 6.4 Mensagens Não Lidas e Threading
   ├─ 6.5 Integração com Lead (visualizar chat do lead)
   ├─ 6.6 Envio Direto de Mensagens
   └─ 6.7 Gerenciamento de Múltiplos Números

┌─────────────────────────────────────────────────────────────┐
│ 7. TEMPLATES E CONTEÚDO (Mensagens Estratégicas)            │
└─────────────────────────────────────────────────────────────┘
   ├─ 7.1 Criação de Templates (3 propósitos: screening, handoff, followup)
   ├─ 7.2 Variáveis Dinâmicas ({{nome}}, {{limite_est}}, etc.)
   ├─ 7.3 Versionamento de Templates
   ├─ 7.4 Preview de Mensagem Renderizada
   ├─ 7.5 A/B Testing de Templates
   ├─ 7.6 Biblioteca de Resposta Rápida
   └─ 7.7 Auditar Uso de Templates

┌─────────────────────────────────────────────────────────────┐
│ 8. CONFIGURAÇÕES E ADMIN (Gestão Operacional)               │
└─────────────────────────────────────────────────────────────┘
   ├─ 8.1 Gestão de Vendedores (criar, editar, ativar/desativar)
   ├─ 8.2 Limites por Vendedor (max_leads, max_sends/dia)
   ├─ 8.3 Credencial do Banco do Brasil (CNPJ, parceiro)
   ├─ 8.4 Configurações de Disparo (delay, batch size, daily limit)
   ├─ 8.5 Políticas de Resfriamento (cooldown schedule)
   ├─ 8.6 Webhook de Captura (integração site → leads)
   ├─ 8.7 Auditoria de Ações (logs de operador)
   ├─ 8.8 Backup e Restore do Banco
   └─ 8.9 Permissões e Roles

┌─────────────────────────────────────────────────────────────┐
│ 9. JOBS E FILA (Processamento Assíncrono)                   │
└─────────────────────────────────────────────────────────────┘
   ├─ 9.1 Fila de Disparo em Lotes
   ├─ 9.2 Retentativa Inteligente
   ├─ 9.3 Agendamento de Tarefas
   ├─ 9.4 Monitoramento de Status da Fila
   ├─ 9.5 Pausa/Retomada de Fila
   ├─ 9.6 Limpeza de Jobs Antigos
   └─ 9.7 Dead Letter Queue (jobs falhados)

┌─────────────────────────────────────────────────────────────┐
│ 10. ANÁLISE & INTELIGÊNCIA (Insights para Operador)         │
└─────────────────────────────────────────────────────────────┘
   ├─ 10.1 Dashboard KPI em Tempo Real
   ├─ 10.2 Sugestões de Próxima Ação (IA)
   ├─ 10.3 Identificação de Leads Quentes
   ├─ 10.4 Análise de Padrão de Resposta
   ├─ 10.5 Benchmarking (você vs. equipe)
   ├─ 10.6 Previsão de Conversão (churn prediction)
   ├─ 10.7 Alertas Automáticos (gargalo no funil, número banido)
   └─ 10.8 Relatório Exportável (PDF, Excel)

┌─────────────────────────────────────────────────────────────┐
│ 11. CONFORMIDADE & COMPLIANCE (Legal & Segurança)           │
└─────────────────────────────────────────────────────────────┘
   ├─ 11.1 Validação de Consentimento (lead solicitou simulação)
   ├─ 11.2 Rastreamento de Origem (auditoria de fonte)
   ├─ 11.3 Opt-out Imediato (remover contato bloqueado)
   ├─ 11.4 LGPD Compliance (direito ao esquecimento)
   ├─ 11.5 Criptografia de Dados Sensíveis (CPF, conta bancária)
   ├─ 11.6 Logs de Acesso (quem viu qual lead)
   └─ 11.7 Retenção de Dados e Arquivamento

┌─────────────────────────────────────────────────────────────┐
│ 12. INTEGRAÇÕES EXTERNAS                                    │
└─────────────────────────────────────────────────────────────┘
   ├─ 12.1 Banco do Brasil (API de Crédito)
   ├─ 12.2 WhatsApp Cloud / Baileys (multi-session)
   ├─ 12.3 Site do Cliente (webhook de captura)
   ├─ 12.4 Exportação para CRM Externo
   ├─ 12.5 Integração com E-mail Marketing
   └─ 12.6 API REST para Terceiros

```

---

## 🔧 MATRIZ DE FERRAMENTAS DO ASSISTENTE

### **STATUS OBRIGATÓRIO: CRÍTICO (MVP)**

Ferramentas que devem existir para o assistente funcionar minimamente.

#### **FERRAMENTA 1️⃣: CARTEIRA DE CLIENTES AVANÇADA**
**Nivel:** Crítico  
**Descrição:** Visualização, busca, filtro e ações em massa sobre toda carteira de leads

**O que o operador precisa:**
- ✅ Ver todos os leads de forma inteligente (busca contextual + filtros)
- ✅ Entender status de cada lead (novo, em contato, confirmado, etc.)
- ✅ Identificar leads prioritários automaticamente
- ✅ Executar ações rápidas (confirmar, bloquear, repassar)
- ✅ Ver histórico de comunicação com cada lead
- ✅ Exportar carteira em diferentes formatos
- ✅ Copiar/clonar leads para nova campanha

**Ações que a IA deve oferecer:**
```
Operador: "Como estão meus leads?"
IA: "Analiso sua carteira com X leads no total:
    
    📊 STATUS ATUAL:
    • 23 leads NOVOS (aguardando primeiro contato)
    • 15 leads EM CONTATO (responderam algo)
    • 8 leads CONFIRMADOS (prontos para simulação)
    • 4 leads CONCLUÍDOS (finalizados)
    
    ⚠️ ALERTAS:
    • 12 leads SEM RESPOSTA há +7 dias → RISCO de perda
    • 3 leads BLOQUEADOS → não podem ser contatados
    
    🎯 SUGESTÕES:
    → Retomar os 12 sem resposta com campanha de re-engajamento
    → Focar nos 8 confirmados para concluir
    → Analisar por que 3 foram bloqueados"

Ações disponíveis:
• [Visualizar Carteira Completa]
• [Re-engajar Sem Resposta]
• [Priorizar Confirmados]
• [Analisar Bloqueados]
• [Exportar Carteira]
```

**Integração com Backend:**
- `GET /api/leads` → lista com status/scoring
- `GET /api/leads/counts` → contadores
- `PATCH /api/leads/:id/status` → atualizar status
- `GET /api/leads/:id/conversations` → histórico de chats
- Ações em batch (selecionar múltiplos + aplicar ação)

**Database Tables:**
- `leads` (status, score, prioridade, tags)
- `lead_history` (timeline de mudanças)
- `messages` (histórico de chats por lead)

---

#### **FERRAMENTA 2️⃣: FUNIL DE VENDAS INTELIGENTE**
**Nível:** Crítico  
**Descrição:** Análise em tempo real do funil, detecção de gargalos e sugestões automáticas

**O que o operador precisa:**
- ✅ Ver funil visual (quantos leads em cada estágio)
- ✅ Entender taxa de conversão entre etapas
- ✅ Identificar qual etapa é gargalo
- ✅ Prever impacto de ação X no funil
- ✅ Comparar seu funil com a meta/equipe
- ✅ Receber alertas quando taxa cai

**Ações que a IA deve oferecer:**
```
Operador: "Preciso aumentar as conversões. O que fazer?"
IA: "Analisando seu funil..."

FUNIL ATUAL:
├─ Novos:           50 leads (100%)
├─ Em contato:      15 leads (30% de conversão)
├─ Confirmados:     8 leads (53% de conversão)
└─ Concluídos:      3 leads (38% de conversão)

❌ GARGALO IDENTIFICADO: Etapa "Novos → Em contato"
   Taxa esperada: 40-60% | Sua taxa: 30%
   ⏱️ Você está 10% abaixo da meta

💡 DIAGNÓSTICO:
   • Leads não estão sendo contatados rápido o suficiente
   • Tempo médio: 2.5 dias | Recomendado: < 1 dia
   • Números de disparo podem estar resfriados

🚀 PLANO DE AÇÃO (sugerido):
   1. Disparar campanha de re-engajamento para 35 leads novos
   2. Usar 2 números novos (atuais estão sobrecarregados)
   3. Aumentar frequência de contato (sim, é permitido)
   4. Reativar lead "bloqueado" que respondeu (revisar opt-out)

IMPACTO PROJETADO:
   Se converter para 40%: +7 leads em contato
   Ganha: +3-5 simulações concluídas (projeção)"

Ações:
• [Disparar Campanha de Re-engajamento]
• [Adicionar Novos Números]
• [Ver Leads Bloqueados]
• [Gerar Relatório de Funil]
```

**Integração com Backend:**
- `GET /api/leads/funnel` → dados do funil
- `GET /api/leads` → filtro por status + contadores
- Previsão (ML simples): taxa histórica × volume atual
- Alertas (WebSocket real-time quando taxa cai)

**Database Tables:**
- `leads` (status)
- `lead_history` (rastrear mudanças de estágio)
- `sends` (validar quando foi enviado)

---

#### **FERRAMENTA 3️⃣: DISPARO COMERCIAL AVANÇADO**
**Nível:** Crítico  
**Descrição:** Criar, disparar e monitorar campanhas de mensagens em massa

**O que o operador precisa:**
- ✅ Criar campanha + selecionar público-alvo dinamicamente
- ✅ Escolher/editar template de mensagem
- ✅ Visualizar preview com variáveis renderizadas
- ✅ Agendar disparo (imediato, específico, recorrente)
- ✅ Começar/pausar/cancelar durante a campanha
- ✅ Ver estatísticas em tempo real (enviados, confirmação, erros)
- ✅ Reaproveitá-la para nova audiência

**Ações que a IA deve oferecer:**
```
Operador: "Quero disparar pra meus leads novos"
IA: "Ótimo! Vou criar uma campanha de triagem.

📋 RESUMO:
• Público-alvo: 23 leads (status = 'novos')
• Template sugerido: Triagem BB (screening)
• Números disponíveis: 3 (ativo, ativo, resfriado)
• Limite de envios hoje: 150 (consumidos: 45)

PREVIEW DA MENSAGEM:
'Olá João! 👋

Temos uma ótima oportunidade de crédito exclusiva 
para você, com taxa competitiva do Banco do Brasil.

Pode oferecer? (SIM/NÃO)'

⚙️ CONFIGURAÇÃO:
• Delay entre envios: 8 segundos (evita ban)
• Horário: agora (09:30)
• Números: usar 2 (não sobrecarregar)

🎯 RESULTADO ESPERADO:
• Envios: 23
• Taxa de resposta: ~30-40% (6-9 confirmações)
• Duração: ~4 minutos"

Ações:
• [Disparar Agora]
• [Agendar para Horário]
• [Editar Template]
• [Simular/Preview Completo]
• [Selecionar Público-Alvo]
```

**Integração com Backend:**
- `POST /api/campaigns` → criar
- `POST /api/campaigns/:id/start` → começar
- `POST /api/campaigns/:id/pause` → pausar
- `POST /api/campaigns/:id/cancel` → cancelar
- `GET /api/campaigns` → listar + status
- `GET /api/campaigns/:id` → detalhe com estatísticas
- WebSocket para updates em tempo real

**Database Tables:**
- `campaigns` (status, filtros, template)
- `sends` (por lead × campanha, rastrear resposta)
- `message_templates` (template + variáveis)
- `bot_numbers` (números disponíveis)
- `jobs` (fila de disparo)

---

#### **FERRAMENTA 4️⃣: MEU WHATSAPP - NÚMEROS OPERACIONAIS**
**Nível:** Crítico  
**Descrição:** Conectar números pessoais do vendedor, gerenciar chats e enviar mensagens diretas

**O que o operador precisa:**
- ✅ Escanear QR code para conectar número
- ✅ Ver conversas agrupadas por lead
- ✅ Notificações de mensagens não lidas
- ✅ Enviar mensagem direta ao lead
- ✅ Histórico de toda comunicação
- ✅ Arquivar/desarquivar chats
- ✅ Gerenciar múltiplos números

**Ações que a IA deve oferecer:**
```
Operador: "Alguém respondeu meu WhatsApp?"
IA: "Sim! Verifiquei seus números conectados.

📱 NÚMEROS ATIVOS: 2
   ✓ (11) 98765-4321 - Primário
   ✓ (11) 91234-5678 - Backup

💬 MENSAGENS NÃO LIDAS: 7
   • João Silva - "Sim, tô interessado"
   • Maria Santos - "Qual o valor?"
   • Carlos (3 mensagens)

🔥 PRIORIDADE:
   → João Silva precisa de acompanhamento (respondeu sim!)
   → Maria Santos questionando valor (enviar simulação)
   → Carlos: conversa ativa (6 mensagens)

📊 RESUMO:
   • 7 mensagens não lidas
   • 3 chats ativos
   • Último contato: 5 min atrás (Carlos)"

Ações:
• [Ver Conversas]
• [Abrir Chat com João]
• [Enviar Simulação para Maria]
• [Conectar Novo Número]
• [Ver Histórico Completo]
```

**Integração com Backend:**
- `GET /api/leads/:id/conversations` → chats por lead
- WebSocket para mensagens em tempo real
- `POST /api/whatsapp/send` → enviar mensagem
- Escalabilidade: suportar múltiplas sessões Baileys
- QR code endpoint: `GET /api/whatsapp/qrcode/:number`

**Database Tables:**
- `seller_numbers` (números do vendedor)
- `messages` (histórico de chats)
- `leads` (vinculação ao lead)
- Baileys sessions (storage local + sincronização)

---

### **STATUS OBRIGATÓRIO: SECUNDÁRIO (Essencial)**

Ferramentas que fortalecem o operador, mas não impedem operação.

#### **FERRAMENTA 5️⃣: GESTÃO DE NÚMEROS ANTI-BAN**
**Nível:** Secundário (mas crítico para escala)  
**Descrição:** Monitorar, rotacionar e otimizar números descartáveis

**O que o operador precisa:**
- ✅ Ver status de todos os números (ativo/resfriado/banido)
- ✅ Entender quanto cada número já enviou hoje
- ✅ Saber quando um número será reativado (cooldown)
- ✅ Marcar número como banido manualmente
- ✅ Adicionar novos números quando necessário
- ✅ Análise: qual número tem melhor taxa

**Ações que a IA deve oferecer:**
```
Operador: "Meus números estão OK?"
IA: "Verificando status dos números...

📱 NÚMEROS DE DISPARO: 5 no total

✅ ATIVOS (3):
   • (85) 98765-4321 | Enviados: 45/150 | Taxa: 32%
   • (85) 91234-5678 | Enviados: 78/150 | Taxa: 28%
   • (85) 87654-3210 | Enviados: 12/150 | Taxa: 41% ⭐

❄️ RESFRIADOS (1):
   • (85) 95555-5555 | Resfria até: 18:30 (4h)
   • Motivo: Limite diário atingido

❌ BANIDO (1):
   • (85) 94321-0987 | Suspeito de bloqueio WhatsApp
   • Recomendação: Desativar ou investigar

⚡ SUGESTÕES:
   → Usar (85) 87654-3210 nas próximas campanhas (melhor taxa)
   → Aguardar resfriamento até 18:30
   → Investigar número banido (testar manualmente)"

Ações:
• [Ver Detalhes de Cada Número]
• [Marcar Número como Banido]
• [Adicionar Novo Número]
• [Forçar Resfriamento]
• [Gerar Relatório de Performance]
```

**Integração com Backend:**
- `GET /api/campaigns/numbers` → lista números
- `PATCH /api/campaigns/numbers/:id` → atualizar status
- `POST /api/campaigns/numbers` → cadastrar novo
- Monitoramento em tempo real (eventos do bot)

**Database Tables:**
- `bot_numbers` (status, mensagens_enviadas, cooled_until)
- `bot_events` (eventos de cada número)
- `sends` (taxa de resposta por número)

---

#### **FERRAMENTA 6️⃣: TEMPLATES E CONTEÚDO INTELIGENTE**
**Nível:** Secundário  
**Descrição:** Criar, versionar e otimizar templates de mensagem

**O que o operador precisa:**
- ✅ Visualizar todos os templates (screening, handoff, followup)
- ✅ Criar novo template com preview
- ✅ Usar variáveis dinâmicas ({{nome}}, {{limite_est}})
- ✅ Ver qual template funciona melhor (A/B testing)
- ✅ Versionar/arquivar templates antigos
- ✅ Sugestões de melhoria baseadas em resposta

**Ações que a IA deve oferecer:**
```
Operador: "Qual template está funcionando melhor?"
IA: "Analisando seus templates...

📝 TEMPLATES DISPONÍVEIS: 4

🏆 MELHOR DESEMPENHO (Screening):
   'Olá {{nome}}! Temos oportunidade exclusiva do BB.'
   • Enviados: 123
   • Taxa de resposta: 35% ✅
   • Confirmação: 42/123

📊 BOM (Handoff):
   'É verdade! Vou conectar um especialista.'
   • Enviados: 89
   • Taxa de resposta: 28%

⚠️ PODE MELHORAR (Followup):
   'Você ainda está interessado?'
   • Enviados: 156
   • Taxa de resposta: 8% ❌
   • Sugestão: Adicionar senso de urgência

💡 RECOMENDAÇÃO:
   → Usar template screening em novas campanhas
   → Reescrever template followup (muito genérico)
   → Testar novo template com 50 leads (A/B test)"

Ações:
• [Ver Todos os Templates]
• [Criar Novo Template]
• [Editar Template]
• [Ver Estatísticas por Template]
• [Recomendar Melhoria]
```

**Integração com Backend:**
- `GET /api/templates` → listar
- `POST /api/templates` → criar
- `PUT /api/templates/:id` → editar
- `GET /api/templates/:id/stats` → estatísticas
- Preview com renderização de variáveis

**Database Tables:**
- `message_templates` (body, purpose, ativo)
- `sends` (rastrear qual template foi usado)
- Análise de resposta por template

---

#### **FERRAMENTA 7️⃣: ALERTAS E MONITORAMENTO EM TEMPO REAL**
**Nível:** Secundário  
**Descrição:** Notificar operador sobre eventos críticos

**O que o operador precisa:**
- ✅ Alerta quando lead responde (especialmente "sim")
- ✅ Alerta quando número fica banido
- ✅ Alerta quando campanha falha
- ✅ Alerta quando gargalo no funil
- ✅ Alerta quando atinge limite diário
- ✅ Notificações push/toast/email

**Ações que a IA deve oferecer:**
```
Operador: "Tá tudo calmo?"
IA: "Temos 3 alertas importantes:

🔔 ALERTAS ATIVOS:

1. 🎯 Lead respondeu "SIM"!
   João Silva (11) 98765-4321
   "Sim, tô muito interessado!"
   ⏰ Há 2 minutos
   → AÇÃO: Enviar simulação imediatamente

2. ❌ Número banido
   (85) 98765-4321
   Último envio: há 15 min
   → AÇÃO: Usar números alternativos

3. ⚠️ Limite diário atingido
   Enviados: 150/150 hoje
   → AÇÃO: Aguardar reset à 00:00 ou usar novo número

📊 STATUS GERAL:
   ✓ 23 leads aguardando contato
   ✓ 7 respostas não lidas
   ✓ 2 campanhas ativas"

Ações:
• [Responder João]
• [Adicionar Número Novo]
• [Pausar Campanhas]
• [Ver Todos Alertas]
```

**Integração com Backend:**
- WebSocket em tempo real
- Notificações push (browser + mobile)
- `GET /api/alerts` → listar alertas
- Preferências de notificação (usuário configura o que quer receber)

**Database Tables:**
- `bot_events` (eventos de bots)
- `sends` (rastrear respostas)
- `campaigns` (status de campanhas)

---

#### **FERRAMENTA 8️⃣: ANÁLISE E INSIGHTS BASEADOS EM IA**
**Nível:** Secundário  
**Descrição:** Sugestões inteligentes e contextualizadas baseadas em dados

**O que o operador precisa:**
- ✅ Sugestões de próxima ação ("Você deveria disparar para...")
- ✅ Identificação de leads quentes (mais propensos a converter)
- ✅ Análise de padrão de resposta
- ✅ Benchmarking (você vs. meta / vs. equipe)
- ✅ Previsão de churn (leads em risco)
- ✅ Recomendação de template melhor
- ✅ Alertas de anomalia (queda abrupta em taxa)

**Ações que a IA deve oferecer:**
```
Operador: "O que devo fazer agora?"
IA: "Baseado em sua carteira e histórico, eis o plano:

📋 PRÓXIMAS AÇÕES (Priorizadas):

1. 🔥 RE-ENGAJAR 12 LEADS SEM RESPOSTA (Alta urgência)
   • Estão há +7 dias sem contato
   • Taxa de churn: ~25% se continuar sem contato
   • Sugestão: Disparar seguimento em 1 hora
   • Template recomendado: "Ainda está interessado?"
   • Público-alvo: 12 leads

2. ✅ FINALIZAR 8 LEADS CONFIRMADOS (Alta valor)
   • Prontos para simulação
   • Valor potencial: ~R$ 50k em crédito
   • Sugestão: Envio imediato de simulação
   • Responsável: Seu número pessoal (melhor taxa)

3. 🚀 EXPANDIR CARTEIRA (Oportunidade)
   • Você pode absorver +20 leads sem afetar qualidade
   • Velocidade de processamento atual: 2.3 leads/dia
   • Limite: 30 leads/dia (não atingido)

4. 📊 MELHORAR TAXA (Eficiência)
   • Sua taxa novo→contato: 30% | Meta: 40%
   • Motivo: Delay entre envios está alto (12s vs. 8s recomendado)
   • Sugestão: Reduzir delay + usar 3 números

⏱️ CHAMADA À AÇÃO:
   👉 [Disparar para 12 Sem Resposta] (2 min)
   👉 [Enviar Simulações Agora] (5 min)
   👉 [Aceitar 20 Novos Leads] (confirmar)
   👉 [Revisar Configuração de Disparo] (10 min)"

Ações:
• [Executar Plano Completo]
• [Fazer Apenas Ação 1]
• [Ver Análise Detalhada]
• [Customizar Sugestões]
```

**Integração com Backend:**
- Histórico de leads (status, datas, respostas)
- Cálculo de taxa (leads_convertidos / leads_totais por estágio)
- Previsão (regressão simples ou ML)
- Comparação com meta/média (configurável no admin)
- Detecção de anomalias (mudança > 15% é alertada)

**Database Tables:**
- `leads` (completo)
- `lead_history` (timeline)
- `sends` (rastrear respostas e datas)
- `campaigns` (estatísticas)

---

### **STATUS OPCIONAL (Complementar)**

Ferramentas que adicionam muito valor mas não são críticas.

#### **FERRAMENTA 9️⃣: CONFIGURAÇÕES AVANÇADAS E AUTOMAÇÃO**
**Nível:** Opcional  
**Descrição:** Automação de ações repetitivas (auto-disparo por estágio, agendamentos, etc.)

**Exemplos:**
- Auto-disparar follow-up para leads em contato após 24h
- Auto-marcar como "bloqueado" se receber "não, obrigado"
- Auto-repassar confirmados para o número do vendedor
- Agendar disparo para horário inteligente (13h-17h = melhor taxa)
- Auto-rotacionar números (trocar de número a cada 30 mensagens)

**Integração:** `PUT /api/config` (admin) + `GET /api/sellers/me/automations` (operador)

---

#### **FERRAMENTA 🔟: RELATÓRIOS E EXPORTAÇÃO**
**Nível:** Opcional  
**Descrição:** Gerar relatórios em PDF/Excel para compartilhar

**Exemplos:**
- Relatório de Funil (semanal/mensal)
- Planilha de Leads (filtrável por status/origem)
- Análise de Campanhas (qual disparou melhor)
- Auditar Conformidade (logs de consentimento)
- Relatório de Compliance (LGPD, opt-outs)

**Integração:** `GET /api/leads/export?format=csv|xlsx|pdf` + `GET /api/campaigns/:id/report`

---

#### **FERRAMENTA 1️⃣1️⃣: GERENCIADOR DE VENDEDORES (Admin)**
**Nível:** Opcional (admin-only)  
**Descrição:** Criar, editar, monitorar vendedores

**O que o admin precisa:**
- Criar vendedor com credenciais
- Definir limites (max_leads, max_sends/dia)
- Ver performance de cada vendedor
- Ativar/desativar vendedor
- Transferir leads entre vendedores
- Auditar ações de vendedor

**Integração:** `GET|POST|PATCH /api/sellers` (admin-only)

---

#### **FERRAMENTA 1️⃣2️⃣: COMPLIANCE E AUDITORIA**
**Nível:** Opcional (admin + legal)  
**Descrição:** Rastrear e auditar todas as ações sensíveis

**O que rastrear:**
- Quem modificou qual lead
- Quem enviou qual campanha
- Histórico de mudanças de template
- Registros de consentimento (lead solicitou simulação)
- Opt-outs e bloqueios permanentes
- Acesso a dados sensíveis (CPF, conta bancária)

**Database:**
- `audit_logs` (ação, usuário, timestamp, recurso)
- `compliance_events` (consentimento, opt-out, LGPD)

---

## 📐 MATRIZ FINAL DE FERRAMENTAS

| # | Ferramenta | Obrigatoriedade | Backend | Prioritário | Complexidade |
|---|-----------|-----------------|---------|-------------|--------------|
| 1️⃣ | Carteira de Clientes | **CRÍTICA** | `GET /leads`, `PATCH /leads/:id` | MVP | Alta |
| 2️⃣ | Funil de Vendas | **CRÍTICA** | `GET /leads/funnel` | MVP | Alta |
| 3️⃣ | Disparo Comercial | **CRÍTICA** | `POST|PATCH /campaigns`, `GET /campaigns` | MVP | Alta |
| 4️⃣ | Meu WhatsApp | **CRÍTICA** | `GET /conversations`, WebSocket | MVP | Alta |
| 5️⃣ | Números Anti-Ban | **SECUNDÁRIA** | `GET|PATCH /campaigns/numbers` | MVP+1 | Média |
| 6️⃣ | Templates | **SECUNDÁRIA** | `GET|POST|PUT /templates` | MVP+1 | Média |
| 7️⃣ | Alertas Real-time | **SECUNDÁRIA** | WebSocket, `GET /alerts` | MVP+1 | Média |
| 8️⃣ | Análise & Insights | **SECUNDÁRIA** | Histórico + ML | MVP+2 | Alta |
| 9️⃣ | Automações | **OPCIONAL** | `PUT /config` | Phase 2 | Alta |
| 🔟 | Relatórios | **OPCIONAL** | `GET /export` | Phase 2 | Média |
| 1️⃣1️⃣ | Admin: Vendedores | **OPCIONAL** | `GET|POST|PATCH /sellers` | Admin | Baixa |
| 1️⃣2️⃣ | Compliance | **OPCIONAL** | Audit logs | Phase 3 | Média |

---

## 🎯 Roadmap de Implementação

### **FASE 1: MVP (Semana 1-2)**
**Ferramentas críticas + básico de conversação**
- [ ] Ferramenta 1: Carteira de Clientes
- [ ] Ferramenta 2: Funil de Vendas
- [ ] Ferramenta 3: Disparo Comercial
- [ ] Ferramenta 4: Meu WhatsApp
- [ ] Chat básico com IA

### **FASE 2: Consolidação (Semana 3-4)**
**Ferramentas secundárias + inteligência**
- [ ] Ferramenta 5: Anti-Ban
- [ ] Ferramenta 6: Templates
- [ ] Ferramenta 7: Alertas Real-time
- [ ] Ferramenta 8: Análise & Insights (versão 1)

### **FASE 3: Automação (Semana 5-6)**
**Otimização e complementos**
- [ ] Ferramenta 9: Automações
- [ ] Ferramenta 10: Relatórios
- [ ] Analytics aprimorado
- [ ] Integração com Banco do Brasil

---

## 🔌 Endpoints Necessários (Resumido)

```
CRÍTICAS (MVP):
GET    /api/leads
POST   /api/leads
GET    /api/leads/counts
GET    /api/leads/funnel
PATCH  /api/leads/:id/status
GET    /api/leads/:id/conversations
POST   /api/campaigns
GET    /api/campaigns
POST   /api/campaigns/:id/start|pause|cancel
GET    /api/leads/:id  (detalhes com histórico)

SECUNDÁRIAS:
GET    /api/campaigns/numbers
PATCH  /api/campaigns/numbers/:id
GET    /api/templates
POST   /api/templates
PUT    /api/templates/:id
WebSocket eventos (alertas, mensagens)

OPCIONAIS (Admin):
GET    /api/sellers
POST   /api/sellers
GET    /api/config
PUT    /api/config
```

---

## 🎨 UI/UX do Assistente

### **Layout Padrão (Card + Popup)**

```
┌─ CARD (Lado Direito) ─────────────┐
│ 🤖 Assistente IA          [−] [×]   │
├───────────────────────────────────┤
│ Olá! Como posso ajudar?           │
│                                   │
│ [Input de chat]             [→]   │
└───────────────────────────────────┘

        ↓ [Ao enviar]

┌─ POPUP FLUTUANTE ────────────────┐
│ Assistente    [−] [□] [×]         │
├──────────────────────────────────┤
│ Você: "Como aumentar conversões?"│
│                                  │
│ IA: [Resposta conversacional]    │
│                                  │
│ [Ferramenta 1] [Ferramenta 2]   │
│ [Ferramenta 3] [Mais opções]    │
├──────────────────────────────────┤
│ [Input para follow-up]     [→]   │
└──────────────────────────────────┘
```

---

## 💾 Persistência & Cache

Para melhor UX, o assistente deve:
- Cachear lista de leads (atualizar a cada 5 min)
- Cachear funil (atualizar a cada 1 min)
- Cachear templates (atualizar quando modificar)
- Cachear números (atualizar quando status mudar)
- Histórico de conversas (últimas 50 no localStorage)

---

## 🔐 Segurança

- Validar JWT em cada requisição
- Verificar permissão de vendedor (seller_id)
- Não expor dados de outros vendedores
- Auditar ações sensíveis (criar lead, disparar, etc.)
- Rate limit no chat (máx 10 mensagens/min)

---

## ✅ Conclusão

O **Assistente IA para Operador** deve ter **4 ferramentas críticas + 4 secundárias** para ser viável. As opcionais adicionam polish, mas não são MVP.

**Ordem de implementação:**
1. **Carteira de Clientes** (fundação)
2. **Funil de Vendas** (análise)
3. **Disparo Comercial** (ação)
4. **Meu WhatsApp** (comunicação)
5. Anti-Ban, Templates, Alertas, Insights
6. Automações, Relatórios, Admin tools

Cada ferramenta deve ser modular, testável independentemente e integrada via REST + WebSocket ao painel existente.
