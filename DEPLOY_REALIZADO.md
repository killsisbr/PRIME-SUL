# ✅ Deploy PRIME SUL - Status

## 🎯 Objetivo Alcançado

Aumentar o limite de payload do endpoint OCR de 8MB para 25MB para resolver o erro `413 Payload Too Large`.

---

## ✅ Mudanças Realizadas

### 1️⃣ **server/routes/leads.js** (Linha 12)

**Antes:**
```javascript
const ocrBodyParser = express.json({ limit: '12mb' });
```

**Depois:**
```javascript
const ocrBodyParser = express.json({ limit: '30mb' }); // Permitir até 30MB para suportar imagens de alta resolução
```

**Por quê:** Aumentar a tolerância do middleware Express para aceitar payloads maiores.

---

### 2️⃣ **server/services/lead-ocr-service.js** (Linha 27)

**Antes:**
```javascript
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB — documento fotografado cabe tranquilo
```

**Depois:**
```javascript
const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25MB — suporta imagens de alta resolução e PDFs
```

**Por quê:** Aumentar o limite máximo de tamanho de imagem que o serviço OCR aceita.

---

## 📊 Status do Git

✅ **Commit realizado:**
```
[staging dfa5359] fix: aumentar limite de payload OCR de 8MB para 25MB (resolver erro 413)
 2 files changed, 78 insertions(+), 40 deletions(-)
```

✅ **Push realizado:**
```
To https://github.com/killsisbr/PRIME-SUL.git
   46c272b..dfa5359  staging -> staging
```

---

## 🚀 Deploy na VPS

### Status: ⏳ Pronto para Deploy

O código está commitado e fez push para o GitHub `staging` branch. Para aplicar na VPS:

#### **Opção 1: SSH Direto (Windows PowerShell)**
```powershell
ssh root@82.29.58.126 "cd /root/killsis/PRIME-SUL && git pull origin staging && npm install --omit=dev && pm2 restart prime-sul && pm2 status prime-sul"
```

#### **Opção 2: SSH Interativo (Bash/Terminal)**
```bash
ssh root@82.29.58.126 <<'EOF'
cd /root/killsis/PRIME-SUL
git pull origin staging
npm install --omit=dev
pm2 restart prime-sul
pm2 status prime-sul
EOF
```

#### **Opção 3: Conexão SSH Manual**
```bash
# 1. Conectar
ssh root@82.29.58.126

# 2. Dentro da VPS, executar:
cd /root/killsis/PRIME-SUL
git pull origin staging
npm install --omit=dev
pm2 restart prime-sul
```

---

## 🔍 Como Funciona Agora

### Fluxo de Requisição OCR

```
Cliente
   ↓
POST /api/leads/ocr (base64 image)
   ↓
[middleware global] express.json (256kb) ← Não interfere (rota tem parser dedicado)
   ↓
[parser dedicado] ocrBodyParser (30mb) ← ✅ Aceita 30MB
   ↓
service.extractFromImage()
   ↓
Validação: MAX_IMAGE_BYTES (25mb) ← ✅ Aceita 25MB
   ↓
Chamada NVIDIA Vision API
   ↓
Resposta com dados extraídos
```

### Limites

| Componente | Limite Anterior | Novo Limite | Razão |
|-----------|-----------------|------------|-------|
| Express Middleware Global | 256kb | 256kb | Mantém outras rotas seguras |
| ocrBodyParser | 12mb | **30mb** ✅ | Aceita imagens maiores |
| MAX_IMAGE_BYTES (serviço) | 8mb | **25mb** ✅ | Validação do serviço |

---

## ✅ Verificação Pós-Deploy

### 1. Testar Conectividade
```bash
# Na VPS (ou local)
curl -I http://82.29.58.126:5000/api/leads
# Esperado: HTTP/1.1 401 Unauthorized
```

### 2. Ver Logs
```bash
ssh root@82.29.58.126
pm2 logs prime-sul | head -50
```

### 3. Verificar Status
```bash
ssh root@82.29.58.126
pm2 status prime-sul
```

### 4. Testar OCR com Imagem Grande
```bash
# Criar imagem de teste de 10MB
# Enviar para POST /api/leads/ocr

# Esperado: 200 OK (antes dava 413)
```

---

## 📝 Commits e Histórico

```
Staging Branch:
├─ dfa5359 (HEAD) fix: aumentar limite de payload OCR de 8MB para 25MB (resolver erro 413)
├─ 46c272b (main) ... commits anteriores
```

---

## ⚠️ Notas Importantes

1. **Sem SSH Key?** A VPS pode estar configurada para SSH key-based auth. Se tiver problema, use `.env` com password temporariamente.

2. **Windows?** Use PowerShell ou WSL para SSH. GitBash também funciona.

3. **Linux/Mac?** SSH nativo, use os comandos acima.

4. **npm install:** Pode levar alguns minutos na VPS. Aguarde.

5. **PM2 Restart:** Aplicação terá ~2 segundos de downtime.

---

## 🎯 Próximos Passos

1. **Deploy na VPS:** Execute um dos comandos SSH acima
2. **Teste OCR:** Envie imagem > 8MB para confirmar
3. **Validar Logs:** Confira se não há erros
4. **Documentar:** Atualizar wikis/docs internas

---

## 📞 Troubleshooting

### "Connection refused" (Porta 22 fechada)
```bash
# Verificar se SSH está rodando
ssh -v root@82.29.58.126
# Se conectar OK, continue
```

### "npm install" lento
```bash
# Já é esperado na VPS. Aguarde 2-5 min.
# Para ver progresso:
pm2 logs prime-sul
```

### "git pull" falha
```bash
# Na VPS, forçar:
cd /root/killsis/PRIME-SUL
git reset --hard origin/staging
git pull origin staging
```

### PM2 não reinicia
```bash
# Ver erro:
pm2 logs prime-sul

# Reiniciar manualmente:
pm2 kill
pm2 start server/server.js --name prime-sul
pm2 save
```

---

## ✨ Resumo

- ✅ Código modificado
- ✅ Commit realizado (`staging` branch)
- ✅ Push para GitHub concluído
- ⏳ **Aguardando:** Deploy na VPS

**Próximo:** Executar SSH deploy (copiar comandos acima)

---

**Última atualização:** $(date)  
**Status:** Pronto para Deploy ✅
