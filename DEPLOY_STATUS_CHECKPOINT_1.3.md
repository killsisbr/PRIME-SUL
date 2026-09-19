# 📊 Deploy Status — Checkpoint 1.3

## ❌ VPS OFFLINE (82.29.58.126)

A VPS está com timeout em todas as tentativas de SSH:
- ⏱️ Timeout 120s no PowerShell
- ⏱️ Timeout 120s com `ssh` nativo
- ⏱️ Timeout na conexão TCP

**Status:** VPS pode estar offline ou firewall bloqueando porta 22

---

## ✅ O QUE ESTÁ PRONTO PARA DEPLOY

### Checkpoint 1.3: Funil de Vendas (COMPLETO)

**Arquivos criados:**
- ✅ `server/services/funil-service.js` (420 linhas)
- ✅ `server/routes/funil.js` (188 linhas)
- ✅ `public/js/funil-card.js` (400+ linhas)
- ✅ `public/css/funil.css` (450+ linhas)
- ✅ `tests/funil.test.js` (335 linhas)
- ✅ `docs/API_FUNIL.md` (275 linhas)

**Commits publicados:**
```
ae4b91a docs(funil): Add API documentation
3ef983b test(funil): Add comprehensive funil tests
bc12448 feat(funil): Implement frontend UI with Chart.js
14a3ae0 feat(funil): Add funil HTTP routes
3295c7c feat(funil): Implement FunnelService with analytics
```

**Branch:** `staging` (remoto: GitHub)

---

## 🚀 COMO FAZER DEPLOY QUANDO VPS RESPONDER

### Opção 1: Usar script automático (recomendado)

```bash
cd D:\PRIME SUL
node scripts/deploy-now.mjs
```

**Pré-requisitos:**
- Ter `sshpass` instalado: `choco install sshpass`
- `.env` com `VPS_PASSWORD` configurada

### Opção 2: SSH manual

```bash
ssh root@82.29.58.126
cd /root/killsis/PRIME-SUL
git fetch origin
git checkout staging
git pull --ff-only origin staging
npm install --production
pm2 restart prime-sul || pm2 start server/server.js --name prime-sul
pm2 status
```

### Opção 3: Deploy seguro com SSH key

```bash
node scripts/deploy-secure.mjs staging
```

**Pré-requisitos:**
- SSH key gerada: `ssh-keygen -t ed25519 -f ~/.ssh/prime-sul-deploy`
- Pública adicionada ao VPS: `~/.ssh/authorized_keys`

---

## 📋 PRÓXIMOS PASSOS

1. **Verificar VPS:**
   - Acessar painel de controle da VPS
   - Verificar se está ligada
   - Verificar firewall (porta 22)
   - Reiniciar se necessário

2. **Quando VPS responder:**
   - Executar script de deploy
   - Validar endpoints em: `https://82.29.58.126/api/funnel`
   - Verificar logs: `pm2 logs prime-sul`

3. **Começar Checkpoint 1.4:**
   - Disparo Comercial (Marketing elaborado)
   - ~2-3 horas de implementação
   - Antes de fazer release v0.1.0-beta

---

## 📝 CONFIGURAÇÃO NECESSÁRIA

### .env (local)

```env
# VPS
VPS_HOST=82.29.58.126
VPS_USER=root
VPS_PORT=22
VPS_PASSWORD=Killsis19980910#
VPS_APP_DIR=/root/killsis/PRIME-SUL
VPS_PM2_APP=prime-sul

# Database
DATABASE_URL=./data/prime-sul.db

# JWT
JWT_SECRET=seu_secret_aqui
JWT_EXPIRY=24h

# Slack (opcional)
SLACK_WEBHOOK=sua_url
```

---

## 🔧 TROUBLESHOOTING

### SSH Connection Refused
```bash
# Verificar se SSH está rodando
ssh root@82.29.58.126 "systemctl status sshd"

# Se não estiver:
ssh root@82.29.58.126 "systemctl start sshd"
```

### Git pull falhou
```bash
# Verificar branch local no VPS
ssh root@82.29.58.126 "cd /root/killsis/PRIME-SUL && git status"

# Forçar para staging (se houver conflito)
ssh root@82.29.58.126 "cd /root/killsis/PRIME-SUL && git checkout staging && git reset --hard origin/staging"
```

### PM2 não reinicia
```bash
# Verificar PM2 status
ssh root@82.29.58.126 "pm2 status"

# Deletar app e reiniciar
ssh root@82.29.58.126 "pm2 delete prime-sul && pm2 start /root/killsis/PRIME-SUL/server/server.js --name prime-sul"

# Salvar configuração
ssh root@82.29.58.126 "pm2 save"
```

### Verificar porta 5000
```bash
ssh root@82.29.58.126 "curl localhost:5000"
```

---

## 📊 PROGRESSO FASE 1

| Checkpoint | Status | Commits | Linhas | Deploy |
|-----------|--------|---------|--------|--------|
| 1.1 Auth | ✅ Pronto | 4 | 500+ | ❓ VPS Offline |
| 1.2 Carteira | ✅ Pronto | 6 | 2500+ | ❓ VPS Offline |
| 1.3 Funil | ✅ Pronto | 5 | 2400+ | ❓ VPS Offline |
| 1.4 Disparo | ⏳ Próximo | — | — | — |

**Fase 1 Pronto para Deploy:** 75% (3 de 4)

---

## 🎯 PRÓXIMO CHECKPOINT

**Checkpoint 1.4: Disparo Comercial** (Ferramenta #3)

Incluirá:
- Campaign builder
- Preview de mensagem
- Scheduler (date/time)
- Status tracking (sent/delivered/read)
- Queue com retry logic
- Rate limiting anti-ban
- Marketing elaborado (SAAS-WEB concept)

Tempo estimado: 2-3 horas

---

## 📞 SUPORTE

Se VPS continuar offline:
1. Verificar painel do host (status da máquina)
2. Reiniciar VPS pelo painel
3. Verificar credenciais SSH
4. Contatar suporte do host
