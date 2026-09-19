# 🔒 Próximas Ações de Segurança

**Status Atual:** ✅ Código corrigido  
**Próximo:** Você vai mudar a senha VPS depois  

---

## ✅ O QUE JÁ FOI FEITO

### Commits Realizados (3)

```
1. security: Remove deploy.js with hardcoded credentials
   ❌ Removido arquivo com senha hardcoded
   
2. feat(deploy): Add secure deployment script (SSH key auth)
   ✅ Novo script seguro criado
   
3. docs(security): Add deployment security analysis and setup guide
   ✅ Documentação de segurança criada
```

### Arquivos Criados

- ✅ `scripts/deploy-secure.mjs` (novo script seguro)
- ✅ `ANALISE_DEPLOY_SCRIPTS.md` (análise completa)
- ✅ `SETUP_SECURE_DEPLOY.md` (guia passo-a-passo)
- ✅ `RESUMO_ANALISE_DEPLOY.md` (sumário)
- ✅ `.env.example` (template seguro)

### Arquivos Removidos

- ❌ `deploy.js` (senha hardcoded)

---

## ⏳ O QUE FAZER DEPOIS (Quando mudar a senha)

### Passo 1: Mudar Senha VPS (Você faz)

```bash
# Conectar ao VPS
ssh root@82.29.58.126

# Mudar senha
passwd
# Digite nova senha FORTE

# Copiar nova senha para 1Password / Bitwarden / Vault
```

**⏰ Tempo:** 5 minutos

---

### Passo 2: Gerar SSH Key (Execute depois)

```bash
# Gerar chave ED25519
ssh-keygen -t ed25519 -f ~/.ssh/prime-sul-deploy -C "prime-sul@local"

# Saída esperada:
# Generating public/private ed25519 key pair.
# Enter passphrase (empty for no passphrase): [ENTER]
# Your identification has been saved in ~/.ssh/prime-sul-deploy
```

**⏰ Tempo:** 2 minutos

---

### Passo 3: Copiar Chave Pública para VPS

```bash
# Copiar chave pública
ssh-copy-id -i ~/.ssh/prime-sul-deploy root@82.29.58.126

# Saída esperada:
# Number of key(s) added: 1

# Testar conexão
ssh -i ~/.ssh/prime-sul-deploy root@82.29.58.126 'echo "✅ SSH OK"'
```

**⏰ Tempo:** 3 minutos

---

### Passo 4: Criar .env (Local)

```bash
# Copiar template
cp .env.example .env

# Editar (nano, vim, VS Code, etc)
nano .env

# Adicionar valores:
VPS_HOST=82.29.58.126
VPS_USER=root
VPS_PORT=22
VPS_KEY_PATH=~/.ssh/prime-sul-deploy
VPS_APP_DIR=/root/killsis/PRIME-SUL
VPS_PM2_APP=prime-sul
```

**⏰ Tempo:** 2 minutos

**⚠️ IMPORTANTE:** `.env` já está em `.gitignore` (não vai para Git)

---

### Passo 5: Testar Novo Script

```bash
# Installar dependência (se necessário)
npm install dotenv

# Testar em staging
node scripts/deploy-secure.mjs staging

# Esperado:
# ╔════════════════════════════════════════╗
# ║   PRIME SUL — Secure Deploy (v2)     ║
# ╚════════════════════════════════════════╝
# 
# ✅ VPS Host: 82.29.58.126
# ✅ SSH Key: /home/user/.ssh/prime-sul-deploy
# ✅ Branch: staging
# ...
```

**⏰ Tempo:** 5 minutos

---

### Passo 6: Remove Old Scripts (Opcional)

Se quiser limpar ainda mais:

```bash
# Removidos em segurança:
# ❌ deploy.js (já removido)
# ⚠️  scripts/git-deploy.mjs (tem fallback com password)
# ⚠️  scripts/commit-and-deploy.mjs (chama git-deploy.mjs)
# ⚠️  scripts/deploy-status.mjs (tem fallback com password)

# Se quiser remover também:
git rm scripts/git-deploy.mjs
git rm scripts/commit-and-deploy.mjs
git rm scripts/deploy-status.mjs

git commit -m "chore: Remove old insecure deploy scripts

Old scripts had hardcoded fallback credentials.
Use scripts/deploy-secure.mjs instead.

Old scripts removed:
- scripts/git-deploy.mjs
- scripts/commit-and-deploy.mjs
- scripts/deploy-status.mjs"
```

**⏰ Tempo:** 5 minutos  
**Risco:** Baixo (você ainda tem deploy-secure.mjs)

---

## 📋 Checklist para Depois

### Quando mudar a senha VPS:

- [ ] Mudar senha no VPS
- [ ] Gerar SSH key (`ssh-keygen`)
- [ ] Copiar chave para VPS (`ssh-copy-id`)
- [ ] Testar SSH (`ssh -i ~/.ssh/prime-sul-deploy ...`)
- [ ] Criar `.env` local (copiar de `.env.example`)
- [ ] Testar novo script (`node scripts/deploy-secure.mjs staging`)
- [ ] Opcionalmente: remover scripts antigos

---

## 📊 Status de Segurança

### Agora (✅ Feito)

```
Código:
✅ Senha removida de deploy.js
✅ IP não mais hardcoded em scripts
✅ Novo script seguro disponível
✅ Documentação completa
✅ .gitignore atualizado
```

### Depois (⏳ Quando mudar senha)

```
Infraestrutura:
⏳ Senha VPS alterada
⏳ SSH key gerada
⏳ SSH key copiada para VPS
⏳ .env criado (local)
⏳ Novo script testado
```

### Futuro (🔮 Próximo mês)

```
CI/CD:
🔮 GitHub Actions setup
🔮 Deploy automático
🔮 Slack notifications
```

---

## 🚀 Deployment Agora

### Até Mudar a Senha: NÃO USAR DEPLOY

```bash
# ❌ NÃO FUNCIONA AINDA (SSH key não configurada)
node scripts/deploy-secure.mjs staging
```

### Quando Configurar SSH Key: USAR NOVO SCRIPT

```bash
# ✅ FUNCIONA DEPOIS (SSH key configurada)
node scripts/deploy-secure.mjs staging
```

---

## 📞 Se Precisar Deploy URGENTE Agora

Se precisar fazer deploy URGENTE antes de mudar a senha:

```bash
# SSH manual direto
ssh root@82.29.58.126 'cd /root/killsis/PRIME-SUL && git pull origin staging && npm install && pm2 restart prime-sul'
```

**⚠️ Usar com cuidado!** Depois mude a senha e configure SSH key.

---

## ✨ Resumo

| O que | Status | Quando |
|------|--------|--------|
| **Remover credenciais** | ✅ FEITO | Agora |
| **Novo script** | ✅ PRONTO | Agora |
| **Documentação** | ✅ PRONTO | Agora |
| **Mudar senha** | ⏳ TODO | Você |
| **SSH key** | ⏳ TODO | Depois |
| **Testar** | ⏳ TODO | Depois |
| **Usar** | ⏳ TODO | Depois |

---

## 📌 Notas Importantes

### Git History

A senha **foi removida do código**, mas pode estar no Git history local se você já tinha feito commit.

**Se quer limpar completamente o histórico:**

```bash
# Depois de mudar a senha no VPS, execute:
git filter-branch -f --index-filter \
  'git rm --cached --ignore-unmatch deploy.js' \
  -- --all
```

Mas não é obrigatório (arquivo já foi deletado).

### Próximas Melhorias

Depois que tudo estiver funcionando:

1. GitHub Actions para deploy automático
2. Slack notifications em cada deploy
3. Rollback automático se falhar
4. Performance monitoring

---

## 🎯 Próximo Checkpoint

Depois de configurar:

```bash
# Testar
node scripts/deploy-secure.mjs staging

# Ver logs
ssh -i ~/.ssh/prime-sul-deploy root@82.29.58.126 'pm2 logs prime-sul'

# Status
ssh -i ~/.ssh/prime-sul-deploy root@82.29.58.126 'pm2 status'
```

---

**Tudo pronto!** Quando você mudar a senha e seguir estes passos, deploy estará 100% seguro. 🔒

Qualquer dúvida, consulte `SETUP_SECURE_DEPLOY.md`.
