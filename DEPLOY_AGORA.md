# 🚀 Deploy Agora (Temporário)

**Status:** ⏳ Você quer fazer deploy antes de mudar a senha/SSH key

---

## ⚠️ OPÇÕES

### Opção 1: Deploy com SSH Password (Rápido)

**Arquivo:** `scripts/deploy-now.mjs`

```bash
# 1. Adicionar password no .env
echo "VPS_PASSWORD=Killsis19980910#" >> .env

# 2. Instalar sshpass (se não tiver)
# macOS:
brew install sshpass

# Ubuntu/Debian:
sudo apt-get install sshpass

# Windows (usando WSL):
sudo apt-get install sshpass

# 3. Deploy
node scripts/deploy-now.mjs
```

**Esperado:**
```
✅ Deploy completed successfully!
```

### Opção 2: Deploy Manual SSH Direto (Sem Node)

```bash
# SSH direto
ssh root@82.29.58.126 'cd /root/killsis/PRIME-SUL && git pull origin staging && npm install && pm2 restart prime-sul'
```

**Será pedida senha interativamente.**

### Opção 3: Esperar Configurar SSH Key

**Arquivo:** `SETUP_SECURE_DEPLOY.md`

```bash
# Depois:
node scripts/deploy-secure.mjs staging
```

---

## 📊 Comparação

| Opção | Como | Seguro | Pronto |
|-------|------|--------|--------|
| 1: deploy-now.mjs | .env | ⚠️ Temporário | ✅ Agora |
| 2: SSH Manual | CLI | ⚠️ Temporário | ✅ Agora |
| 3: deploy-secure.mjs | SSH key | ✅ Seguro | ⏳ Depois |

---

## 🚀 Fazer Agora

### Se quer usar deploy-now.mjs:

**Passo 1: Adicionar senha no .env**

```bash
# Abrir .env
nano .env

# Adicionar no final:
VPS_PASSWORD=Killsis19980910#
```

**Passo 2: Instalar sshpass**

```bash
# macOS
brew install sshpass

# Ubuntu/Debian/WSL
sudo apt-get install sshpass

# Verificar
sshpass -V
```

**Passo 3: Deploy**

```bash
node scripts/deploy-now.mjs
```

**Esperado:**
```
╔════════════════════════════════════╗
║   PRIME SUL — Deploy Now          ║
╚════════════════════════════════════╝

📍 Host: 82.29.58.126
👤 User: root
📂 App Dir: /root/killsis/PRIME-SUL
⚙️  PM2 App: prime-sul

🚀 Deploying...

📂 Entering directory...
✅ Deploy completed successfully!
```

---

## ⚠️ IMPORTANTE

### Deploy Now é Temporário

```
⚠️ HOJE:       Use deploy-now.mjs (com password em .env)
🔒 DEPOIS:     Configure SSH key → Use deploy-secure.mjs
```

### Remover Password Depois

Depois de configurar SSH key:

```bash
# 1. Remover VPS_PASSWORD do .env
# Edit .env e deletar: VPS_PASSWORD=...

# 2. Usar deploy-secure.mjs
node scripts/deploy-secure.mjs staging
```

---

## 🔍 Troubleshooting

### "sshpass: command not found"

```bash
# Instalar sshpass
brew install sshpass  # macOS
sudo apt install sshpass  # Linux/WSL
```

### "Permission denied (password)."

```bash
# Verificar password em .env
cat .env | grep VPS_PASSWORD

# Verificar senha VPS
ssh root@82.29.58.126
```

### "git pull --ff-only" falhou

```bash
# SSH manual para corrigir
ssh root@82.29.58.126
cd /root/killsis/PRIME-SUL
git reset --hard origin/staging
git pull origin staging
pm2 restart prime-sul
```

---

## 📋 Checklist

- [ ] .env tem VPS_PASSWORD
- [ ] sshpass instalado
- [ ] Pode fazer: `node scripts/deploy-now.mjs`
- [ ] Deploy sucesso

---

## 🔐 Depois

Quando terminar deploy e tiver tempo:

1. Mude a senha VPS
2. Configure SSH key (SETUP_SECURE_DEPLOY.md)
3. Remova VPS_PASSWORD do .env
4. Use deploy-secure.mjs

---

**Status:** Pronto para deploy com password (temporário)

Próximo: SSH key auth (próximo mês)
