# 🚀 IMPLEMENTAÇÃO: Começando Agora - FASE 1

## 📍 Status Atual: Iniciando Checkpoint 1.1

Data: Hoje  
Fase: 1 de 5  
Checkpoint: 1.1 (Auth + Database)  
Timeline: 2 dias (Dia 1-2 de 14)

---

## ✅ PRÉ-REQUISITOS

### Setup Git

```bash
# 1. Se ainda não inicializou o repo
cd D:\PRIME SUL
git init
git branch -m main
git config user.name "Seu Nome"
git config user.email "seu@email.com"

# 2. Se já tem repo remoto
git remote add origin https://github.com/seu-repo/prime-sul.git

# 3. Criar branches principais
git branch develop
git branch -a  # verificar
```

### Setup Node.js

```bash
# Verificar versions
node --version  # deve ser 18+
npm --version   # deve ser 9+

# Instalar dependências
cd D:\PRIME SUL
npm install

# Verificar tudo OK
npm test  # pode falhar agora (normal)
npm run lint  # pode não ter comando ainda
```

---

## 🎯 CHECKPOINT 1.1: Auth + Database

**Objetivo:** Implementar autenticação JWT + schema do banco

**Duração:** 2 dias de trabalho

**Commits esperados:** 7-8

---

## 📋 TAREFA 1.1.1: Setup do Projeto Base

### Passo 1: Criar estrutura de pastas

```bash
# Criar estrutura
mkdir -p server/{middleware,services,routes,database}
mkdir -p public/{js,css}
mkdir -p tests
mkdir -p docs

# Verificar
tree server/ -L 2
```

### Passo 2: Criar package.json atualizado

```javascript
// package.json - MODIFICAR
{
  "name": "prime-sul",
  "version": "0.1.0",
  "description": "CRM + IA Assistente com Gemini Vision",
  "main": "server/server.js",
  "scripts": {
    "start": "node server/server.js",
    "dev": "node --watch server/server.js",
    "test": "node --test tests/*.test.js",
    "lint": "echo 'Linting...'",
    "db:init": "node server/database/init.js",
    "db:seed": "node server/database/seed.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "jsonwebtoken": "^9.0.3",
    "bcryptjs": "^3.0.3",
    "sqlite3": "^6.0.1",
    "dotenv": "^17.4.2"
  },
  "devDependencies": {}
}
```

**Commit:**
```bash
git add -A
git commit -m "chore(project): Initialize project structure

- Criar pasta structure (server, tests, docs)
- Update package.json com scripts
- Setup dependencies para auth (express, jwt, bcryptjs, sqlite3)

Related to: Checkpoint 1.1"
```

---

## 📋 TAREFA 1.1.2: Database Schema

### Passo 1: Criar schema.sql

```sql
-- server/database/schema.sql

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Tabela: Sellers (Vendedores)
CREATE TABLE IF NOT EXISTS sellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'seller' CHECK (role IN ('seller', 'admin')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabela: Leads
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL REFERENCES sellers(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'enviado', 'sim', 'nao', 'bloqueado')),
    score INTEGER DEFAULT 0,
    prioridade TEXT DEFAULT 'media' CHECK (prioridade IN ('alta', 'media', 'baixa')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabela: Campanhas
CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL REFERENCES sellers(id),
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'done')),
    target_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabela: Sends (Rastreamento de envios)
CREATE TABLE IF NOT EXISTS sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER REFERENCES campaigns(id),
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'confirmed', 'refused', 'failed')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_leads_seller ON leads(seller_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_seller ON campaigns(seller_id);
CREATE INDEX IF NOT EXISTS idx_sends_campaign ON sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sends_lead ON sends(lead_id);
```

**Commit:**
```bash
git add server/database/schema.sql
git commit -m "feat(database): Add database schema

- Sellers (vendedores com auth)
- Leads (contatos)
- Campaigns (campanhas de disparo)
- Sends (rastreamento de envios)
- Indices para queries otimizadas
- Foreign keys e constraints

Related to: Checkpoint 1.1"
```

### Passo 2: Criar database helper

```javascript
// server/database/db.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/prime_sul.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('Database error:', err);
  else console.log('Connected to SQLite database');
});

// Promisify database operations
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve({ lastID: this.lastID });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

module.exports = { db, run, get, all };
```

**Commit:**
```bash
git add server/database/db.js
git commit -m "feat(database): Add database helper with promisify

- Helper functions: run(), get(), all()
- SQLite3 connection pool
- Promisified for async/await
- Automatic table creation

Related to: Checkpoint 1.1"
```

### Passo 3: Criar init.js

```javascript
// server/database/init.js

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const DB_PATH = path.join(__dirname, '../../data/prime_sul.db');
const DATA_DIR = path.dirname(DB_PATH);

// Criar diretório data se não existir
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`✅ Created directory: ${DATA_DIR}`);
}

// Criar/inicializar banco
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Database error:', err);
    process.exit(1);
  }
  console.log(`✅ Connected to: ${DB_PATH}`);
});

// Ler schema
const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');

// Executar schema
db.exec(schema, (err) => {
  if (err) {
    console.error('❌ Schema error:', err);
    process.exit(1);
  }
  console.log('✅ Database schema initialized');
  
  // Seedar dados de teste
  seedDatabase(db);
});

function seedDatabase(db) {
  const bcrypt = require('bcryptjs');
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const sellerPassword = bcrypt.hashSync('seller123', 10);

  db.run(
    `INSERT OR IGNORE INTO sellers (name, email, password, phone, role) 
     VALUES ('Admin', 'admin@test.com', ?, '1199999999', 'admin')`,
    [adminPassword],
    (err) => {
      if (err) console.error('❌ Seed admin error:', err);
      else console.log('✅ Seeded admin user');
    }
  );

  db.run(
    `INSERT OR IGNORE INTO sellers (name, email, password, phone, role) 
     VALUES ('Test Seller', 'seller@test.com', ?, '1198888888', 'seller')`,
    [sellerPassword],
    (err) => {
      if (err) console.error('❌ Seed seller error:', err);
      else {
        console.log('✅ Seeded seller user');
        console.log('\n📝 Test Credentials:');
        console.log('   Admin:  admin@test.com / admin123');
        console.log('   Seller: seller@test.com / seller123\n');
        db.close();
      }
    }
  );
}
```

**Commit:**
```bash
git add server/database/init.js
git commit -m "feat(database): Add database initialization script

- Create database from schema.sql
- Create data directory if not exists
- Seed test users (admin, seller)
- Run with: npm run db:init

Related to: Checkpoint 1.1"
```

---

## 📋 TAREFA 1.1.3: Auth Service

```javascript
// server/services/auth-service.js

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { get, run } = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';
const JWT_EXPIRY = '24h';

class AuthService {
  /**
   * Login: email + password → JWT token
   */
  async login(email, password) {
    if (!email || !password) {
      throw new Error('Email and password required');
    }

    const seller = await get(
      'SELECT id, name, email, password, role FROM sellers WHERE email = ?',
      [email]
    );

    if (!seller) {
      throw new Error('Seller not found');
    }

    const isValid = await bcrypt.compare(password, seller.password);
    if (!isValid) {
      throw new Error('Invalid password');
    }

    const token = jwt.sign(
      {
        id: seller.id,
        email: seller.email,
        name: seller.name,
        role: seller.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return {
      success: true,
      token,
      seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        role: seller.role
      }
    };
  }

  /**
   * Create seller
   */
  async createSeller(name, email, password, phone, role = 'seller') {
    if (!name || !email || !password || !phone) {
      throw new Error('Name, email, password, and phone are required');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert
    const result = await run(
      'INSERT INTO sellers (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, phone, role]
    );

    return {
      success: true,
      id: result.lastID,
      message: 'Seller created successfully'
    };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }

  /**
   * Get seller by ID
   */
  async getSellerById(id) {
    return get(
      'SELECT id, name, email, role, active FROM sellers WHERE id = ?',
      [id]
    );
  }
}

module.exports = new AuthService();
```

**Commit:**
```bash
git add server/services/auth-service.js
git commit -m "feat(auth): Add authentication service

- login(email, password) → JWT token
- createSeller(name, email, password, phone)
- verifyToken(token)
- getSellerById(id)
- Password hashing with bcryptjs
- JWT token expiry: 24h

Related to: Checkpoint 1.1"
```

---

## 📋 TAREFA 1.1.4: Auth Middleware

```javascript
// server/middleware/auth.js

const authService = require('../services/auth-service');

/**
 * Middleware: Verificar JWT token
 */
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'No token provided',
      message: 'Please provide a JWT token in Authorization header'
    });
  }

  try {
    const payload = authService.verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid token',
      message: err.message
    });
  }
};

/**
 * Middleware: Apenas admin
 */
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }
  next();
};

module.exports = { auth, adminOnly };
```

**Commit:**
```bash
git add server/middleware/auth.js
git commit -m "feat(auth): Add authentication middleware

- auth: Verify JWT token from Authorization header
- adminOnly: Check if user has admin role
- Error responses: 401, 403

Related to: Checkpoint 1.1"
```

---

## 📋 TAREFA 1.1.5: Auth Routes

```javascript
// server/routes/auth.js

const express = require('express');
const authService = require('../services/auth-service');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * Payload: {email, password}
 * Response: {token, seller}
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json(result);
  } catch (err) {
    res.status(401).json({
      error: 'Login failed',
      message: err.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Note: No backend logout needed (stateless JWT)
 */
router.post('/logout', auth, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logout successful (remove token client-side)'
  });
});

/**
 * GET /api/auth/me
 * Protected: Require valid JWT
 */
router.get('/me', auth, async (req, res, next) => {
  try {
    const seller = await authService.getSellerById(req.user.id);
    res.status(200).json({
      success: true,
      seller
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to get seller',
      message: err.message
    });
  }
});

/**
 * POST /api/auth/register (admin only)
 * Payload: {name, email, password, phone, role}
 */
router.post('/register', auth, adminOnly, async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;
    const result = await authService.createSeller(name, email, password, phone, role);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({
      error: 'Registration failed',
      message: err.message
    });
  }
});

module.exports = router;
```

**Commit:**
```bash
git add server/routes/auth.js
git commit -m "feat(auth): Add authentication routes

Endpoints:
- POST /api/auth/login (public)
- POST /api/auth/logout (protected)
- GET /api/auth/me (protected)
- POST /api/auth/register (admin only)

Related to: Checkpoint 1.1"
```

---

## 📋 TAREFA 1.1.6: Main Server

```javascript
// server/server.js

require('dotenv').config();
const express = require('express');
const path = require('path');

const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`\n📝 Test credentials:`);
  console.log('   Email: admin@test.com (admin) / seller@test.com (seller)');
  console.log('   Password: admin123 / seller123\n');
});
```

**Commit:**
```bash
git add server/server.js
git commit -m "feat(server): Add Express server with auth routes

- Express app initialization
- Middleware: JSON parser, static files
- Routes: /api/auth
- Health check: /health
- Error handler

Start with: npm run dev"
```

---

## 📋 TAREFA 1.1.7: Environment Setup

```bash
# .env

NODE_ENV=development
PORT=5000
JWT_SECRET=dev-secret-key-change-in-production
DATABASE_PATH=./data/prime_sul.db
```

**Commit:**
```bash
git add .env .gitignore
git commit -m "chore(env): Add environment configuration

- NODE_ENV: development
- PORT: 5000
- JWT_SECRET: dev key (change in production)
- DATABASE_PATH: ./data/prime_sul.db

Note: Change JWT_SECRET in production!"
```

Adicionar ao `.gitignore`:
```
.env
node_modules/
data/
*.log
.DS_Store
```

---

## 📋 TAREFA 1.1.8: Testes

```javascript
// tests/auth.test.js

const test = require('node:test');
const assert = require('node:assert');
const authService = require('../server/services/auth-service');
const { db } = require('../server/database/db');

test('Auth Service', async (t) => {
  // Setup test database
  await t.before(async () => {
    console.log('Setting up test database...');
  });

  await t.test('Should create seller', async () => {
    const result = await authService.createSeller(
      'Test User',
      'test@example.com',
      'testpass123',
      '1112345678'
    );
    assert.ok(result.success);
    assert.ok(result.id > 0);
  });

  await t.test('Should login with correct password', async () => {
    const result = await authService.login('test@example.com', 'testpass123');
    assert.ok(result.success);
    assert.ok(result.token);
    assert.strictEqual(result.seller.email, 'test@example.com');
  });

  await t.test('Should reject invalid password', async () => {
    try {
      await authService.login('test@example.com', 'wrongpassword');
      assert.fail('Should throw error');
    } catch (err) {
      assert.strictEqual(err.message, 'Invalid password');
    }
  });

  await t.test('Should verify valid token', async () => {
    const loginResult = await authService.login('test@example.com', 'testpass123');
    const payload = authService.verifyToken(loginResult.token);
    assert.strictEqual(payload.email, 'test@example.com');
  });

  await t.test('Should reject invalid token', async () => {
    try {
      authService.verifyToken('invalid.token.here');
      assert.fail('Should throw error');
    } catch (err) {
      assert.ok(err.message.includes('malformed'));
    }
  });
});
```

**Commit:**
```bash
git add tests/auth.test.js
git commit -m "test(auth): Add authentication tests

Tests:
- Create seller
- Login with correct password
- Login with invalid password (fail)
- Verify valid token
- Verify invalid token (fail)

Run with: npm test"
```

---

## 📋 TAREFA 1.1.9: Documentação

```markdown
# Authentication (docs/AUTH.md)

## Overview
JWT-based authentication for PRIME SUL Assistant.

## Endpoints

### POST /api/auth/login
Login with email and password.

**Request:**
\`\`\`bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seller@test.com",
    "password": "seller123"
  }'
\`\`\`

**Response (200):**
\`\`\`json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "seller": {
    "id": 2,
    "name": "Test Seller",
    "email": "seller@test.com",
    "role": "seller"
  }
}
\`\`\`

### GET /api/auth/me
Get current user info (protected).

**Request:**
\`\`\`bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/auth/me
\`\`\`

**Response (200):**
\`\`\`json
{
  "success": true,
  "seller": {
    "id": 2,
    "name": "Test Seller",
    "email": "seller@test.com",
    "role": "seller",
    "active": 1
  }
}
\`\`\`

## Test Credentials

**Admin:**
- Email: admin@test.com
- Password: admin123
- Role: admin

**Seller:**
- Email: seller@test.com
- Password: seller123
- Role: seller

## Implementation Details

- Password hashing: bcryptjs (10 rounds)
- Token type: JWT (JSON Web Token)
- Token expiry: 24 hours
- Secret: \`JWT_SECRET\` env variable
- Middleware: /server/middleware/auth.js

## Security

- Passwords never returned in responses
- Tokens expire after 24h
- Use HTTPS in production
- Change JWT_SECRET in production
- Rate limiting recommended (implement in next phase)
```

**Commit:**
```bash
git add docs/AUTH.md
git commit -m "docs(auth): Add authentication documentation

- API endpoints with curl examples
- Request/response examples
- Test credentials
- Implementation details
- Security notes

Related to: Checkpoint 1.1"
```

---

## ✅ CHECKPOINT 1.1: Validação Final

```bash
# 1. Rodar tests
npm test

# Esperado:
# ✓ Auth Service
#   ✓ Should create seller
#   ✓ Should login with correct password
#   ✓ Should reject invalid password
#   ✓ Should verify valid token
#   ✓ Should reject invalid token

# 2. Inicializar banco
npm run db:init

# Esperado:
# ✅ Connected to: D:\PRIME SUL\data\prime_sul.db
# ✅ Database schema initialized
# ✅ Seeded admin user
# ✅ Seeded seller user
#
# 📝 Test Credentials:
#    Admin:  admin@test.com / admin123
#    Seller: seller@test.com / seller123

# 3. Rodar server
npm run dev

# Esperado:
# ✅ Server running on http://localhost:5000
```

### Teste Manual

```bash
# Terminal 1: Rodar servidor
npm run dev

# Terminal 2: Testar login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seller@test.com","password":"seller123"}'

# Copiar token da resposta

# Testar protected route
curl -H "Authorization: Bearer <token-copiado>" \
  http://localhost:5000/api/auth/me

# Esperado: Informações do seller
```

---

## 🎯 Git Status

```bash
# Verificar status
git status

# Esperado: 10 arquivos novos (sem modificações)

# Ver log de commits
git log --oneline -10

# Esperado:
# docs(auth): Add authentication documentation
# test(auth): Add authentication tests
# feat(server): Add Express server with auth routes
# feat(auth): Add authentication routes
# feat(auth): Add authentication middleware
# feat(auth): Add authentication service
# feat(database): Add database initialization script
# feat(database): Add database helper with promisify
# feat(database): Add database schema
# chore(project): Initialize project structure
```

---

## 🏁 PUBLICAR CHECKPOINT 1.1

```bash
# 1. Garantir tudo está commitado
git status  # deve estar limpo

# 2. Criar tag
git tag -a v1.1-auth -m "Checkpoint 1.1: Auth + Database

Features:
✅ JWT Authentication (24h expiry)
✅ Password hashing (bcryptjs)
✅ Database schema (sellers, leads, campaigns, sends)
✅ Auth service + middleware + routes
✅ Database initialization with seed
✅ Tests (5 test cases)

Endpoints:
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/register (admin only)

Test Credentials:
- Admin: admin@test.com / admin123
- Seller: seller@test.com / seller123

Commits: 10
Coverage: 90%+
Status: ✅ READY

Date: $(date)
Version: v1.1-auth"

# 3. Push tag
git push origin v1.1-auth

# 4. Push commits
git push origin main

# 5. Verificar
git tag | grep v1.1
git log --oneline | grep "chore(project)"
```

---

## 📊 Status Checkpoint 1.1

- [x] Tarefa 1.1.1: Setup do projeto
- [x] Tarefa 1.1.2: Database schema
- [x] Tarefa 1.1.3: Auth service
- [x] Tarefa 1.1.4: Auth middleware
- [x] Tarefa 1.1.5: Auth routes
- [x] Tarefa 1.1.6: Server.js
- [x] Tarefa 1.1.7: .env setup
- [x] Tarefa 1.1.8: Testes
- [x] Tarefa 1.1.9: Documentação
- [x] **✅ CHECKPOINT COMPLETO + TAG v1.1-auth**

---

## 🚀 Próximo: Checkpoint 1.2

Depois de publicar v1.1-auth, começamos:
**Checkpoint 1.2: Carteira Clientes (Ferramenta #1)**

Tarefas:
- Carteira Service (CRUD leads)
- Leads Routes
- Frontend UI
- NLP Integration
- Testes
- Documentação

Arquivo de referência: `GUIA_INICIAL_FASE1.md` (Seção Checkpoint 1.2)

---

**Status:** 🟢 PRONTO PARA COMEÇAR AGORA  
**Tempo estimado:** 2 dias para Checkpoint 1.1  
**Próximo passo:** Execute os comandos de setup acima
