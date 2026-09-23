# 🚨 EXECUTE O DEPLOY AGORA!

## Status Atual

❌ **Erro ainda ativo na VPS:** 413 Payload Too Large  
✅ **Código corrigido localmente:** Commitado e enviado  
⏳ **Aguardando:** Deploy na VPS

---

## 🎯 Seu Erro Está Aqui

Você recebeu:
```
api/leads/ocr:1  Failed to load resource: the server responded with a status of 413 (Payload Too Large)
```

**Motivo:** A VPS ainda está rodando código **antigo** (8MB limit)

**Solução:** Fazer deploy do código novo (25MB limit)

---

## 🚀 COMO FAZER (3 OPÇÕES RÁPIDAS)

### **OPÇÃO 1: PowerShell (Mais Rápido) ⭐**

Abra PowerShell e copie/cole EXATAMENTE isto:

```powershell
ssh root@82.29.58.126
```

Quando pedir senha, digite: `Killsis19980910#`

Depois (dentro do SSH), copie/cole isto:

```bash
cd /root/killsis/PRIME-SUL && git pull origin staging && npm install --omit=dev && pm2 restart prime-sul && pm2 status prime-sul
```

**Aguarde 5-10 minutos**

---

### **OPÇÃO 2: GitBash / WSL**

Se tiver Git Bash ou WSL instalado:

```bash
ssh root@82.29.58.126 'cd /root/killsis/PRIME-SUL && git pull origin staging && npm install --omit=dev && pm2 restart prime-sul && pm2 status prime-sul'
```

---

### **OPÇÃO 3: Terminal / CMD Nativo**

```cmd
ssh root@82.29.58.126
```

Depois copie/cole:
```
cd /root/killsis/PRIME-SUL && git pull origin staging && npm install --omit=dev && pm2 restart prime-sul && pm2 status prime-sul
```

---

## ⏱️ O que vai acontecer:

1. **git pull origin staging** → Baixa código corrigido (5 segundos)
2. **npm install --omit=dev** → Instala dependências (2-5 minutos)
3. **pm2 restart prime-sul** → Reinicia aplicação (2 segundos)
4. **pm2 status prime-sul** → Mostra status final

**Total: ~3-6 minutos**

---

## ✅ Como saber que funcionou:

### Após o deploy (na VPS ou local):

**1️⃣ Teste OCR com imagem grande:**
```bash
curl -X POST http://82.29.58.126:5000/api/leads/ocr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"image":"...base64_de_10MB...","mime_type":"image/png"}'
```

**Esperado:** ✅ Status 200 (antes dava 413)

**2️⃣ Verifique logs:**
```bash
ssh root@82.29.58.126 'pm2 logs prime-sul | head -20'
```

**3️⃣ Verifique status:**
```bash
ssh root@82.29.58.126 'pm2 status prime-sul'
```

Esperado:
```
┌─────────────────────────────────┬──────────┬──────────┐
│ App name                        │ id │ mode    │ status  │
├─────────────────────────────────┼────┼─────────┼─────────┤
│ prime-sul                       │ 0  │ fork    │ online  │
└─────────────────────────────────┴────┴─────────┴─────────┘
```

---

## 🔧 Se SSH Não Funcionar

### Problema: "Permission denied"

**Solução:**
1. Copie a senha de `.env` (VPS_PASSWORD)
2. Cole no terminal SSH quando pedir
3. Se ainda não funcionar, tente:
   ```bash
   ssh -v root@82.29.58.126
   ```
   (Mostra debug info)

### Problema: "Command not found"

Se aparecer erro tipo "git: command not found", tente:
```bash
source /etc/profile
cd /root/killsis/PRIME-SUL
git pull origin staging
```

### Problema: npm install muito lento

É **normal**! Pode levar 5+ minutos. Veja progresso:
```bash
ssh root@82.29.58.126 'pm2 logs prime-sul --follow'
```

(Pressione Ctrl+C para sair)

---

## 📝 Qual Mudança Vai Aplicar

Depois do deploy, a VPS terá:

**ANTES:**
```javascript
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const ocrBodyParser = express.json({ limit: '12mb' });
```

**DEPOIS:**
```javascript
const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25MB ✅
const ocrBodyParser = express.json({ limit: '30mb' }); // ✅
```

---

## 🎯 Resultado Final

| Antes | Depois |
|-------|--------|
| Imagens > 8MB = 413 erro ❌ | Imagens até 25MB = OK ✅ |
| Documentos limitados | Documentos de alta resolução |
| Scans pequenos | Scans múltiplas páginas |

---

## ⚡ RESUMO RÁPIDO

1. Abra **PowerShell** ou **Terminal**
2. Execute: `ssh root@82.29.58.126`
3. Digite a senha: `Killsis19980910#`
4. Dentro da VPS, execute:
```
cd /root/killsis/PRIME-SUL && git pull origin staging && npm install --omit=dev && pm2 restart prime-sul && pm2 status prime-sul
```
5. Aguarde 5 minutos
6. ✅ Pronto! Erro 413 desapareceu!

---

## 📞 Suporte Rápido

Se tiver dúvida, veja estes arquivos:
- `DEPLOY_RESUMO_FINAL.md` - Guia completo
- `DEPLOY_INSTRUÇÕES.md` - Passo a passo
- `DEPLOY_LEIA_PRIMEIRO.txt` - Resumo simples

---

## ✨ Você está a 5 minutos de resolver o erro 413!

**Execute agora:** 
```
ssh root@82.29.58.126
```

💪 Vamos lá!
