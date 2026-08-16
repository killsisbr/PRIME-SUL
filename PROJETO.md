# PRIME SUL — CRM + Disparo de Mensagens com Bot

## Visão Geral

Sistema CRM multi-tenant (por vendedor) integrado a disparo de mensagens em massa via bot, com estratégia **anti-ban** para reduzir banimentos de números.

A empresa tem acesso e permissão do **Banco do Brasil** para oferecer crédito a leads que pediram simulação. O contato do cliente é capturado via site deles e cadastrado no CRM.

## Objetivos

- Cadastrar leads por vendedor (cada vendedor tem sua própria lista).
- Impedir duplicidade de lead entre vendedores (não aceita lead já cadastrado por outro vendedor).
- Disparar mensagens em massa com bots.
- Reduzir a taxa de banimento com números descartáveis e boas práticas.

## Estratégia Anti-Ban

### Problema
Enviar mensagens em massa a partir de um único número gera banimento do número e perda dos contatos.

### Solução
Usar **números descartáveis** como porta de entrada:

1. O **bot principal** envia a mensagem para o lead quente usando um número descartável.
2. A mensagem pergunta se pode pedir para um vendedor encaminhar uma simulação.
3. Se o cliente responder **sim** (ou confirmar de alguma forma), o bot repassa o contato para o **bot do vendedor**.
4. O bot do vendedor entra em contato e finaliza a simulação.

### Racional
- De 1.000 contatos enviados, ~30% respondem "sim".
- Se o número descartável cair, apenas os 30% interessados são trabalhados pelos vendedores.
- Reduz o risco/impacto de banimento em ~70%.
- Combinar com outras boas práticas reduz ainda mais a taxa.

## Fluxo de Trabalho

```
Captura do contato (site do cliente)
        │
        ▼
Cadastro no CRM (lista do vendedor responsável)
        │
        ▼
Regra de duplicidade: lead já cadastrado por outro vendedor é bloqueado
        │
        ▼
Bot principal (número descartável) envia msg de oferta
        │
        ▼
Lead confirma ("sim") ──► Repasse para o bot do vendedor
        │
        ▼
Bot do vendedor contata e finaliza a simulação
```

## Funcionalidades Principais

### Multi-Tenant por Vendedor
- Cada vendedor possui seu login e sua lista de leads.
- Cada vendedor tem **X números** para cadastro/disparo.
- Isolamento total de dados entre vendedores.

### Cadastro de Leads
- Importação/entrada manual do contato.
- Validação de duplicidade global (não permite mesmo lead em dois vendedores).
- Status do lead: novo, em contato, confirmado, concluído.

### Disparo em Massa (Bot)
- Números descartáveis por campanha/lote.
- Mensagem de oferta padronizada.
- Detecção de confirmação (sim/ok/1 etc.).
- Repasse automático ao bot do vendedor.

### Painel
- Visão por vendedor: leads, envios, respostas, taxas de conversão.

## Stack Sugerida (a definir)

- Backend: Node.js (NestJS/Express) ou Python (FastAPI)
- Frontend: React/Next.js
- Banco: PostgreSQL
- Bot: Evolucy/WPPConnect/Baileys (WhatsApp)
- Fila: Redis/Bull (para disparo em massa)

## Próximos Passos

- [ ] Validar stack e arquitetura
- [ ] Modelagem do banco (vendedor, lead, campanha, numero, envio)
- [ ] Regras de negócio de duplicidade
- [ ] Integração com API do WhatsApp (bot)
- [ ] Fluxo anti-ban (número descartável → confirmação → repasse)
- [ ] Painel administrativo e de vendedor