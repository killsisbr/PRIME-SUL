# 🚀 CHECKPOINT 1.2: Carteira Clientes (Ferramenta #1)

## 📍 Status

- ✅ **Checkpoint 1.1** CONCLUÍDO (v1.1-auth publicado)
- 🔄 **Checkpoint 1.2** INICIANDO AGORA
- ⏳ Checkpoints 1.3-1.4 (próximos)

**Timeline:** 2 dias de desenvolvimento (Dia 3-4 de 14)

---

## 🎯 Objetivo

Implementar a **Ferramenta #1: Carteira de Clientes** com:
- CRUD de leads (Create, Read, Update, Delete)
- Filtros avançados (status, prioridade, data, busca)
- UI card flutuante + popup
- NLP integration (intent detection)
- Testes unitários
- Documentação completa

---

## 📋 TAREFA 1.2.1: Carteira Service

Criar `server/services/carteira-service.js` com métodos:

```javascript
class CarteiraService {
  async listLeads(sellerId, filters = {}) // GET with pagination
  async createLead(sellerId, data) // INSERT new lead
  async getLead(sellerId, leadId) // GET single lead
  async updateLead(sellerId, leadId, data) // UPDATE lead
  async deleteLead(sellerId, leadId) // DELETE lead
  async countsBySeller(sellerId) // COUNT by status
  async search(sellerId, query) // SEARCH by name/phone
}
```

**Commit message:**
```
feat(carteira): Implement lead management service

- listLeads(sellerId, filters) - List with pagination (20 per page)
- createLead(sellerId, data) - Create with validation
- getLead(sellerId, leadId) - Get single lead
- updateLead(sellerId, leadId, data) - Update with timestamp
- deleteLead(sellerId, leadId) - Soft delete (optional)
- countsBySeller(sellerId) - Count by status
- search(sellerId, query) - Search by name/phone/email

Filters supported:
- status (novo, enviado, sim, nao, bloqueado)
- prioridade (alta, media, baixa)
- createdAt (date range)
- sortBy (name, created_at, score)

Related to: Checkpoint 1.2
```

---

## 📋 TAREFA 1.2.2: Leads Routes

Criar `server/routes/leads.js` com endpoints:

```javascript
// GET /api/leads
router.get('/', auth, async (req, res) => {
  // List leads with filters
  // Query params: status, prioridade, page, sort
})

// GET /api/leads/counts
router.get('/counts', auth, async (req, res) => {
  // Get counts by status (novo: 5, enviado: 3, ...)
})

// GET /api/leads/:id
router.get('/:id', auth, async (req, res) => {
  // Get single lead
})

// POST /api/leads
router.post('/', auth, async (req, res) => {
  // Create new lead
  // Body: {name, phone, email, prioridade}
})

// PATCH /api/leads/:id
router.patch('/:id', auth, async (req, res) => {
  // Update lead
  // Body: {status, prioridade, score}
})

// DELETE /api/leads/:id
router.delete('/:id', auth, async (req, res) => {
  // Delete lead
})
```

**Commit message:**
```
feat(carteira): Add leads HTTP routes

Endpoints:
- GET /api/leads - List with filters (status, prioridade, pagination)
- GET /api/leads/counts - Get counts by status
- GET /api/leads/:id - Get single lead (protected)
- POST /api/leads - Create lead (protected)
- PATCH /api/leads/:id - Update lead (protected)
- DELETE /api/leads/:id - Delete lead (protected)

Query parameters:
- status: filter by status
- prioridade: filter by priority
- page: pagination (default 1, 20 per page)
- sort: order by field
- search: search by name/phone/email

All endpoints require JWT token (seller_id extracted from token).

Related to: Checkpoint 1.2
```

---

## 📋 TAREFA 1.2.3: Frontend UI

Create `public/js/carteira-card.js`:

```javascript
class CarteiraCard {
  constructor() {
    this.container = '#assistant-popup'
    this.leads = []
    this.page = 1
  }

  async render() {
    // Render card component
    // List leads table
    // Pagination controls
    // Add lead button
  }

  async loadLeads(filters = {}) {
    // Fetch /api/leads with filters
  }

  async refreshCounts() {
    // Fetch /api/leads/counts
    // Update badge
  }
}
```

Create `public/css/carteira.css`:

```css
/* Neo-Brutalista design */
.carteira-card {
  border: 3px solid var(--v3-ink);
  box-shadow: 8px 8px 0 rgba(0,0,0,0.15);
  background: white;
  padding: 20px;
}

.carteira-table {
  width: 100%;
  border-collapse: collapse;
}

.carteira-table td {
  border-bottom: 2px solid var(--v3-orange);
  padding: 12px;
}

.badge {
  background: var(--v3-yellow);
  border: 2px solid var(--v3-ink);
  border-radius: 0;
  padding: 4px 8px;
  font-weight: 600;
}
```

**Commit message:**
```
feat(carteira): Add frontend UI for lead management

- Create carteira-card.js component
- Render leads table with pagination
- Filters: status, prioridade, search
- Actions: add lead, edit, delete
- Real-time counts badge

Create carteira.css with Neo-Brutalista design:
- 3px borders (duro)
- Offset shadows (8px 8px)
- Bold typography (Bebas Neue)
- Outfit for body text

Integration with assistant popup.

Related to: Checkpoint 1.2
```

---

## 📋 TAREFA 1.2.4: NLP Integration

Add to `server/services/nlp-service.js` (or create if needed):

```javascript
// Intent patterns for carteira
const CARTEIRA_INTENTS = {
  list_leads: /^(me\s+)?mostra(.*)?meus\s+leads|carteira|contatos/i,
  search_lead: /busca(\s+|:\s*)(.*?)(por|telefone|email)/i,
  filter_leads: /filtra.*?(novo|enviado|sim|nao)/i,
  create_lead: /novo\s+lead|cadastra(.*)?contato|adiciona.*?contato/i,
  update_lead_status: /marca(\s+|:\s*)?(.+)\s+(como\s+)?(novo|enviado|sim|nao)/i,
}

// Responses
const CARTEIRA_RESPONSES = {
  list_leads: "Você tem {count} leads no total. {breakdown}",
  search_lead: "Encontrei {count} leads com '{query}'.",
  filter_leads: "Mostrando {count} leads com status '{status}'.",
}
```

Create `server/services/tool-executor.js` to execute carteira actions:

```javascript
async function executeTool(toolName, intent, context) {
  if (toolName === 'carteira') {
    switch (intent) {
      case 'list_leads':
        return await carteiraService.listLeads(context.seller_id)
      case 'search_lead':
        return await carteiraService.search(context.seller_id, context.query)
      case 'filter_leads':
        return await carteiraService.listLeads(context.seller_id, {
          status: context.status
        })
      // ...
    }
  }
}
```

**Commit message:**
```
feat(carteira): Add NLP integration for intent detection

- Register carteira intents in NLP service
- Patterns for: list_leads, search_lead, filter_leads, create_lead
- Intent parser with regex matching
- Tool executor for carteira actions
- Context extraction (seller_id, filters, query)

Example intents:
- "Mostra meus leads"
- "Busca um cliente por telefone"
- "Filtra leads novos"
- "Quantos contatos tenho?"

Responses:
- Conversational replies with counts and summaries
- Action suggestions (criar campanha, etc)

Related to: Checkpoint 1.2
```

---

## 📋 TAREFA 1.2.5: Tests

Create `tests/carteira.test.js`:

```javascript
test('Carteira Service', async (t) => {
  await t.test('Should list leads with pagination', async () => {
    const result = await carteiraService.listLeads(1, { page: 1 })
    assert.ok(Array.isArray(result.leads))
    assert.ok(result.pagination)
  })

  await t.test('Should create lead with validation', async () => {
    const result = await carteiraService.createLead(1, {
      name: 'Test Lead',
      phone: '1198765432',
      email: 'test@example.com'
    })
    assert.ok(result.id > 0)
  })

  await t.test('Should filter leads by status', async () => {
    const result = await carteiraService.listLeads(1, { status: 'novo' })
    assert.ok(result.leads.every(l => l.status === 'novo'))
  })

  await t.test('Should search leads', async () => {
    const result = await carteiraService.search(1, 'john')
    assert.ok(Array.isArray(result))
  })

  await t.test('Should update lead status', async () => {
    const result = await carteiraService.updateLead(1, 1, { status: 'enviado' })
    assert.strictEqual(result.status, 'enviado')
  })

  await t.test('Should get counts by seller', async () => {
    const result = await carteiraService.countsBySeller(1)
    assert.ok(result.novo >= 0)
    assert.ok(result.enviado >= 0)
  })
})
```

**Commit message:**
```
test(carteira): Add comprehensive carteira tests

Tests (85%+ coverage):
- List leads with pagination
- Create lead with validation
- Filter leads by status/priority
- Search leads by name/phone
- Update lead status
- Get counts by status
- Soft delete lead
- Date range filtering

All tests use test database.
Run with: npm test

Related to: Checkpoint 1.2
```

---

## 📋 TAREFA 1.2.6: Documentation

Create `docs/CARTEIRA.md`:

```markdown
# Carteira de Clientes — Checkpoint 1.2

## Overview

Lead management system with filtering, search, and real-time counts.

## Endpoints

### GET /api/leads

List leads with filters and pagination.

**Query Parameters:**
- `status` - Filter by status (novo, enviado, sim, nao, bloqueado)
- `prioridade` - Filter by priority (alta, media, baixa)
- `page` - Page number (default 1)
- `search` - Search by name/phone/email
- `sort` - Sort field (name, created_at, score)

**Response:**
```json
{
  "leads": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

### GET /api/leads/counts

Get counts by status.

**Response:**
```json
{
  "novo": 50,
  "enviado": 30,
  "sim": 15,
  "nao": 20,
  "bloqueado": 35
}
```

### POST /api/leads

Create new lead.

**Body:**
```json
{
  "name": "John Doe",
  "phone": "1198765432",
  "email": "john@example.com",
  "prioridade": "alta"
}
```

### PATCH /api/leads/:id

Update lead.

**Body:**
```json
{
  "status": "enviado",
  "prioridade": "media",
  "score": 85
}
```

---

## Usage Example

### List all new leads

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/leads?status=novo&sort=created_at"
```

### Search lead

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/leads?search=john"
```

### Create lead

```bash
curl -X POST http://localhost:5000/api/leads \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "phone": "1187654321",
    "email": "jane@example.com",
    "prioridade": "alta"
  }'
```

---

## NLP Intents

The assistant understands:

- "Mostra meus leads" → List all
- "Quantos leads tenho?" → Show counts
- "Busca um lead novo" → Filter by status
- "Filtra por prioridade alta" → Filter by priority
- "Cadastra um novo contato" → Create lead

---

## Files

- `server/services/carteira-service.js` - Business logic
- `server/routes/leads.js` - HTTP endpoints
- `public/js/carteira-card.js` - UI component
- `public/css/carteira.css` - Styles
- `server/services/nlp-service.js` - Intent detection
- `server/services/tool-executor.js` - Tool execution
- `tests/carteira.test.js` - Unit tests
```

**Commit message:**
```
docs(carteira): Add carteira documentation

- API endpoints with examples
- Query parameters and filters
- Request/response formats
- NLP intents and examples
- Usage examples with curl
- File structure

Related to: Checkpoint 1.2
```

---

## 🔄 Commits Summary

**Checkpoint 1.2 expects these commits:**

1. `feat(carteira): Implement lead management service`
2. `feat(carteira): Add leads HTTP routes`
3. `feat(carteira): Add frontend UI for lead management`
4. `feat(carteira): Add NLP integration for intent detection`
5. `test(carteira): Add comprehensive carteira tests`
6. `docs(carteira): Add carteira documentation`

**Total:** 6 commits
**Time estimate:** 2 days
**Tag:** v1.2-carteira

---

## 📊 Validation Checklist

Before committing, verify:

- [ ] All CRUD operations work
- [ ] Pagination works (20 per page)
- [ ] Filters work (status, prioridade, date)
- [ ] Search works (name/phone/email)
- [ ] UI renders correctly
- [ ] Tests pass (npm test)
- [ ] No lint errors (npm run lint)
- [ ] Documentation complete
- [ ] All endpoints respond < 200ms

---

## 🎯 After Completion

1. Create tag: `git tag v1.2-carteira`
2. Push tag: `git push origin v1.2-carteira`
3. Celebrate! 🎉
4. Move to **Checkpoint 1.3: Funil Vendas**

---

**Status:** 🟢 READY TO START  
**Next:** Begin Tarefa 1.2.1 (Carteira Service)
