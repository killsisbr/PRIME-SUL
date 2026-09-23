# 🚀 Deploy PRIME SUL na VPS

## ✅ Status Atual

**Commit realizado:** `fix: aumentar limite de payload OCR de 8MB para 25MB (resolver erro 413)`
**Branch:** `staging`
**Status do Git:** ✅ Push realizado com sucesso

```
Mudanças commitadas:
✅ server/routes/leads.js — Limite aumentado de 12MB para 30MB
✅ server/services/lead-ocr-service.js — MAX_IMAGE_BYTES: 8MB → 25MB
```

---

## 🔧 Opções de Deploy

### **Opção 1: SSH Manual (Recomendado se tiver chave SSH)**

```bash
ssh root@82.29.58.126 <<'EOF'
cd /root/killsis/PRIME-SUL
git pull origin staging
npm install --omit=dev
pm2 restart prime-sul
pm2 save
pm2 status prime-sul
EOF
```

### **Opção 2: Deploy via Terminal PowerShell (Windows)**

```powershell
# Instalar openssh-client se não tiver (Windows 10+)
# Depois executar:

ssh root@82.29.58.126 "cd /root/killsis/PRIME-SUL && git pull origin staging && npm install --omit=dev && pm2 restart prime-sul && pm2 save"
```

### **Opção 3: Deploy via GitHub Actions (Webhook)**

Se a VPS tiver um webhook configurado no GitHub, o deploy acontece automaticamente ao fazer push.

**Verifique:**
```bash
# Na VPS:
curl https://82.29.58.126/webhook/deploy 2>/dev/null
```

### **Opção 4: Script Python (Recomendado para automatização)**

```bash
# Instalar dependência:
pip install paramiko

# Executar:
python3 deploy-vps.py
```

**Variáveis de ambiente (opcionais):**
```bash
export VPS_HOST=82.29.58.126
export VPS_USER=root
export VPS_PASSWORD=Killsis19980910#
export VPS_APP_DIR=/root/killsis/PRIME-SUL
export VPS_PM2_APP=prime-sul
python3 deploy-vps.py
```

---

## 📋 O que foi mudado?

### **Problema Original:**
- Erro `413 Payload Too Large` ao enviar imagens > 8MB para OCR
- Limite de 8MB no serviço conflitava com limite de 12MB do middleware

### **Solução Aplicada:**

#### `server/routes/leads.js` (linha 12)
```javascript
// ANTES:
const ocrBodyParser = express.json({ limit: '12mb' });

// DEPOIS:
const ocrBodyParser = express.json({ limit: '30mb' }); // Permitir até 30MB para suportar imagens de alta resolução
```

#### `server/services/lead-ocr-service.js` (linha 27)
```javascript
// ANTES:
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB

// DEPOIS:
const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25MB — suporta imagens de alta resolução e PDFs
```

---

## ✅ Verificação após Deploy

Após fazer o deploy, teste o endpoint OCR:

```bash
# Teste simples:
curl -X POST http://82.29.58.126:5000/api/leads/ocr \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "base64_image_string_here",
    "mime_type": "image/png"
  }'
```

**Esperado:** 
- ✅ Imagens até 25MB → Status 200
- ❌ Imagens > 25MB → Status 413 (como esperado)

---

## 🔍 Logs na VPS

```bash
# Conectar na VPS:
ssh root@82.29.58.126

# Ver logs da aplicação:
pm2 logs prime-sul

# Ver status:
pm2 status prime-sul

# Restart manual:
pm2 restart prime-sul
```

---

## ⚠️ Importante

1. **Chave SSH:** Se não tiver configurada, será pedida senha interativamente
2. **VPS_PASSWORD:** Está em `.env` temporariamente — remover depois de configurar SSH key
3. **Teste:** Sempre teste o OCR após deploy
4. **Rollback:** Se algo der errado, faça `git reset --hard origin/staging` na VPS

---

## 📞 Suporte

Se tiver problema:

1. Verifique a conexão: `ping 82.29.58.126`
2. Teste SSH: `ssh root@82.29.58.126 "whoami"`
3. Verifique logs: `pm2 logs prime-sul`
4. Veja status: `pm2 status prime-sul`

---

**Status:** ✅ Código commitado e pronto para deploy  
**Branches:** staging (com mudanças) → main (produção)  
**Próximo:** Executar um dos scripts de deploy acima
