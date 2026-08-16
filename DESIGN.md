# PRIME SUL — Design System Neo-Brutalista

> Reprodução do tema **Neo-Brutalista V3** do SAAS-WEB (DeliveryHub) aplicado ao CRM de crédito.

## Origem

Tema base: `SAAS-WEB/public/store/css/app-v3.css` + `index-v3.html`.
Objetivo: manter a **mesma identidade visual** no projeto PRIME SUL.

---

## Tokens de Design (CSS Variables)

```css
:root {
    --v3-ink: #181716;      /* quase preto (texto, bordas) */
    --v3-dark: #211c18;     /* hover escuro */
    --v3-cream: #fff8ed;    /* fundo de blocos */
    --v3-orange: #ff7417;   /* cor principal (CTA) */
    --v3-yellow: #ffbd16;   /* destaque / badges */
    --v3-coral: #df4632;    /* preço, acentos */
    --v3-green: #10b981;    /* sucesso */
    --v3-blue: #3b82f6;     /* info */
    --v3-font: 'Outfit', sans-serif;        /* corpo */
    --v3-font-title: 'Bebas Neue', sans-serif; /* títulos */
}
```

---

## Regras Visuais (DNA do Tema)

| Regra | Valor |
|-------|-------|
| **Fundo** | `#faf6f0` (off-white quente) |
| **Bordas** | `3px solid var(--v3-ink)`, cantos `12–20px` |
| **Sombras** | Off-set dura: `box-shadow: 4–6px 4–6px 0 var(--v3-ink)` |
| **Hover** | Elevação: `transform: translate(-3px,-3px)` + sombra maior |
| **Contraste** | Preto `#181716` sobre fundos claros; branco sobre laranja |
| **Espessura de fonte** | `700–900` (bem bold) |
| **Bordas tracejadas** | `2px dashed` para divisórias e áreas editáveis |

### Design Tokens Complementares
- **Borda de foco**: `border-color: var(--v3-orange)`
- **Badge status aberto**: fundo `#e2fbea`, texto `#12813b`
- **Badge status fechado**: fundo `#ffe5e0`, texto `#c74838`
- **CTA principal (WhatsApp)**: `#25d366` com sombra `#128c7e`

---

## Fontes

Importar no `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
```

- **Bebas Neue** → títulos, preços, números grandes (`font: 2rem/1`)
- **Outfit** → corpo, labels, botões (pesos 600–900)

---

## Componentes (mapping para o CRM)

### 1. Header / Brand Box
`v3-store-header` + `v3-header-container` (caixa branca, borda `3.5px`, sombra `6px 6px 0`).
- **Eyebrow**: label uppercase coral, `0.62rem`, letter-spacing `1.5px`.
- **Logo**: `64px`, borda preta, sombra laranja `3px 3px 0`.
- **Pills de meta**: fundo `--v3-cream`, borda preta, `border-radius: 8px`.

### 2. Barra de Busca
`v3-search-wrapper` → input com ícone à esquerda, borda `3px`, sombra `4px 4px 0`, foco muda borda p/ laranja.

### 3. Pills / Categorias (Filtros)
`v3-cat-pill` → fundo branco, borda `2.5px`, sombra `3px 3px 0`.
- Hover/ativo: fundo `--v3-dark`, texto branco, sombra laranja.

### 4. Cards
`v3-product-card` → fundo branco, borda `3px`, raio `16px`, sombra `5px 5px 0`.
- Hover: sobe `(-3px,-3px)`, sombra `7px 7px 0`.
- **Adaptação CRM**: o card de **Lead** usa o mesmo card com:
  - Nome do lead (título Bebas)
  - Telefone / origem (desc Outfit `0.76rem`, cor `#756d67`)
  - Status badge (Lead novo / Em contato / Confirmado / Concluído)
  - Ações: botão "Simular" (amarelo) e "Repassar" (laranja)

### 5. Botões
- **Primário (CTA)**: fundo `--v3-orange`, texto branco, borda `3px`, sombra `3px 3px 0`.
- **Destaque secundário**: fundo `--v3-yellow`, texto `--v3-ink`, sombra coral `2px 2px 0`.
- **WhatsApp/confirmar**: `#25d366` + sombra `#128c7e`.

### 6. Modais
`v3-modal-overlay` (fundo `rgba(24,23,22,0.7)` + blur) → `v3-modal-content`:
- borda `3.5px`, raio `22px`, sombra `10px 10px 0 var(--v3-coral)`, `width: min(640px, 94vw)`.

### 7. Drawer Lateral (Checkout / Detalhes)
`v3-cart-drawer` → `width: min(460px, 100vw)`, borda esquerda `3.5px`.
- Header com fundo cream + borda inferior.
- Footer fixo com CTA.

### 8. Formulários
`v3-input`, `v3-select`, `v3-textarea` → borda `2.5px`, raio `10px`, fonte bold.
- Labels: `0.75rem`, peso `800`.

### 9. Segmentado (Tabs)
`v3-segmented-control` → fundo cream, borda preta.
- Ativo: fundo branco, borda preta, sombra `2px 2px 0`.

### 10. Resumo / Painel
`v3-cart-summary-box` → fundo cream, borda `2.5px`, raio `14px`.
- Linha total: Bebas `1.3rem`, divisor `2px dashed`.

### 11. Banner de Destaque
`v3-banner-content` → fundo `--v3-yellow`, borda `3px`, sombra `4px 4px 0`.

---

## Layout Responsivo

```css
@media (max-width: 768px) {
    .v3-header-container { flex-direction: column; align-items: flex-start; }
    .v3-store-meta { align-items: flex-start; }
    .v3-products-grid { grid-template-columns: 1fr; }
}
```

- Grid de cards: `repeat(auto-fill, minmax(280px, 1fr))`.
- Container central: `max-width: 1200px`, `padding: 0 16px`.
- Nav sticky: `position: sticky; top: 0; z-index: 100`, fundo `rgba(250,246,240,0.95)` + blur.

---

## Mapeamento para as Telas do CRM

| Tela PRIME SUL | Componente base |
|----------------|-----------------|
| Login do vendedor | Card `v3-product-card` central + botão laranja |
| Lista de leads | Grid `v3-products-grid` de cards de lead |
| Detalhe do lead | Modal `v3-modal-content` |
| Campanhas / Disparo | Header + banner de promo + tabela estilo `v3-cart-summary-box` |
| Painel do vendedor | Header `v3-store-header` + pills de meta (leads, envios, conversões) |
| Config de números | Formulários `v3-input`/`v3-select` |
| Botão WhatsApp (repasse) | `v3-btn-checkout` verde WhatsApp |

---

## Arquivos

- `design.css` — build do design system (a partir de `app-v3.css` adaptado)
- Componentes HTML reutilizáveis por tela (header, card, modal, drawer)
- Referência de classes prefixadas `v3-` (manter padrão para consistência)

## Próximos Passos

- [ ] Gerar `design.css` no projeto PRIME SUL
- [ ] Componentes base (header, card de lead, modal, drawer)
- [ ] Tela de login do vendedor
- [ ] Tela de lista de leads (grid)
- [ ] Tela de disparo/campanha