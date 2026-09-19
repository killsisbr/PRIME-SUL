# 🚀 Deploy Manual — Instruções Diretas

**Status:** SSH automático não conseguiu conectar  
**Solução:** Execute manualmente os comandos abaixo

---

## 📋 Passos para Deploy

### Passo 1: Conectar ao VPS

```bash
ssh root@82.29.58.126
```

**Será pedida senha:**
```
root@82.29.58.126's password: Killsis19980910#
```

---

### Passo 2: Ir para o diretório do app

```bash
cd /root/killsis/PRIME-SUL
```

---

### Passo 3: Atualizar código

```bash
# Fetch das atualizações
git fetch origin

# Mudar para branch staging
git switch staging

# Pull do código
git pull --ff-only origin staging
```

**Esperado:**
```
From github.com:killsisbr/PRIME-SUL
   abc1234..def5678  staging     -> origin/staging
Updating abc1234..def5678
Fast-forward
 package.json                        |   4 +
 server/services/auth-service.js     |  96 +
 ...
 22 files changed, 1200 insertions(+), 40 deletions(-)
```

---

### Passo 4: Instalar dependências

```bash
npm install --production
```

**Esperado:**
```
up to date, audited 150 packages in 5s
```

---

### Passo 5: Reiniciar PM2

```bash
# Opção 1: Restart (se app já está rodando)
pm2 restart prime-sul

# Opção 2: Start (se app não está rodando)
pm2 start server/server.js --name prime-sul
```

**Esperado:**
```
[PM2] Applying action restartProcessId on app [prime-sul](ids: 0)
[PM2] ✓ Process restarted successfully
┌─────┬────────────────┬─────────────┬──────┬──────────┬──────────┐
│ id  │ name           │ namespace   │ mode │ pid      │ uptime   │
├─────┼────────────────┼─────────────┼──────┼──────────┼──────────┤
│ 0   │ prime-sul      │ default     │ fork │ 12345    │ 0s       │
└─────┴────────────────┴─────────────┴──────┴──────────┴──────────┘
```

---

### Passo 6: Verificar Status

```bash
pm2 status
```

**Esperado:**
```
┌─────┬────────────────┬──────────┬──────┬──────────┬──────────┐
│ id  │ name           │ status   │ ↺    │ uptime   │ cpu      │
├─────┼────────────────┼──────────┼──────┼──────────┼──────────┤
│ 0   │ prime-sul      │ online   │ 0    │ 2m       │ 0%       │
└─────┴────────────────┴──────────┴──────┴──────────┴──────────┘
```

---

### Passo 7: Ver Logs (Opcional)

```bash
pm2 logs prime-sul --lines 50
```

---

### Passo 8: Sair

```bash
exit
```

---

## ✅ Checklist

Depois de executar:

- [ ] `git pull --ff-only` executou com sucesso
- [ ] `npm install` instalou dependências
- [ ] `pm2 restart prime-sul` reiniciou o app
- [ ] `pm2 status` mostra app "online"
- [ ] `pm2 logs` não mostra erros
- [ ] App está respondendo em http://82.29.58.126:5000

---

## 🔍 Troubleshooting

### "git pull --ff-only" falhou

```bash
# Forçar reset
git reset --hard origin/staging
git pull origin staging
```

### "pm2: command not found"

```bash
# PM2 não está instalado/ativado
npm install -g pm2
pm2 start server/server.js --name prime-sul
pm2 save  # Salvar para autostart
```

### App não inicia

```bash
# Ver logs detalhados
pm2 logs prime-sul

# Tentar iniciar manualmente
node server/server.js
```

### "permission denied"

Você está no usuário errado. VPS deve ter user `root`.

---

## 📊 Resumo

| Passo | Comando | O quê |
|-------|---------|-------|
| 1 | `ssh root@82.29.58.126` | Conectar |
| 2 | `cd /root/killsis/PRIME-SUL` | Entrar no app |
| 3 | `git pull origin staging` | Puxar código |
| 4 | `npm install --production` | Instalar dependências |
| 5 | `pm2 restart prime-sul` | Reiniciar app |
| 6 | `pm2 status` | Verificar |

---

## ⏰ Tempo Estimado

```
Conectar: 10s
Pull: 20s
npm install: 30-60s
Restart: 5s
Verify: 5s
───────────────
Total: 2-3 minutos
```

---

## 🚀 Deploy Concluído

Quando tudo funcionar:

```
✅ Code atualizado
✅ Dependências instaladas
✅ App rodando
✅ PM2 gerenciando processo
```

---

## 🔐 Próximo: SSH Key Auth

Depois que tudo estiver funcionando, configure SSH key:

**Arquivo:** `SETUP_SECURE_DEPLOY.md`

Assim não precisa digitar senha toda vez.

---

**Status:** Ready para deploy manual  
**Tempo:** 2-3 minutos  
**Próximo:** Executar os comandos acima no VPS
