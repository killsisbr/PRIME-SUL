# 🚀 GUIA INICIAL: Começando FASE 1

## ⏰ Timeline: Semanas 1-2

```
Dia 1-2:   Checkpoint 1.1 (Auth + DB)
Dia 3-4:   Checkpoint 1.2 (Carteira)
Dia 5-6:   Checkpoint 1.3 (Funil)
Dia 7-10:  Checkpoint 1.4 (Disparo + Testes)
Dia 11-14: Polish + v0.1.0-beta Release
```

---

## 📋 O Que Fazer Agora (Esta Semana)

### **Pré-requisitos**
```bash
# 1. Node.js 18+
node --version  # v18.x ou maior

# 2. npm 9+
npm --version   # 9.x ou maior

# 3. SQLite
sqlite3 --version

# 4. Git
git --version
```

### **Setup Inicial**
```bash
# 1. Clonar/inicializar repo
cd D:\PRIME SUL

# 2. Se for novo repo
git init
git branch -m main  # Renomear main
git remote add origin <url-do-repo>

# 3. Instalar dependências
npm install

# 4. Setup .env
cp .env.example .env

# 5. Criar database
npm run db:init

# 6. Verificar tudo está OK
npm run test  # Testes devem passar
npm run lint  # Sem erros de linting
```

---

## 📂 Estrutura de Pastas para Fase 1

```
PRIME SUL/
├── server/
│   ├── middleware/
│   │   └── auth.js              [NEW] Checkpoint 1.1
│   │
│   ├── services/
│   │   ├── auth-service.js      [NEW] Checkpoint 1.1
│   │   ├── carteira-service.js  [NEW] Checkpoint 1.2
│   │   ├── funil-service.js     [NEW] Checkpoint 1.3
│   │   ├── campaign-service.js  [NEW] Checkpoint 1.4
│   │   └── send-queue-service.js[NEW] Checkpoint 1.4
│   │
│   ├── routes/
│   │   ├── auth.js              [NEW] Checkpoint 1.1
│   │   ├── leads.js             [NEW] Checkpoint 1.2/1.3
│   │   └── campaigns.js         [NEW] Checkpoint 1.4
│   │
│   ├── database/
│   │   ├── schema.sql           [MODIFY] Checkpoint 1.1
│   │   ├── migrations/          [NEW]
│   │   │   ├── 001_initial.js   [NEW] Checkpoint 1.1
│   │   │   ├── 002_leads.js     [NEW] Checkpoint 1.2
│   │   │   └── 003_campaigns.js [NEW] Checkpoint 1.4
│   │   └── db.js                [MODIFY]
│   │
│   └── server.js                [MODIFY] Integrar rotas
│
├── public/
│   ├── js/
│   │   ├── assistant.js         [NEW] Checkpoint 1.2
│   │   ├── assistant-chat.js    [NEW] Checkpoint 1.2
│   │   ├── assistant-tools.js   [NEW] Checkpoint 1.2
│   │   └── assistant-state.js   [NEW] Checkpoint 1.2
│   │
│   ├── css/
│   │   └── assistant.css        [NEW] Checkpoint 1.2
│   │
│   └── admin.html               [MODIFY] Integrar card
│
├── tests/
│   ├── auth.test.js             [NEW] Checkpoint 1.1
│   ├── carteira.test.js         [NEW] Checkpoint 1.2
│   ├── funil.test.js            [NEW] Checkpoint 1.3
│   └── campaign.test.js         [NEW] Checkpoint 1.4
│
├── docs/
│   ├── API.md                   [NEW] API documentation
│   ├── AUTH.md                  [NEW] Checkpoint 1.1
│   ├── CARTEIRA.md              [NEW] Checkpoint 1.2
│   ├── FUNIL.md                 [NEW] Checkpoint 1.3
│   └── DISPARO.md               [NEW] Checkpoint 1.4
│
└── CHANGELOG.md                 [NEW] Rastrear mudanças
```

---

## ✅ CHECKPOINT 1.1: Auth + Database (Dia 1-2)

### **Tarefas do Dia**

#### **Tarefa 1.1.1: Database Schema**
```javascript
// server/database/schema.sql

-- Sellers (Vendedores)
CREATE TABLE sellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'seller',
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Leads
CREATE TABLE leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL REFERENCES sellers(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    status TEXT DEFAULT 'novo',
    score INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Campanhas
CREATE TABLE campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL REFERENCES sellers(id),
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Envios
CREATE TABLE sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER REFERENCES campaigns(id),
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Commit:**
```bash
git add server/database/schema.sql
git commit -m "feat(db): Add database schema for Fase 1

- Sellers table (vendedores com auth)
- Leads table (contatos do vendedor)
- Campaigns table (campanhas de disparo)
- Sends table (rastreamento de envios)

Related to: Checkpoint 1.1"
```

#### **Tarefa 1.1.2: Auth Service**
```javascript
// server/services/auth-service.js

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../database/db');

class AuthService {
  async login(email, password) {
    const seller = await db.get(
      'SELECT * FROM sellers WHERE email = ?',
      [email]
    );

    if (!seller) throw new Error('Seller not found');

    const isValid = await bcrypt.compare(password, seller.password);
    if (!isValid) throw new Error('Invalid password');

    const token = jwt.sign(
      { id: seller.id, email: seller.email, role: seller.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return { token, seller };
  }

  async createSeller(name, email, password, phone) {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.run(
      `INSERT INTO sellers (name, email, password, phone) 
       VALUES (?, ?, ?, ?)`,
      [name, email, hashedPassword, phone]
    );

    return result;
  }

  verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }
}

module.exports = new AuthService();
```

**Commit:**
```bash
git add server/services/auth-service.js
git commit -m "feat(auth): Add authentication service

- Login com email/password
- Password hashing com bcrypt
- JWT token generation (24h expiry)
- Create seller

Related to: Checkpoint 1.1"
```

#### **Tarefa 1.1.3: Auth Middleware**
```javascript
// server/middleware/auth.js

const authService = require('../services/auth-service');

module.exports = {
  auth: (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const payload = authService.verifyToken(token);
      req.user = payload;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  },

  adminOnly: (req, res, next) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    next();
  }
};
```

**Commit:**
```bash
git add server/middleware/auth.js
git commit -m "feat(auth): Add authentication middleware

- Verify JWT token from headers
- Attach user payload to request
- Admin-only middleware

Related to: Checkpoint 1.1"
```

#### **Tarefa 1.1.4: Auth Routes**
```javascript
// server/routes/auth.js

const express = require('express');
const authService = require('../services/auth-service');
const { auth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', auth, (req, res) => {
  // Logout no frontend (remover token)
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  res.json(req.user);
});

module.exports = router;
```

**Commit:**
```bash
git add server/routes/auth.js
git commit -m "feat(auth): Add authentication routes

- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me (protected)

Related to: Checkpoint 1.1"
```

#### **Tarefa 1.1.5: Testes de Auth**
```javascript
// tests/auth.test.js

const test = require('node:test');
const assert = require('node:assert');
const authService = require('../server/services/auth-service');

test('Auth Service', async (t) => {
  await t.test('Should create seller', async () => {
    const result = await authService.createSeller(
      'Test Seller',
      'test@example.com',
      'password123',
      '1198765432'
    );
    assert.ok(result.lastID > 0);
  });

  await t.test('Should login successfully', async () => {
    const result = await authService.login('test@example.com', 'password123');
    assert.ok(result.token);
    assert.strictEqual(result.seller.email, 'test@example.com');
  });

  await t.test('Should reject invalid password', async () => {
    try {
      await authService.login('test@example.com', 'wrong');
      assert.fail('Should throw error');
    } catch (err) {
      assert.strictEqual(err.message, 'Invalid password');
    }
  });

  await t.test('Should verify token', async () => {
    const result = await authService.login('test@example.com', 'password123');
    const payload = authService.verifyToken(result.token);
    assert.strictEqual(payload.email, 'test@example.com');
  });
});
```

**Commit:**
```bash
git add tests/auth.test.js
git commit -m "test(auth): Add authentication tests

- Create seller
- Login
- Password validation
- Token verification

Coverage: 90%"
```

#### **Tarefa 1.1.6: Integrar ao Server**
```javascript
// server/server.js (modificar)

const express = require('express');
const authRoutes = require('./routes/auth');

const app = express();

app.use(express.json());
app.use('/api/auth', authRoutes);

app.listen(5000, () => console.log('Server running on :5000'));
```

**Commit:**
```bash
git add server/server.js
git commit -m "chore(server): Integrate auth routes"
```

#### **Tarefa 1.1.7: Documentação**
```markdown
# Authentication (docs/AUTH.md)

## Overview
JWT-based authentication para PRIME SUL Assistant.

## Endpoints

### POST /api/auth/login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "seller@test.com", "password": "pass"}'
```

Response:
```json
{
  "token": "eyJhbGc...",
  "seller": {
    "id": 1,
    "name": "Seller Name",
    "email": "seller@test.com",
    "role": "seller"
  }
}
```

### GET /api/auth/me
Protected endpoint. Requer token.

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/auth/me
```

## Implementation
- Password hashing: bcryptjs
- Token: JWT (24h expiry)
- Middleware: /server/middleware/auth.js
```

**Commit:**
```bash
git add docs/AUTH.md
git commit -m "docs(auth): Add authentication documentation"
```

### **Checkpoint 1.1 Summary**

```bash
# Todos os commits feitos
git log --oneline
# feat(db): Add database schema for Fase 1
# feat(auth): Add authentication service
# feat(auth): Add authentication middleware
# feat(auth): Add authentication routes
# test(auth): Add authentication tests
# chore(server): Integrate auth routes
# docs(auth): Add authentication documentation

# Teste tudo
npm test  # Testes devem passar
npm run lint  # Sem erros

# Criar tag de checkpoint
git tag -a v1.1-auth -m "Checkpoint 1.1: Auth + Database

Features:
✅ JWT Authentication
✅ Password hashing (bcryptjs)
✅ Seller CRUD
✅ Protected endpoints
✅ Database schema (sellers, leads, campaigns, sends)

Tests: 90% coverage

Date: 2024-01-15
Version: v1.1-auth"

# Push
git push origin v1.1-auth

# Notificar
echo "✅ Checkpoint 1.1 concluído! Tag: v1.1-auth"
```

---

## ✅ CHECKPOINT 1.2: Carteira Clientes (Dia 3-4)

### **Resumo das Tarefas**

```
1. Carteira Service (CRUD de leads)
2. Leads Routes (GET /api/leads, POST /api/leads, etc)
3. Frontend: Card + UI
4. NLP Integration (intent detection)
5. Testes
6. Documentação
```

**Principais commits:**
```bash
git commit -m "feat(carteira): Implement lead management"
git commit -m "feat(carteira): Add carteira NLP integration"
git commit -m "test(carteira): Add lead tests"
git tag -a v1.2-carteira -m "Checkpoint 1.2: Carteira Clientes"
git push origin v1.2-carteira
```

---

## ✅ CHECKPOINT 1.3: Funil Vendas (Dia 5-6)

**Principais commits:**
```bash
git commit -m "feat(funil): Implement funnel analysis"
git commit -m "feat(funil): Add conversion calculations"
git commit -m "test(funil): Add funil tests"
git tag -a v1.3-funil -m "Checkpoint 1.3: Funil de Vendas"
git push origin v1.3-funil
```

---

## ✅ CHECKPOINT 1.4: Disparo Comercial (Dia 7-10)

**Principais commits:**
```bash
git commit -m "feat(disparo): Implement campaign management"
git commit -m "feat(disparo): Add send queue + retry logic"
git commit -m "feat(disparo): Add campaign preview"
git commit -m "test(disparo): Add campaign tests"
git tag -a v1.4-disparo -m "Checkpoint 1.4: Disparo Comercial"
git push origin v1.4-disparo
```

---

## 🎯 Release v0.1.0-beta (Dia 11-14)

```bash
# 1. Final tests + polish
npm test    # Tudo deve passar
npm run lint # Sem erros

# 2. Update CHANGELOG
echo "## v0.1.0-beta (2024-01-15)

### Features
- ✅ Checkpoint 1.1: Auth + Database
- ✅ Checkpoint 1.2: Carteira Clientes
- ✅ Checkpoint 1.3: Funil Vendas
- ✅ Checkpoint 1.4: Disparo Comercial

### Performance
- Response time: <500ms (median)
- Test coverage: 85%+

### Known Issues
- OAuth não implementado (v0.3.0)
- Gemini Vision em development (v0.4.0)

" >> CHANGELOG.md

# 3. Commit final
git add CHANGELOG.md
git commit -m "chore: Release v0.1.0-beta

MVP Assistant com 4 ferramentas críticas:
- Carteira de Clientes
- Funil de Vendas
- Disparo Comercial
- Meu WhatsApp (UI pronta, API falta)

All tests passing ✅
Ready for beta testing!"

# 4. Create release tag
git tag -a v0.1.0-beta -m "Release 0.1.0 BETA

PRIME SUL Assistant - MVP Release

Features:
✅ JWT Authentication
✅ 4 Ferramentas funcionais
✅ NLP básico
✅ Database SQLite
✅ WebSocket ready
✅ UI Neo-Brutalista

Ready for beta testing on staging!"

# 5. Push everything
git push origin main --tags
git push origin develop --tags

# 6. Create GitHub release
gh release create v0.1.0-beta \
  --title "MVP Beta Release (v0.1.0)" \
  --notes "Primeiro MVP com 4 ferramentas críticas. Pronto para teste em staging."

echo "🎉 v0.1.0-beta released!"
```

---

## 📊 Daily Standup Template

```markdown
## Daily Standup - Checkpoint X.Y

### Yesterday
- [x] Tarefa A completa
- [x] Tarefa B completa
- [x] Testes passando

### Today
- [ ] Tarefa C
- [ ] Tarefa D
- [ ] Revisar PR

### Blockers
- Nenhum

### Metrics
- Commits: 5
- Tests passing: 20/20 (100%)
- Coverage: 87%
- Performance: <300ms

### Next Checkpoint
v1.2-carteira (Dia 3-4)
```

---

## 🎯 Pronto para Começar?

1. ✅ Setup inicial (npm install, .env, etc)
2. ✅ Criar Checkpoint 1.1 (Auth + DB)
3. ✅ Commit com mensagem padrão
4. ✅ Tag com v1.1-auth
5. ✅ Push
6. ✅ Continuar para 1.2

**Vamos?** 🚀

```bash
npm install
npm run db:init
npm test  # Verificar tudo OK
git checkout -b feature/auth-checkpoint1.1 develop
# ... desenvolver Checkpoint 1.1 ...
git commit -m "feat(auth): ..."
git tag v1.1-auth
git push origin feature/auth-checkpoint1.1
# ... fazer PR, review, merge ...
git push origin v1.1-auth
```
