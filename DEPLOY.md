# 🚀 PRIME SUL — Guia de Deploy

Múltiplas opções de deploy com diferentes níveis de automação.

---

## 📋 Scripts Disponíveis

### 1. **Commit + Push + Deploy (Recomendado)**
Faz tudo em um comando:
```bash
node scripts/commit-and-deploy.mjs "mensagem do commit" [staging|production]
```

**Exemplo:**
```bash
node scripts/commit-and-deploy.mjs "Adicionar cards de agenda" staging
node scripts/commit-and-deploy.mjs "Fix: corrigir bug de login" production
```

**O que faz:**
1. ✅ Verifica mudanças (`git status`)
2. ✅ Adiciona arquivos (`git add -A`)
3. ✅ Faz commit
4. ✅ Push para a branch
5. ✅ Deploy automático via SSH

---

### 2. **Deploy via Git (Sem Commit Local)**
Se já fez commit localmente e quer só fazer deploy:
```bash
node scripts/git-deploy.mjs [staging|production]
```

**O que faz:**
- Conecta ao VPS
- Faz `git pull` da branch
- Instala dependências
- Reinicia PM2

---

### 3. **Verificar Status do Deploy**
Ver logs, commits recentes e status do PM2:
```bash
node scripts/deploy-status.mjs
```

---

### 4. **PowerShell (Windows)**
Para usuários Windows que preferem PowerShell:
```powershell
.\dev-deploy.ps1
```

---

### 5. **Deploy Manual (Caminho Longo)**
```bash
git add -A
git commit -m "mensagem"
git push origin staging
node deploy.js
```

---

## 🎯 Fluxo Recomendado

### Para Desenvolvimento (Staging)
```bash
# Fazer mudanças no código
nano public/admin/components/disparo.js

# Deploy automático
node scripts/commit-and-deploy.mjs "Adicionar feature X" staging

# Testar em http://staging.prime-sul.com
```

### Para Produção
```bash
# Garantir que tudo está testado em staging primeiro

# Fazer deploy para production
node scripts/commit-and-deploy.mjs "Release: v1.0.5" production
```

---

## 🔧 Configuração

### Variáveis de Ambiente
Se não usar o `.env` do JARVIS, crie um `.env` local:

```env
VPS_HOST=82.29.58.126
VPS_USER=root
VPS_PASSWORD=sua_senha_aqui
```

---

## 📊 Monitoramento Pós-Deploy

Após fazer deploy, verifique:

```bash
# Ver status do PM2
node scripts/deploy-status.mjs

# Ou manualmente via SSH
ssh root@82.29.58.126 'pm2 status'

# Ver logs da aplicação
ssh root@82.29.58.126 'pm2 logs prime-sul'
```

---

## 🚨 Troubleshooting

### "git pull --ff-only" falhou
Significa que há conflitos não resolvidos:
```bash
git reset --hard origin/staging
git pull origin staging
```

### PM2 não reinicia
```bash
ssh root@82.29.58.126 'pm2 restart prime-sul'
```

### Mudanças não aparecem
```bash
# Verificar branch atual no VPS
ssh root@82.29.58.126 'cd /root/killsis/PRIME-SUL && git branch'

# Forçar atualização
ssh root@82.29.58.126 'cd /root/killsis/PRIME-SUL && git reset --hard origin/staging'
```

---

## 💡 Tips

- **Sempre teste em staging antes de production**
- **Mensagens de commit descritivas**: `"Fix: corrigir bug X"`, `"Feature: adicionar Y"`
- **Use `deploy-status.mjs` depois de cada deploy** para confirmar
- **Em caso de emergência**: `ssh root@82.29.58.126 'pm2 restart prime-sul'`

---

## 📝 Exemplo Completo

```bash
# 1. Desenvolver
echo "console.log('teste')" > test.js

# 2. Deploy automático
node scripts/commit-and-deploy.mjs "Add: teste" staging

# 3. Verificar
node scripts/deploy-status.mjs

# 4. Testar em produção
open http://staging.prime-sul.com
```

---

**Criado por Claude Code**
