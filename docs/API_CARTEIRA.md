# 📚 API Documentation: Carteira (Leads)

## Overview

Ferramenta #1: Gerenciamento de carteira de clientes (leads).

## Endpoints

### GET /api/leads
List leads with filters and pagination.

**Query Parameters:**
- \status\ — Filter by status (novo, enviado, sim, nao, bloqueado)
- \prioridade\ — Filter by priority (alta, media, baixa)
- \page\ — Page number (default: 1)
- \sort\ — Sort by field (name, created_at, updated_at, score, prioridade)
- \search\ — Search by name, phone, or email

**Response:**
\\\json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "pages": 5,
    "limit": 20
  }
}
\\\

### GET /api/leads/counts
Get lead counts by status.

**Response:**
\\\json
{
  "success": true,
  "data": {
    "novo": 10,
    "enviado": 5,
    "sim": 2,
    "nao": 3,
    "bloqueado": 0,
    "total": 20
  }
}
\\\

### GET /api/leads/:id
Get single lead by ID.

**Response:**
\\\json
{
  "success": true,
  "data": {
    "id": "lead_123",
    "name": "João Silva",
    "phone": "11999999999",
    "email": "joao@example.com",
    "status": "novo",
    "prioridade": "alta",
    "score": 85,
    "notas": "Bom cliente",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
\\\

### POST /api/leads
Create new lead.

**Body:**
\\\json
{
  "name": "João Silva",
  "phone": "11999999999",
  "email": "joao@example.com",
  "prioridade": "alta",
  "score": 85,
  "status": "novo",
  "notas": "Bom cliente"
}
\\\

**Response:**
\\\json
{
  "success": true,
  "data": { ... },
  "message": "Lead criado com sucesso"
}
\\\

### PATCH /api/leads/:id
Update lead.

**Body:** (any field)
\\\json
{
  "status": "enviado",
  "prioridade": "media",
  "score": 90
}
\\\

**Response:**
\\\json
{
  "success": true,
  "data": { ... },
  "message": "Lead atualizado com sucesso"
}
\\\

### DELETE /api/leads/:id
Delete lead (soft delete).

**Response:**
\\\json
{
  "success": true,
  "message": "Lead deletado com sucesso"
}
\\\

## Examples

### List novo leads
\\\ash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/leads?status=novo&prioridade=alta"
\\\

### Search by name
\\\ash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/leads?search=João"
\\\

### Create lead
\\\ash
curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria",
    "phone": "11888888888",
    "prioridade": "media"
  }' \
  "http://localhost:5000/api/leads"
\\\

### Update status
\\\ash
curl -X PATCH -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "enviado"}' \
  "http://localhost:5000/api/leads/lead_123"
\\\

## Status Options

- **novo** — Lead novo, não contactado
- **enviado** — Mensagem enviada
- **sim** — Lead respondeu com interesse
- **nao** — Lead respondeu sem interesse
- **bloqueado** — Lead bloqueado (spam, não quer)

## Priority Options

- **alta** — Alta prioridade
- **media** — Média prioridade
- **baixa** — Baixa prioridade

## Error Codes

- **400** — Bad request (invalid data)
- **404** — Lead not found
- **500** — Server error
