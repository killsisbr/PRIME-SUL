# 🚀 ROADMAP: Fases com Checkpoints, Commits e Publicação

## 📋 Visão Geral

Sistema iterativo de desenvolvimento com **commits de checkpoint** a cada fase concluída, permitindo track de progresso, revert se necessário e publicação de versões.

---

## 🏗️ Estrutura de Fases

```
FASE 1 (Semanas 1-2) — MVP Base
├─ Checkpoint 1.1: Auth + DB ✅ Commit
├─ Checkpoint 1.2: Carteira Clientes ✅ Commit
├─ Checkpoint 1.3: Funil Vendas ✅ Commit
├─ Checkpoint 1.4: Disparo Comercial ✅ Commit
└─ 🎯 VERSÃO 0.1.0 BETA (Publicar)

FASE 2 (Semanas 3-4) — Ferramentas Secundárias
├─ Checkpoint 2.1: Meu WhatsApp ✅ Commit
├─ Checkpoint 2.2: Anti-Ban ✅ Commit
├─ Checkpoint 2.3: Templates ✅ Commit
├─ Checkpoint 2.4: Alertas ✅ Commit
└─ 🎯 VERSÃO 0.2.0 (Publicar)

FASE 3 (Semanas 5-6) — OAuth + Setup Gemini
├─ Checkpoint 3.1: OAuth Google ✅ Commit
├─ Checkpoint 3.2: Session Management ✅ Commit
├─ Checkpoint 3.3: UI Unlock ✅ Commit
├─ Checkpoint 3.4: Gemini Setup ✅ Commit
└─ 🎯 VERSÃO 0.3.0 (Publicar)

FASE 4 (Semanas 7-8) — Gemini Vision
├─ Checkpoint 4.1: Upload Imagens ✅ Commit
├─ Checkpoint 4.2: Análise Visual ✅ Commit
├─ Checkpoint 4.3: Geração (2 refs) ✅ Commit
├─ Checkpoint 4.4: Render Select ✅ Commit
└─ 🎯 VERSÃO 0.4.0 (Publicar)

FASE 5 (Semana 9) — Polish + Deploy
├─ Checkpoint 5.1: Performance ✅ Commit
├─ Checkpoint 5.2: Segurança ✅ Commit
├─ Checkpoint 5.3: Testes ✅ Commit
├─ Checkpoint 5.4: Deploy ✅ Commit
└─ 🎯 VERSÃO 1.0.0 RELEASE (Publicar)
```

---

## 📊 FASE 1: MVP Base (Semanas 1-2)

### **Objetivo**
Implementar as 4 ferramentas críticas do assistente com autenticação básica.

### **Deliverables**
- ✅ Sistema de autenticação (JWT)
- ✅ Database schema
- ✅ Ferramenta #1: Carteira Clientes
- ✅ Ferramenta #2: Funil Vendas
- ✅ Ferramenta #3: Disparo Comercial
- ✅ Ferramenta #4: Meu WhatsApp

---

## ✅ CHECKPOINT 1.1: Auth + Database

### **Tarefas**
```
├─ Middleware de JWT (auth.js)
├─ Routes: POST /api/auth/login, POST /api/auth/logout
├─ Database schema (sellers, leads, campaigns, sends)
├─ Service: auth-service.js
├─ Testes: auth.test.js
└─ Documentação: AUTH.md
```

### **Commits**
```bash
# Commit principal
git commit -m "feat(auth): JWT authentication + database schema

- Implementar middleware de autenticação JWT
- Database schema para sellers, leads, campaigns
- Endpoints: /api/auth/login, /api/auth/logout
- Service para gerenciar tokens
- Testes unitários"

# Commit secundário (se grande)
git commit -m "docs(auth): Add authentication documentation"
```

### **Checklist de Validação**
- [ ] Middleware autentica requests corretamente
- [ ] JWT tokens criados com expiração
- [ ] Database migrations rodam sem erro
- [ ] Tests passam (coverage > 80%)
- [ ] Documentação atualizada

### **Teste Manual**
```bash
# 1. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "vendor@test.com", "password": "senha"}'

# 2. Verificar token
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/leads

# 3. Verificar expiração
# Token deve expirar em 24h
```

### **Publicar Checkpoint**
```bash
git tag -a v1.1-auth -m "Checkpoint 1.1: Auth + Database"
git push origin v1.1-auth
```

---

## ✅ CHECKPOINT 1.2: Carteira Clientes (Ferramenta #1)

### **Tarefas**
```
├─ Service: carteira-service.js
│  ├─ listLeads (com filtros)
│  ├─ createLead
│  ├─ getLead
│  ├─ updateLead
│  └─ countsBySeller
├─ Routes: GET|POST /api/leads
├─ UI: card-carteira.html + carteira.css
├─ API Integration: POST /api/copilot/chat
├─ Testes: carteira.test.js
└─ Documentação: CARTEIRA.md
```

### **Commits**
```bash
git commit -m "feat(carteira): Implement lead management system

- Ferramenta #1: Carteira Clientes
- List/create/update leads com filtros avançados
- Endpoints: GET|POST /api/leads
- Service de leads com validação de duplicidade
- UI component com preview no chat"

git commit -m "feat(carteira): Add NLP intent for carteira

- Detectar intent: list_leads, search_lead, filter_leads
- Integrar com tool-executor
- Gerar respostas conversacionais"

git commit -m "test(carteira): Add unit tests for lead service"
```

### **Checklist de Validação**
- [ ] Listar leads funciona (com paginação)
- [ ] Criar lead valida duplicidade
- [ ] Filtros funcionam (status, prioridade, data)
- [ ] Score calculado automaticamente
- [ ] UI renderiza corretamente no popup
- [ ] Chat consegue executar ações

### **Teste Manual**
```
Operador: "Como estão meus leads?"
IA: "Você tem 50 leads no total..."
[Ver Carteira] [Disparar para Novos]
```

### **Publicar Checkpoint**
```bash
git tag -a v1.2-carteira -m "Checkpoint 1.2: Carteira Clientes"
git push origin v1.2-carteira
```

---

## ✅ CHECKPOINT 1.3: Funil Vendas (Ferramenta #2)

### **Tarefas**
```
├─ Service: funil-service.js
│  ├─ funnelBySeller
│  ├─ calculateConversion
│  ├─ detectBottleneck
│  └─ predictNextStage
├─ Routes: GET /api/leads/funnel
├─ UI: card-funil.html + funil.css + chart
├─ API Integration: POST /api/copilot/chat
├─ Testes: funil.test.js
└─ Documentação: FUNIL.md
```

### **Commits**
```bash
git commit -m "feat(funil): Implement sales funnel analysis

- Ferramenta #2: Funil de Vendas
- Calculate conversion rates entre estágios
- Detect gargalos automáticamente
- Endpoints: GET /api/leads/funnel
- Visualização com chart.js"

git commit -m "feat(funil): Add predictive analytics

- Prever próximo estágio com ML simples
- Comparar com histórico
- Sugerir ações baseadas em taxa"

git commit -m "test(funil): Add funil tests"
```

### **Checklist de Validação**
- [ ] Conversão entre estágios calculada
- [ ] Gargalo detectado corretamente
- [ ] Charts renderizam sem erro
- [ ] Previsões são acuradas (> 70%)
- [ ] Chat fornece sugestões relevantes

### **Publicar Checkpoint**
```bash
git tag -a v1.3-funil -m "Checkpoint 1.3: Funil de Vendas"
git push origin v1.3-funil
```

---

## ✅ CHECKPOINT 1.4: Disparo Comercial (Ferramenta #3)

### **Tarefas**
```
├─ Service: campaign-service.js
│  ├─ createCampaign
│  ├─ startCampaign
│  ├─ pauseCampaign
│  ├─ cancelCampaign
│  └─ getCampaignStats
├─ Service: send-queue-service.js
│  ├─ Queue de envios
│  ├─ Retry logic (5 tentativas)
│  └─ Rate limiting
├─ Routes: POST|GET /api/campaigns
├─ UI: card-disparo.html + disparo.css
├─ API Integration: POST /api/copilot/chat
├─ Testes: campaign.test.js
└─ Documentação: DISPARO.md
```

### **Commits**
```bash
git commit -m "feat(disparo): Implement campaign management

- Ferramenta #3: Disparo Comercial
- Create/start/pause/cancel campaigns
- Queue de envios com retry logic
- Endpoints: POST|GET /api/campaigns
- Rate limiting por número"

git commit -m "feat(disparo): Add campaign preview + validation

- Preview de mensagem com variáveis
- Validar público-alvo
- Calcular impacto estimado
- UI de seleção de público"

git commit -m "test(disparo): Add campaign tests"
```

### **Checklist de Validação**
- [ ] Criar campanha salva corretamente
- [ ] Fila de envios funciona
- [ ] Retry logic ativa após falha
- [ ] Rate limiting previne ban
- [ ] Preview renderiza variáveis
- [ ] Stats atualizam em tempo real

### **Publicar Checkpoint**
```bash
git tag -a v1.4-disparo -m "Checkpoint 1.4: Disparo Comercial"
git push origin v1.4-disparo
```

---

## 🎯 FASE 1: Publicar v0.1.0 BETA

Depois que todos os checkpoints 1.1-1.4 estão validados:

```bash
# Criar tag de release
git tag -a v0.1.0-beta -m "Release 0.1.0 BETA

MVP Assistant com 4 ferramentas críticas:
- Carteira de Clientes
- Funil de Vendas
- Disparo Comercial
- Meu WhatsApp

Features:
✅ JWT Authentication
✅ NLP Intent Detection (básico)
✅ 4 Ferramentas funcionais
✅ UI responsiva (Neo-Brutalista)
✅ WebSocket para real-time
✅ Database SQLite

Known Issues:
- OAuth não implementado
- Gemini Vision não disponível
- Rate limiting básico

Next: Ferramentas secundárias (v0.2.0)"

# Push tag
git push origin v0.1.0-beta

# Criar release no GitHub
gh release create v0.1.0-beta \
  --title "MVP Beta Release" \
  --notes "Primeiro MVP com 4 ferramentas críticas"
```

### **Release Notes Template**
```markdown
# 🎉 PRIME SUL Assistant v0.1.0 BETA

## ✨ Novo

### Assistente IA
- Chat conversacional integrado ao painel
- Card flutuante + Popup interativo
- NLP básico (intent detection)

### 4 Ferramentas Críticas
1. **Carteira de Clientes** - Ver/filtrar/gerenciar 50+ leads
2. **Funil de Vendas** - Análise de conversão + gargalos
3. **Disparo Comercial** - Criar campanhas em massa
4. **Meu WhatsApp** - Gerenciar números e chats

### Infraestrutura
- JWT Authentication
- WebSocket real-time
- Database SQLite
- Design System Neo-Brutalista

## 🐛 Known Issues
- [ ] OAuth não implementado (v0.3.0)
- [ ] Gemini Vision em development (v0.4.0)
- [ ] Performance em 1000+ leads (otimizar em v0.5.0)

## 📊 Estatísticas
- Features: 4
- Endpoints: 15+
- Tests Coverage: 80%+
- Performance: <500ms response time

## 🚀 Próximos Passos
- Phase 2: Ferramentas secundárias (v0.2.0)
- Phase 3: OAuth + Gemini Setup (v0.3.0)
- Phase 4: Gemini Vision (v0.4.0)
- Phase 5: Production Release (v1.0.0)

## 📝 Changelog
[Detalhes de cada commit]

## 🤝 Como Contribuir
[Instruções]
```

---

## 📊 FASE 2: Ferramentas Secundárias (Semanas 3-4)

### **Checkpoints**
- 2.1: Meu WhatsApp ✅ Commit + Tag
- 2.2: Anti-Ban ✅ Commit + Tag
- 2.3: Templates ✅ Commit + Tag
- 2.4: Alertas Real-time ✅ Commit + Tag
- **Publicar v0.2.0** 🎯

### **Commit Pattern**
```bash
git commit -m "feat(whatsapp): Implement Meu WhatsApp tool

- Ferramenta #4: Meu WhatsApp
- Ver conversas agrupadas por lead
- Notificações de mensagens não lidas
- Integração com lead details"
```

---

## 📊 FASE 3: OAuth + Gemini Setup (Semanas 5-6)

### **Checkpoints**
- 3.1: OAuth Google ✅ Commit + Tag
- 3.2: Session Management ✅ Commit + Tag
- 3.3: UI Unlock Gemini ✅ Commit + Tag
- 3.4: Gemini Setup ✅ Commit + Tag
- **Publicar v0.3.0** 🎯

### **Commit Pattern**
```bash
git commit -m "feat(oauth): Implement Google OAuth integration

- Google OAuth endpoints
- Token exchange + validation
- Session storage (ai_settings.json)
- UI unlock dialog

Related to: Ferramenta #8 (Gemini Vision)"
```

---

## 📊 FASE 4: Gemini Vision (Semanas 7-8)

### **Checkpoints**
- 4.1: Upload Imagens (Ctrl+V) ✅ Commit + Tag
- 4.2: Análise Visual ✅ Commit + Tag
- 4.3: Geração (2 referências) ✅ Commit + Tag
- 4.4: Render Select ✅ Commit + Tag
- **Publicar v0.4.0** 🎯

### **Commit Pattern**
```bash
git commit -m "feat(gemini): Implement image generation

- Ferramenta #9: IA Gemini Vision
- Suporta Ctrl+V para colar imagens
- Geração com 2 referências + estilo
- Render select com 6 opções
- Salva em users/{id}/images/

Related to: OAuth (v0.3.0)"
```

---

## 📊 FASE 5: Polish + Deploy (Semana 9)

### **Checkpoints**
- 5.1: Performance ✅ Commit + Tag
- 5.2: Segurança ✅ Commit + Tag
- 5.3: Testes ✅ Commit + Tag
- 5.4: Deploy ✅ Commit + Tag
- **Publicar v1.0.0 RELEASE** 🎯

### **Commit Pattern**
```bash
git commit -m "perf: Optimize assistant performance

- Cache de leads (TTL 5min)
- Lazy load de imagens
- Compress assets
- Minify CSS/JS

Closes: #123 Performance Issue"

git commit -m "fix(security): Apply security hardening

- Validate all inputs
- Rate limiting (10 req/min)
- CORS headers
- SQL injection prevention"

git commit -m "test: Increase test coverage to 90%+

- Add integration tests
- Add e2e tests for all tools
- Benchmark performance"

git commit -m "chore: Prepare for production release

- Update dependencies
- Production env vars
- Error tracking setup
- Monitoring + alerts"
```

---

## 🎯 Release v1.0.0

```bash
git tag -a v1.0.0 -m "Release 1.0.0 - Production Ready

🎉 PRIME SUL Assistant - Versão 1.0.0

Complete Implementation:
✅ 9 Ferramentas funcionais
✅ OAuth Google integration
✅ Gemini Vision (análise + geração)
✅ Performance otimizado
✅ Segurança hardened
✅ 90%+ test coverage
✅ Documentação completa

Features:
1. Carteira de Clientes
2. Funil de Vendas
3. Disparo Comercial
4. Meu WhatsApp
5. Anti-Ban
6. Templates
7. Alertas Real-time
8. IA Análise Visual
9. IA Geração Imagens

Performance:
- Response time: <200ms (median)
- Uptime: 99.9%
- Test coverage: 92%

Security:
- JWT + OAuth
- CORS + Rate Limiting
- Input validation
- SQL injection prevention

Ready for production deployment!

Next: v1.1.0 com novos features"

git push origin v1.0.0
gh release create v1.0.0 --title "Production Release" ...
```

---

## 📈 Tracking de Progresso

### **Matriz de Status**

```markdown
| Fase | Checkpoint | Status | Commit | Tag | Version |
|------|-----------|--------|--------|-----|---------|
| 1.1 | Auth + DB | ✅ Done | abc123 | v1.1-auth | - |
| 1.2 | Carteira | ✅ Done | def456 | v1.2-carteira | - |
| 1.3 | Funil | ✅ Done | ghi789 | v1.3-funil | - |
| 1.4 | Disparo | ✅ Done | jkl012 | v1.4-disparo | - |
| - | RELEASE | ✅ Done | - | v0.1.0-beta | 0.1.0-beta |
| 2.1 | WhatsApp | 🔄 In Progress | - | - | - |
| 2.2 | Anti-Ban | ⏳ Pending | - | - | - |
| 2.3 | Templates | ⏳ Pending | - | - | - |
| 2.4 | Alertas | ⏳ Pending | - | - | - |
```

---

## 🔄 Processo de Commit por Checkpoint

### **Template: Commit Message**

```
<type>(<scope>): <subject>

<body>

<footer>

---

Exemplos:

feat(carteira): Implement lead listing

Adiciona funcionalidade de listar leads com filtros avançados.
- Pagination (20 leads por página)
- Filtros: status, prioridade, data, busca
- Sorting: name, created_at, score
- API endpoint: GET /api/leads?status=novo&page=1

Closes: #45
Related to: Checkpoint 1.2

---

fix(auth): Prevent JWT token expiration bypass

Valida expiração do token em cada request.
- Adiciona verificação de timestamp
- Revoke token se expirado
- Refresh token endpoint

Closes: #67

---

test(funil): Add conversion rate calculation tests

- Test basic conversion 100 → 50 → 25
- Test edge case: zero leads
- Test performance: 10000 leads

Coverage: 85% → 92%

---

docs(api): Add API documentation

- OpenAPI spec para todos endpoints
- Examples de request/response
- Error codes

Related to: v0.1.0 release
```

---

## 📦 Git Workflow

### **Branch Strategy**

```bash
# Main branches
main/               # Production releases (tags v1.0.0, v1.1.0)
develop/            # Development (tags v0.1.0-beta, v0.2.0)

# Feature branches
feature/carteira-clientes      # Checkpoint 1.2
feature/funil-vendas           # Checkpoint 1.3
feature/disparo-comercial      # Checkpoint 1.4
feature/oauth-google           # Checkpoint 3.1
feature/gemini-vision          # Checkpoint 4.1

# Workflow
1. git checkout -b feature/carteira-clientes develop
2. [Desenvolve checkpoint 1.2]
3. git commit -m "feat(carteira): ..."
4. git push origin feature/carteira-clientes
5. [Pull request + review]
6. git merge --squash feature/carteira-clientes develop
7. git tag v1.2-carteira
8. git push origin v1.2-carteira
```

---

## 📋 Checklist de Release

### **Antes de cada Checkpoint**

```markdown
## Checkpoint X.Y: [Nome da Ferramenta]

### Code Quality
- [ ] Todos testes passam (`npm test`)
- [ ] Coverage > 80%
- [ ] Sem lint errors (`npm run lint`)
- [ ] Código revisado (peer review)

### Documentation
- [ ] README atualizado
- [ ] API doc atualizado
- [ ] CHANGELOG atualizado
- [ ] Code comments adicionados

### Testing
- [ ] Unit tests (80%+ coverage)
- [ ] Integration tests
- [ ] Manual testing completado
- [ ] Performance tested

### Security
- [ ] Sem vulnerabilidades conhecidas (`npm audit`)
- [ ] Input validation
- [ ] SQL injection tests
- [ ] CORS headers

### Deployment
- [ ] Database migrations tested
- [ ] Env variables configuradas
- [ ] Rollback plan documentado
- [ ] Monitoring ativo

### Sign-off
- [ ] QA aprovado
- [ ] PM aprovado
- [ ] Tech Lead aprovado

**Approved by:**
- [ ] Developer: ______ Date: ______
- [ ] Reviewer: ______ Date: ______
- [ ] QA: ______ Date: ______
```

---

## 🚀 Como Publicar Checkpoint

### **Processo Completo**

```bash
# 1. Finalizar desenvolvimento
git add .
git commit -m "feat(carteira): Complete checkpoint 1.2

- Todas features implementadas
- Testes passam
- Documentation completa"

# 2. Criar tag de checkpoint
git tag -a v1.2-carteira -m "Checkpoint 1.2: Carteira Clientes

Features:
✅ List leads com filtros
✅ Create lead
✅ Update status
✅ Scoring automático

Tests: 85%+ coverage
Performance: <200ms"

# 3. Push
git push origin v1.2-carteira

# 4. Criar milestone no GitHub (opcional)
gh issue create --title "Checkpoint 1.2 Complete" \
  --label checkpoint \
  --assignee @me

# 5. Notificar time
# Slack message: "✅ Checkpoint 1.2 published: v1.2-carteira"
```

---

## 📊 Dashboard de Progresso

```
FASE 1: MVP Base (2 semanas)
█████████████████████ 100% ✅ v0.1.0-beta

FASE 2: Secundárias (2 semanas)
████████░░░░░░░░░░░░  40% 🔄

FASE 3: OAuth + Gemini Setup (2 semanas)
░░░░░░░░░░░░░░░░░░░░   0% ⏳

FASE 4: Gemini Vision (2 semanas)
░░░░░░░░░░░░░░░░░░░░   0% ⏳

FASE 5: Polish + Deploy (1 semana)
░░░░░░░░░░░░░░░░░░░░   0% ⏳

TOTAL: 40% (Dia 14 de 63)
```

---

## 📞 Checkpoints Checklist

```markdown
### FASE 1
- [x] 1.1: Auth + Database → v1.1-auth
- [x] 1.2: Carteira → v1.2-carteira  
- [x] 1.3: Funil → v1.3-funil
- [x] 1.4: Disparo → v1.4-disparo
- [x] RELEASE v0.1.0-beta

### FASE 2
- [ ] 2.1: WhatsApp → v2.1-whatsapp
- [ ] 2.2: Anti-Ban → v2.2-antiban
- [ ] 2.3: Templates → v2.3-templates
- [ ] 2.4: Alertas → v2.4-alertas
- [ ] RELEASE v0.2.0

### FASE 3
- [ ] 3.1: OAuth → v3.1-oauth
- [ ] 3.2: Session Mgmt → v3.2-session
- [ ] 3.3: UI Unlock → v3.3-ui-unlock
- [ ] 3.4: Gemini Setup → v3.4-gemini-setup
- [ ] RELEASE v0.3.0

### FASE 4
- [ ] 4.1: Upload → v4.1-upload
- [ ] 4.2: Analysis → v4.2-analysis
- [ ] 4.3: Generation → v4.3-generation
- [ ] 4.4: Render Select → v4.4-render
- [ ] RELEASE v0.4.0

### FASE 5
- [ ] 5.1: Perf → v5.1-perf
- [ ] 5.2: Security → v5.2-security
- [ ] 5.3: Tests → v5.3-tests
- [ ] 5.4: Deploy → v5.4-deploy
- [ ] RELEASE v1.0.0
```

---

## ✨ Conclusão

Este roadmap permite:

✅ **Tracking de progresso** por checkpoint  
✅ **Commits atômicos** para cada feature  
✅ **Tags para cada milestone**  
✅ **Releases versionadas** (0.1.0, 0.2.0, etc)  
✅ **Rollback fácil** se necessário  
✅ **Documentação automática** via commits  
✅ **Notificações de progresso** ao time  
✅ **Production-ready** ao final  

**Vamos começar? 🚀**
