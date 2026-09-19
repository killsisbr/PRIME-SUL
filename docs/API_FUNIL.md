# 📊 API Documentation: Funil de Vendas

## Overview

Ferramenta #2: Análise e gestão de funil de vendas com detecção de gargalos, previsões e sugestões.

## Endpoints

### GET /api/funnel
Obter funil completo com conversões.

**Response:**
```json
{
  "success": true,
  "data": {
    "funnel": [
      {
        "status": "novo",
        "displayName": "Novo",
        "order": 1,
        "color": "#e3f2fd",
        "count": 50,
        "percentage": 100,
        "conversionRate": 0,
        "conversionFrom": null
      },
      {
        "status": "enviado",
        "displayName": "Enviado",
        "order": 2,
        "color": "#fff3e0",
        "count": 40,
        "percentage": 80,
        "conversionRate": 80,
        "conversionFrom": "novo"
      },
      ...
    ],
    "totals": {
      "novo": 50,
      "enviado": 40,
      "sim": 10,
      "nao": 5,
      "bloqueado": 2
    },
    "totalLeads": 107,
    "conversions": 15,
    "conversionRate": 14,
    "bottleneck": {
      "stage": "sim",
      "displayName": "Sim",
      "fromStage": "enviado",
      "dropPercentage": 75,
      "conversionRate": 25,
      "severity": "critica"
    }
  }
}
```

### GET /api/funnel/stage/:status
Obter métricas de um estágio específico.

**Parameters:**
- `status` — novo, enviado, sim, nao, bloqueado

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "novo",
    "total": 50,
    "avgScore": 65,
    "avgDaysInStage": 3,
    "priorities": {
      "alta": 15,
      "media": 25,
      "baixa": 10
    }
  }
}
```

### GET /api/funnel/suggestions
Obter sugestões de ações baseadas no funil.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "bottleneck",
      "severity": "critica",
      "title": "Gargalo detectado em Sim",
      "description": "25% dos leads em enviado progridem para sim",
      "action": "Revisar processo de conversão",
      "priority": 1
    },
    {
      "type": "low_conversion",
      "severity": "alta",
      "title": "Taxa de conversão baixa",
      "description": "Apenas 14% dos leads estão sendo convertidos",
      "action": "Revisar estratégia de vendas",
      "priority": 2
    },
    ...
  ]
}
```

### GET /api/funnel/compare
Comparar funil com período anterior.

**Query Parameters:**
- `days` — Comparar com X dias atrás (1-90, default: 7)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "Últimos 7 dias",
    "comparison": {
      "novo": {
        "current": 50,
        "past": 45,
        "delta": 5,
        "deltaPercent": 11
      },
      "enviado": {
        "current": 40,
        "past": 38,
        "delta": 2,
        "deltaPercent": 5
      },
      ...
    }
  }
}
```

### GET /api/funnel/history
Obter histórico de progressão de leads.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "lead_123",
      "name": "João Silva",
      "status": "sim",
      "score": 85,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-18T14:20:00Z",
      "daysInFunnel": 3
    },
    ...
  ]
}
```

### POST /api/funnel/predict/:leadId
Prever próximo estágio de um lead.

**Response:**
```json
{
  "success": true,
  "data": {
    "lead": {
      "id": "lead_123",
      "name": "João Silva",
      "status": "novo",
      "score": 85
    },
    "prediction": {
      "predictedStage": "enviado",
      "currentStage": "novo",
      "confidence": 85,
      "reason": "Próximo estágio esperado baseado em score",
      "recommendation": "Dispare uma mensagem de acompanhamento"
    }
  }
}
```

## Stages (Estágios)

| Status | Ordem | Descrição |
|--------|-------|-----------|
| novo | 1 | Lead novo, não contactado |
| enviado | 2 | Mensagem enviada |
| sim | 3 | Lead respondeu com interesse |
| nao | 4 | Lead respondeu sem interesse |
| bloqueado | 5 | Lead bloqueado |

## Metrics & Analytics

### Conversion Rate (Taxa de Conversão)
Percentual de leads que progridem de um estágio para outro.

```
Taxa = (Leads no estágio n / Leads no estágio n-1) × 100
```

### Bottleneck Detection (Detecção de Gargalo)
Identifica o estágio com maior queda de conversão.

```
Severidade:
- Crítica: > 60% queda
- Alta: 40-60% queda
- Média: 20-40% queda
- Baixa: < 20% queda
```

### Prediction (Previsão)
Algoritmo simples baseado em score e histórico.

```
Próximo estágio = função(status_atual, score, histórico)
Confiança = 60-85% (ajustado por score)
```

## Examples

### Obter funil completo
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/funnel
```

### Métricas do estágio "novo"
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/funnel/stage/novo
```

### Sugestões de ação
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/funnel/suggestions
```

### Comparar com últimos 30 dias
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/funnel/compare?days=30"
```

### Prever próximo estágio
```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/funnel/predict/lead_123
```

## Error Handling

- **400** — Bad request (invalid status)
- **404** — Lead not found
- **500** — Server error

## Best Practices

1. **Monitor Bottlenecks** — Revise processos quando gargalo é detectado
2. **Act on Suggestions** — Use sugestões para otimizar funil
3. **Track History** — Monitore progressão de leads
4. **Compare Periods** — Identifique tendências
5. **Use Predictions** — Priorize leads com alta confiança de conversão
