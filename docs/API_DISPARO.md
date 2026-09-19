# 📤 API Documentation: Disparo Comercial

## Overview

Ferramenta #3: Gerenciar campanhas de envio com marketing elaborado (preview, scheduler, status tracking).

## Endpoints

### GET /api/disparo
Listar campanhas do vendedor.

**Query Parameters:**
- `status` — Filtrar por status (draft, active, paused, completed)
- `page` — Número da página (default: 1)
- `sort` — Ordenar por campo (created_at, updated_at, scheduled_at, name)

**Response:**
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": "campaign_1234567890",
        "seller_id": "seller_001",
        "name": "Campanha Teste",
        "message": "Olá {nome}!",
        "status": "draft",
        "targetFilter": { "status": "novo" },
        "templateVars": {},
        "stats": {
          "total": 50,
          "sent": 0,
          "delivered": 0,
          "failed": 0,
          "deliveryRate": 0,
          "readRate": 0
        },
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "pages": 1,
      "limit": 20
    }
  }
}
```

### POST /api/disparo
Criar nova campanha.

**Body:**
```json
{
  "name": "Oferta Black Friday",
  "message": "Olá {primeiro_nome}! Temos uma oferta especial de {desconto}%",
  "targetFilter": {
    "status": "novo",
    "prioridade": "alta"
  },
  "templateVars": {
    "{desconto}": "30"
  },
  "scheduledAt": "2024-01-20T14:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Campanha criada com sucesso"
}
```

### GET /api/disparo/:id
Obter detalhes de uma campanha.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "campaign_1234567890",
    "name": "Campanha Teste",
    "message": "Olá {nome}!",
    "status": "active",
    "targetFilter": { "status": "novo" },
    "stats": {
      "total": 50,
      "sent": 40,
      "delivered": 35,
      "failed": 5,
      "read": 20,
      "clicked": 5,
      "deliveryRate": 87,
      "readRate": 57,
      "failureRate": 10
    },
    "created_at": "2024-01-15T10:30:00Z",
    "started_at": "2024-01-16T09:00:00Z"
  }
}
```

### PATCH /api/disparo/:id
Atualizar status da campanha (pausar ou cancelar).

**Body:**
```json
{
  "action": "pause"
}
```

**Ações válidas:**
- `pause` — Pausar campanha ativa
- `cancel` — Cancelar campanha

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Campanha paused com sucesso"
}
```

### POST /api/disparo/:id/start
Iniciar campanha (enviar para leads no público-alvo).

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Campanha iniciada com sucesso"
}
```

### POST /api/disparo/:id/preview
Gerar preview de mensagem com variáveis substituídas.

**Body:**
```json
{
  "leadId": "lead_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Olá {primeiro_nome}! Temos uma oferta especial",
    "preview": "Olá João! Temos uma oferta especial",
    "lead": {
      "id": "lead_123",
      "name": "João Silva",
      "phone": "11999999999"
    }
  }
}
```

## Campaign Status

| Status | Descrição |
|--------|-----------|
| `draft` | Rascunho, não iniciada |
| `active` | Enviando mensagens |
| `paused` | Pausada (pode retomar) |
| `completed` | Finalizada |
| `canceled` | Cancelada |

## Target Filter

Filtros para selecionar público-alvo:

```json
{
  "status": "novo",        // novo, enviado, sim, nao, bloqueado
  "prioridade": "alta"     // alta, media, baixa
}
```

## Template Variables

Variáveis disponíveis para substituir na mensagem:

- `{nome}` — Nome completo do lead
- `{primeiro_nome}` — Primeiro nome apenas
- `{telefone}` — Telefone do lead
- `{email}` — Email do lead
- `{status}` — Status atual do lead
- `{prioridade}` — Prioridade do lead
- `{score}` — Score do lead

Variáveis customizadas podem ser adicionadas em `templateVars`.

## Examples

### Criar campanha para leads novos
```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Boas-vindas",
    "message": "Olá {primeiro_nome}! Bem-vindo ao PRIME SUL",
    "targetFilter": { "status": "novo" }
  }' \
  http://localhost:5000/api/disparo
```

### Iniciar campanha
```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/disparo/campaign_123/start
```

### Preview antes de enviar
```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"leadId": "lead_456"}' \
  http://localhost:5000/api/disparo/campaign_123/preview
```

### Pausar campanha
```bash
curl -X PATCH -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "pause"}' \
  http://localhost:5000/api/disparo/campaign_123
```

### Listar campanhas ativas
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/disparo?status=active"
```

## Statistics

As estatísticas são atualizadas em tempo real conforme mensagens são enviadas:

- **Total** — Número de leads no público-alvo
- **Sent** — Mensagens enviadas
- **Delivered** — Mensagens entregues
- **Failed** — Falhas no envio
- **Read** — Mensagens lidas
- **Clicked** — Links clicados
- **Delivery Rate** — % de mensagens entregues
- **Read Rate** — % de mensagens lidas (do entregue)
- **Failure Rate** — % de falhas

## Error Codes

- **400** — Bad request (dados inválidos)
- **404** — Campanha não encontrada
- **500** — Server error

## Best Practices

1. **Always Preview** — Use `/preview` antes de iniciar
2. **Use Filters** — Segmente bem o público-alvo
3. **Template Vars** — Personalize as mensagens
4. **Monitor Stats** — Verifique delivery e read rates
5. **Pause if Needed** — Pause se detectar problemas
6. **Schedule** — Use agendamento para horários estratégicos
