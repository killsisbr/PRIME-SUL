# 🔒 Setup Seguro de Deploy

**Objetivos:**
- ✅ Remover credenciais hardcoded
- ✅ Setup SSH key authentication
- ✅ Usar novo script seguro
- ✅ Adicionar GitHub secrets

**Tempo estimado:** 15 minutos

---

## 🚨 PASSO 1: Mudar Senha VPS (URGENTE)

```bash
# Conectar ao VPS
ssh root@82.29.58.126

# Alterar senha
passwd
# Digitar nova senha FORTE (min 16 caracteres, especial chars)
# Confirmar

# Copiar nova senha para local seguro (1Password, Bitwarden, etc)
```

---

## 🔑 PASSO 2: Gerar SSH Key (Local)

```bash
# Gerar chave ED25519 (mais seguro)
ssh-keygen -t ed25519 -f ~/.ssh/prime-sul-deploy -C "prime-sul@local"

# Saída esperada:
# Generating public/private ed25519 key pair.
# Enter passphrase (empty for no passphrase): [deixar vazio]
# Your identification has been saved in /root/.ssh/prime-sul-deploy
# Your public key has been saved in /root/.ssh/prime-sul-deploy.pub

# Copiar chave pública para VPS
ssh-copy-id -i ~/.ssh/prime-sul-deploy root@82.29.58.126

# Testes de conexão
ssh -i ~/.ssh/prime-sul-deploy root@82.29.58.126 'echo "✅ SSH Key Auth OK"'
```

**Esperado:**
```
✅ SSH Key Auth OK
```

---

## 📋 PASSO 3: Remover Credenciais do Git

### 3a. Remover arquivo comprometido

```bash
# VER HISTÓRICO
git log --oneline | head -10
# Procurar commits de deploy.js

# REMOVER do histórico (rebase/filter)
git filter-branch -f --index-filter \
  'git rm --cached --ignore-unmatch deploy.js' \
  -- --all

# REMOVER do working directory
rm deploy.js

# COMMIT
git add .
git commit -m "security: Remove hardcoded credentials from deploy.js"
```

### 3b. Adicionar .gitignore

```bash
# Criar/atualizar .gitignore
cat >> .gitignore << 'EOF'

# Deploy & SSH
deploy.js
.ssh/
*.pem
*.key

# Environment
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*

# Node
node_modules/
package-lock.json

# PM2
ecosystem.config.js

# IDE
.vscode/
.idea/
*.swp
EOF

git add .gitignore
git commit -m "chore: Add comprehensive .gitignore"
```

### 3c. PUSH

```bash
git push origin staging --force-with-lease
git push origin main --force-with-lease
```

⚠️ **Atenção:** `--force-with-lease` reescreve histórico. Avisar o time se houver outros desenvolvedores.

---

## 📝 PASSO 4: Configurar Variáveis de Ambiente

### 4a. Criar .env local

```bash
# Copiar template
cp .env.example .env

# Editar .env
nano .env

# Adicionar:
VPS_HOST=82.29.58.126
VPS_USER=root
VPS_PORT=22
VPS_KEY_PATH=~/.ssh/prime-sul-deploy
VPS_APP_DIR=/root/killsis/PRIME-SUL
VPS_PM2_APP=prime-sul
SLACK_WEBHOOK=https://hooks.slack.com/services/...  (opcional)
```

### 4b. Verificar permissões

```bash
# SSH key deve ter permissões 600
ls -la ~/.ssh/prime-sul-deploy
# Esperado: -rw------- (600)

chmod 600 ~/.ssh/prime-sul-deploy
chmod 600 ~/.ssh/prime-sul-deploy.pub
```

---

## 🚀 PASSO 5: Testar Novo Script Seguro

```bash
# Instalar dependência (se necessário)
npm install dotenv

# Testar conexão
node scripts/deploy-secure.mjs staging

# Esperado:
# ╔════════════════════════════════════════╗
# ║   PRIME SUL — Secure Deploy (v2)     ║
# ╚════════════════════════════════════════╝
# 
# ✅ VPS Host: 82.29.58.126
# ✅ SSH Key: /root/.ssh/prime-sul-deploy
# ✅ Branch: staging
```

---

## 🐙 PASSO 6: Setup GitHub Secrets (Para CI/CD)

### 6a. Criar arquivo de secrets

```bash
# Gerar nova chave para GitHub (sem passphrase)
ssh-keygen -t ed25519 -f ~/.ssh/prime-sul-github -C "prime-sul-github" -N ""
```

### 6b. Adicionar no GitHub

1. Abrir: https://github.com/killsisbr/PRIME-SUL/settings/secrets/actions
2. Clicar "New repository secret"
3. Adicionar secrets:

```
Name: VPS_HOST
Value: 82.29.58.126

Name: VPS_USER
Value: root

Name: DEPLOY_KEY
Value: [conteúdo de ~/.ssh/prime-sul-github, a chave PRIVADA]
```

### 6c. Copiar chave pública para VPS

```bash
# Copiar chave pública para ~/.ssh/authorized_keys no VPS
ssh root@82.29.58.126
echo "$(cat ~/.ssh/prime-sul-github.pub)" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit
```

---

## ✅ PASSO 7: Verificação de Segurança

```bash
# 1. Verificar Git não tem credenciais
git log -p | grep -i "password\|Killsis19980910"
# Esperado: (nada encontrado)

# 2. Verificar .gitignore está correto
cat .gitignore | grep -E "\.env|\.ssh|\.key|deploy\.js"
# Esperado: múltiplas linhas

# 3. Verificar SSH key funciona
ssh -i ~/.ssh/prime-sul-deploy root@82.29.58.126 'pm2 status'
# Esperado: status do PM2

# 4. Verificar novo script deploy-secure.mjs existe
ls -la scripts/deploy-secure.mjs
# Esperado: arquivo existe
```

---

## 🎯 PASSO 8: Usar Novo Script

### Staging

```bash
# Desenvolver
nano public/admin.html

# Deploy automático
node scripts/deploy-secure.mjs staging

# Esperado:
# ✅ Validating prerequisites...
# ✅ Checking git status...
# 🧪 Running tests...
# 🚀 Deploying to STAGING...
# ✅ Deploy completed successfully!
```

### Production (com confirmação)

```bash
node scripts/deploy-secure.mjs production

# Esperado:
# ⚠️  Deploy to PRODUCTION? Type "yes" to confirm: yes
# 🚀 Deploying to PRODUCTION...
# ✅ Deploy completed successfully!
```

---

## 📊 Checklist Final

- [ ] Senha VPS alterada
- [ ] SSH key gerada (`~/.ssh/prime-sul-deploy`)
- [ ] SSH key copiada para VPS
- [ ] `deploy.js` removido do Git
- [ ] `.gitignore` atualizado
- [ ] `.env` criado (não em Git)
- [ ] `scripts/deploy-secure.mjs` testado
- [ ] GitHub secrets configurados (opcional para CI/CD)
- [ ] Novo deploy funciona em staging
- [ ] Git history limpo (sem credenciais)

---

## 🔐 Boas Práticas

✅ **Sempre fazer:**
- Usar SSH keys (nunca password)
- Guardar chaves privadas em `~/.ssh` (permissões 600)
- Usar `.env` para credentials (não em Git)
- Rodar testes antes de deploy
- Usar variáveis de ambiente para configuração

❌ **Nunca fazer:**
- Hardcoding passwords em código
- Commitar `.env` ou chaves privadas
- Reutilizar chaves entre ambientes
- Usar mesmo SSH key para múltiplos servidores
- Deixar passphrases em chaves

---

## 🆘 Troubleshooting

### "SSH key permission denied"

```bash
# Verificar permissões
ls -la ~/.ssh/prime-sul-deploy
# Deve ser: -rw------- (600)

# Corrigir
chmod 600 ~/.ssh/prime-sul-deploy
chmod 700 ~/.ssh
```

### "git filter-branch: bad revision"

```bash
# Se houver apenas um commit
git filter-branch -f --index-filter \
  'git rm --cached --ignore-unmatch deploy.js' HEAD

# Se houver múltiplos
git filter-branch -f --index-filter \
  'git rm --cached --ignore-unmatch deploy.js' -- --all
```

### "PM2 app not found"

```bash
# Conectar ao VPS
ssh -i ~/.ssh/prime-sul-deploy root@82.29.58.126

# Iniciar manualmente
cd /root/killsis/PRIME-SUL
pm2 start server/server.js --name prime-sul
pm2 save
```

---

## 📞 Support

Perguntas? Abrir issue no GitHub.

---

**Quando completado:**
- ✅ Deploy é seguro
- ✅ Sem credenciais em código
- ✅ Autenticação por SSH key
- ✅ Pronto para CI/CD

**Próximo passo:** Configurar GitHub Actions para deploy automático.
