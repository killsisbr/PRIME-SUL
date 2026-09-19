# 🔍 ANÁLISE CRÍTICA: Scripts de Deploy

**Data:** Hoje  
**Status:** ⚠️ SEGURANÇA CRÍTICA + Oportunidades de Melhoria  

---

## 🚨 PROBLEMAS CRÍTICOS ENCONTRADOS

### 1. **SENHA HARDCODED EM CÓDIGO ABERTO** 🔴 CRÍTICO

**Arquivo:** `deploy.js` (linha 75)
```javascript
password: 'Killsis19980910#'
```

**Arquivo:** `scripts/git-deploy.mjs` (linha 17)
```javascript
const password = process.env.VPS_PASSWORD || 'Killsis19980910#';
```

**RISCO:** 
- Senha visível no Git history
- Acessível a qualquer desenvolvedor
- Qualquer pessoa com acesso ao repo consegue SSH ao VPS
- VPS completamente comprometido se senha não foi trocada

**AÇÃO IMEDIATA NECESSÁRIA:**
```bash
# 1. MUDAR SENHA DO VPS AGORA
ssh root@82.29.58.126
passwd  # digitar nova senha

# 2. REMOVER SENHA DO GIT HISTORY
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch deploy.js' \
  HEAD

# 3. ADICIONAR .gitignore
echo "deploy.js" >> .gitignore
echo ".env" >> .gitignore
echo "scripts/.env" >> .gitignore

# 4. USAR VARIÁVEIS DE AMBIENTE APENAS
```

---

### 2. **IP DO VPS EXPOSTO** 🔴 CRÍTICO

**Arquivo:** `deploy.js` (linha 72)
```javascript
host: '82.29.58.126'
```

**RISCO:**
- IP público visível no código aberto
- Facilita reconhecimento e ataques ao servidor
- Potencial de força bruta SSH

**SOLUÇÃO:**
```javascript
// Use variável de ambiente
const host = process.env.VPS_HOST || 'default-value';
```

---

### 3. **CREDENCIAIS NÃO ROTACIONADAS** 🟠 ALTO

**Problema:**
- Mesma senha hardcoded em 2+ arquivos
- Sem sistema de rotation de credentials
- Sem audit trail de acesso SSH

---

## 📊 ANÁLISE DETALHADA

### `deploy.js` (76 linhas)

**Propósito:** Deploy automático via SSH + npm install + PM2 restart

**Fluxos:**
```
SSH Connect → git pull → npm install → pm2 restart
```

**Problemas:**
- ✅ Lógica básica OK
- ✅ Trata erros (try/catch)
- ❌ Senha hardcoded
- ❌ IP exposto
- ❌ Sem timeout (pode travar indefinidamente)
- ❌ Sem rollback automático
- ⚠️ Usa `pm2 restart all` (pode reiniciar outros processos)

**Melhorias Recomendadas:**
```javascript
// ✅ BOM
const host = process.env.VPS_HOST;
const password = process.env.VPS_PASSWORD;
const timeout = 30000; // 30s

// ❌ RUIM
const timeout = undefined; // pode travar
pm2 restart all; // pode quebrar outros apps
```

---

### `scripts/git-deploy.mjs` (87 linhas)

**Propósito:** Deploy com suporte a staging/production

**Fluxos:**
```
Staging:      git pull origin/staging → pm2 restart prime-sul
Production:   git pull origin/main → pm2 restart prime-sul
```

**Problemas:**
- ✅ Suporta 2 ambientes
- ✅ Config por ambiente
- ✅ Usa git fetch + switch (mais seguro)
- ❌ Senha hardcoded (default fallback)
- ❌ IP hardcoded (default fallback)
- ❌ Sem validação de branch
- ⚠️ `git pull --ff-only` pode falhar silenciosamente
- ⚠️ Sem verificação se PM2 app existe

**Fluxo de Erro Possível:**
```
git pull --ff-only falha
  → Sem tratamento
  → PM2 não reinicia
  → Deploy falha silenciosamente
```

---

### `scripts/commit-and-deploy.mjs` (65 linhas)

**Propósito:** Ciclo completo: commit + push + deploy

**Fluxos:**
```
1. Verificar git status
2. Fazer commit (git add -A)
3. Push (para staging ou main)
4. Deploy (chama git-deploy.mjs)
```

**Problemas:**
- ✅ Automação útil
- ✅ Evita passos manuais
- ❌ `git add -A` adiciona TUDO (pode ter junk)
- ❌ Sem verificação de tests
- ❌ Sem verificação de lint
- ❌ Sem verificação de cobertura de testes
- ❌ Branch hardcoded (só staging/main)
- ⚠️ Sem confirmação antes de deploy

**Problema Potencial:**
```bash
# User fez mudanças em .env local
node commit-and-deploy.mjs "fix: bug"
# git add -A agora adiciona .env!
# .env com senhas pode ir pro git
```

---

### `scripts/deploy-status.mjs` (61 linhas)

**Propósito:** Verificar status PM2 e commits

**Fluxos:**
```
SSH Connect → pm2 status + git log + git branch + versions
```

**Problemas:**
- ✅ Útil para diagnóstico
- ❌ Senha hardcoded (default)
- ❌ IP hardcoded (default)
- ⚠️ Sem timeout (pode travar)
- ℹ️ Apenas leitura (seguro)

---

### `DEPLOY.md` (175 linhas)

**Propósito:** Documentação dos scripts

**Conteúdo:**
- ✅ Guia de uso
- ✅ Exemplos
- ✅ Troubleshooting
- ❌ Não menciona segurança
- ❌ Recomenda usar senha hardcoded (!?)
- ⚠️ Recomenda `.env` do JARVIS (confusão de contexto)

---

## 🏗️ ARQUITETURA DE DEPLOY ATUAL

```
Local Machine
    ↓
commit-and-deploy.mjs
    ↓ (git push)
GitHub
    ↓
Webhook Trigger (não encontrado)
    ↓
VPS (82.29.58.126)
├─ git-deploy.mjs (SSH)
│  └─ git pull origin/staging
│  └─ npm install --production
│  └─ pm2 restart prime-sul
├─ PM2 (Process Manager)
│  └─ server/server.js
└─ Node.js (Port 5000)
```

**Problemas de Arquitetura:**
- ❌ Sem CI/CD (nenhum testes antes de deploy)
- ❌ Sem rollback automático
- ❌ Sem health check após deploy
- ❌ Sem notificação de status
- ❌ Sem rate limiting em deploy
- ⚠️ Sem ambiente de staging real (mesma máquina)

---

## 📋 CHECKLIST DE SEGURANÇA

| Item | Status | Crítico |
|------|--------|---------|
| Senha hardcoded | ❌ | 🔴 SIM |
| IP exposto | ❌ | 🔴 SIM |
| .env no gitignore | ❌ | 🔴 SIM |
| SSH key (não password) | ❌ | 🟠 SIM |
| Timeout em SSH | ❌ | 🟠 SIM |
| Validação de branch | ❌ | 🟠 SIM |
| Tests antes de deploy | ❌ | 🟠 SIM |
| Rollback automático | ❌ | 🟠 SIM |
| Health check após deploy | ❌ | 🟠 SIM |
| Audit log | ❌ | 🟡 Bom ter |
| Slack/Discord notification | ❌ | 🟡 Bom ter |

---

## 🔧 PLANO DE MELHORIA

### **Fase 1: Segurança (URGENTE - Hoje)**

```bash
# 1. Trocar senha VPS
ssh root@82.29.58.126
passwd

# 2. Setup SSH key (sem password)
ssh-keygen -t ed25519 -f ~/.ssh/prime-sul-deploy
ssh-copy-id -i ~/.ssh/prime-sul-deploy root@82.29.58.126

# 3. Remover senha do código
rm deploy.js  # deletar arquivo comprometido
git rm -f deploy.js scripts/git-deploy.mjs

# 4. Criar .env.example (sem valores)
cat > .env.example << 'EOF'
VPS_HOST=your-vps-ip
VPS_USER=root
VPS_PORT=22
VPS_KEY_PATH=~/.ssh/prime-sul-deploy
EOF

# 5. Adicionar .gitignore
echo ".env" >> .gitignore
echo "scripts/.env" >> .gitignore
echo ".ssh/" >> .gitignore

# 6. Push
git add .env.example .gitignore
git commit -m "security: Remove hardcoded credentials"
git push origin staging
```

---

### **Fase 2: Reescrever Scripts (Esta Semana)**

**Novo `scripts/deploy-ssh.mjs` (seguro):**

```javascript
#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const target = process.argv[2] || 'staging';
const keyPath = process.env.VPS_KEY_PATH || `${process.env.HOME}/.ssh/prime-sul-deploy`;

if (!fs.existsSync(keyPath)) {
    console.error(`❌ SSH key not found: ${keyPath}`);
    process.exit(1);
}

const env = {
    staging: {
        dir: '/root/killsis/PRIME-SUL',
        branch: 'staging',
        pm2: 'prime-sul'
    },
    production: {
        dir: '/root/killsis/PRIME-SUL',
        branch: 'main',
        pm2: 'prime-sul'
    }
}[target];

const commands = [
    `echo "🚀 Deploying [${target.toUpperCase()}]..."`,
    `cd ${env.dir}`,
    `git fetch origin`,
    `git checkout ${env.branch}`,
    `git reset --hard origin/${env.branch}`,
    `npm install --production`,
    `npm test`,  // NOVO: rodar testes
    `pm2 restart ${env.pm2}`,
    `sleep 2 && pm2 show ${env.pm2}`,  // NOVO: health check
    `echo "✅ Deploy successful"`
].join(' && ');

try {
    const sshCommand = `ssh -i ${keyPath} root@${process.env.VPS_HOST} '${commands}'`;
    execSync(sshCommand, { stdio: 'inherit' });
} catch (e) {
    console.error(`❌ Deploy failed: ${e.message}`);
    process.exit(1);
}
```

---

### **Fase 3: CI/CD Integrado (Próximo Mês)**

Usar GitHub Actions:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Staging

on:
  push:
    branches: [staging]

jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install
        run: npm install
      
      - name: Test
        run: npm test
      
      - name: Deploy
        env:
          VPS_HOST: ${{ secrets.VPS_HOST }}
          VPS_USER: ${{ secrets.VPS_USER }}
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$DEPLOY_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh -i ~/.ssh/deploy_key root@$VPS_HOST 'cd /root/killsis/PRIME-SUL && git pull && npm install && pm2 restart prime-sul'
      
      - name: Notify
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -d '{"text":"✅ Deploy successful to staging"}'
```

---

## 🎯 RECOMENDAÇÕES FINAIS

### Curto Prazo (Hoje - Esta Semana)

1. **MUDAR SENHA VPS IMEDIATAMENTE**
   ```bash
   ssh root@82.29.58.126
   passwd  # nova senha FORTE
   ```

2. **Remover credenciais do Git**
   ```bash
   git filter-branch -f --index-filter 'git rm --cached -f *.js' HEAD
   ```

3. **Setup SSH key (sem password)**
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/prime-sul
   ssh-copy-id -i ~/.ssh/prime-sul root@82.29.58.126
   ```

4. **Adicionar .gitignore**
   ```
   .env
   .env.local
   .ssh/
   ```

### Médio Prazo (Este Mês)

5. **Reescrever scripts com SSH key**
   - Usar `ssh2` com keyPath
   - Adicionar validação de branch
   - Adicionar timeout (30s)
   - Adicionar health check

6. **Adicionar testes antes de deploy**
   - `npm test` no VPS
   - Fail fast se testes falharem
   - Rollback automático

7. **Adicionar notificações**
   - Slack/Discord webhook
   - Email de deploy status

### Longo Prazo (Próxima Trimestre)

8. **Setup CI/CD (GitHub Actions)**
   - Rodar testes automaticamente
   - Deploy automático se testes passam
   - Environment secrets

9. **Staging real (máquina separada)**
   - Testar em staging antes de production
   - Blue-green deployment

10. **Monitoring + Alertas**
    - PM2 monitoramento
    - Response time tracking
    - Error rate alerts

---

## 📞 NEXT STEPS

### Hoje (Urgente - 1 hora)
- [ ] Mudar senha VPS
- [ ] Remover deploy.js do Git history
- [ ] Criar SSH key

### Esta Semana
- [ ] Reescrever scripts com SSH key
- [ ] Criar .gitignore
- [ ] Testes antes de deploy

### Próximas 2 Semanas
- [ ] GitHub Actions CI/CD
- [ ] Notificações Slack
- [ ] Health check após deploy

---

## 📊 Sumário

| Aspecto | Status | Prioridade |
|---------|--------|-----------|
| **Segurança** | ❌ Crítica | 🔴 URGENTE |
| **Automação** | ✅ Bom | 🟢 OK |
| **Documentação** | ⚠️ OK | 🟡 Melhorar |
| **Testes** | ❌ Inexistente | 🔴 URGENTE |
| **Rollback** | ❌ Manual | 🟠 Importante |
| **Monitoramento** | ⚠️ Básico | 🟡 Melhorar |

**Conclusão:** Scripts funcionam mas tem **SÉRIOS problemas de segurança** que precisam ser corrigidos hoje.

---

**Análise por:** Claude Code  
**Data:** Hoje  
**Status:** ⚠️ AÇÃO IMEDIATA NECESSÁRIA
