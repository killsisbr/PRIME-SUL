# INTEGRAÇÃO: IA Gemini + Assistente Conversacional

## 🔗 Como a Ferramenta Gemini se Integra ao Assistente

A ferramenta de **IA com Visão** funciona como uma **9ª ferramenta do Assistente**, oferecendo capacidades visual + geração de conteúdo.

---

## 📊 Nova Matriz de Ferramentas (9 Total)

| # | Ferramenta | Descrição | Criticidade | OAuth? |
|---|-----------|-----------|------------|--------|
| 1️⃣ | Carteira Clientes | Ver/filtrar leads | 🔴 Crítica | ❌ |
| 2️⃣ | Funil Vendas | Análise de conversão | 🔴 Crítica | ❌ |
| 3️⃣ | Disparo Comercial | Campanhas em massa | 🔴 Crítica | ❌ |
| 4️⃣ | Meu WhatsApp | Chats pessoais | 🔴 Crítica | ❌ |
| 5️⃣ | Anti-Ban | Números descartáveis | 🟡 Secundária | ❌ |
| 6️⃣ | Templates | Mensagens + A/B | 🟡 Secundária | ❌ |
| 7️⃣ | Alertas Real-time | Notificações | 🟡 Secundária | ❌ |
| 8️⃣ | Insights IA | Sugestões (ML) | 🟡 Secundária | ❌ |
| **9️⃣** | **IA Gemini Vision** | **Análise + Geração de imagens** | **🟡 Secundária** | **✅ OAuth** |

---

## 🎯 Fluxo de Uso: Integração Completa

### **Cenário: Operador cria banner com IA**

```
┌─────────────────────────────────────────────────────────┐
│ PAINEL DO OPERADOR                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Carteira] [Funil] [Campanhas] [Config] [Assistente] │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ASSISTENTE IA (Card)                              │ │
│  ├───────────────────────────────────────────────────┤ │
│  │                                                   │ │
│  │ Operador: "Preciso de um banner pra campanha BB" │ │
│  │                                                   │ │
│  │ [Input chat]                                  [→] │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  [Clica enviar]                                         │
│        ↓                                                │
│  ┌───────────────────────────────────────────────────┐ │
│  │ POPUP FLUTUANTE (Resposta IA)                     │ │
│  ├───────────────────────────────────────────────────┤ │
│  │                                                   │ │
│  │ IA: "Vou ajudar! Tenho 2 opções:                 │ │
│  │                                                   │ │
│  │ 1️⃣ ANALISAR imagem existente                     │ │
│  │    [Você tem um template?]                        │ │
│  │                                                   │ │
│  │ 2️⃣ GERAR novo banner                             │ │
│  │    [Com 2 referências + estilo]                   │ │
│  │                                                   │ │
│  │ 📌 Nota: Precisa OAuth desativado. Quer         │ │
│  │    [Desbloquear com Google]?"                     │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  [Clica: Desbloquear com Google]                       │
│        ↓                                                │
│  ┌───────────────────────────────────────────────────┐ │
│  │ OAUTH DIALOG                                      │ │
│  ├───────────────────────────────────────────────────┤ │
│  │                                                   │ │
│  │ [Redirecionado para Google OAuth]                 │ │
│  │ Operador faz login com Google...                  │ │
│  │ ✅ Autoriza acesso                               │ │
│  │ ✅ Token recebido                                │ │
│  │ ✅ Retorna ao painel                             │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ✅ DESBLOQUEADO: Ferramenta IA Gemini Vision         │
│                                                         │
│  [Continua o chat...]                                  │
│        ↓                                                │
│  ┌───────────────────────────────────────────────────┐ │
│  │ POPUP: Upload de Imagens                          │ │
│  ├───────────────────────────────────────────────────┤ │
│  │                                                   │ │
│  │ IA: "Legal! Agora envie 2 imagens de             │ │
│  │ referência:                                       │ │
│  │                                                   │ │
│  │ 1️⃣ Logo/Template                                 │ │
│  │ 2️⃣ Tema/Estilo                                   │ │
│  │                                                   │ │
│  │ Pode fazer Ctrl+V ou clica para upload"          │ │
│  │                                                   │ │
│  │ [Adicionar Imagem]                                │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Operador: Ctrl+V (Cola logo do BB)                    │
│        ↓                                                │
│  ✅ UPLOAD: Logo salvo em users/5/images/originals/   │
│     └─ logo_bb.png (245 KB)                            │
│     └─ IA analisa: "Logo oficial Banco do Brasil"     │
│                                                         │
│  Operador: Ctrl+V (Cola tema promocional)              │
│        ↓                                                │
│  ✅ UPLOAD: Tema salvo em users/5/images/originals/   │
│     └─ theme_promo.jpg (512 KB)                        │
│     └─ IA analisa: "Tema tropical, vibrante"          │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ POPUP: Render Select (Escolher Estilo)           │ │
│  ├───────────────────────────────────────────────────┤ │
│  │                                                   │ │
│  │ IA: "Qual estilo você quer?                       │ │
│  │                                                   │ │
│  │ ○ 📸 Foto Realista                                │ │
│  │   Fotografia profissional 4K                       │ │
│  │                                                   │ │
│  │ ● 🎨 Ilustração Vetorial                          │ │
│  │   Arte vetorial moderna e clean                   │ │
│  │                                                   │ │
│  │ ○ 🎬 Cartoon/Anime                                │ │
│  │   Estilo cartoon vibrante                          │ │
│  │                                                   │ │
│  │ ○ 🖼️ Arte Digital                                │ │
│  │   Pintura digital com textura                      │ │
│  │                                                   │ │
│  │ [🚀 Gerar Imagem]"                                │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Operador: Seleciona "🎨 Ilustração Vetorial"         │
│  Operador: Clica [🚀 Gerar Imagem]                     │
│        ↓                                                │
│  ⏳ PROCESSANDO... (45-60 segundos)                    │
│     └─ Gemini 3.8 processando 2 imagens               │
│     └─ Gerando banner com estilo vetorial              │
│        ↓                                                │
│  ┌───────────────────────────────────────────────────┐ │
│  │ RESULTADO: Banner Gerado!                         │ │
│  ├───────────────────────────────────────────────────┤ │
│  │                                                   │ │
│  │ ✅ SUCESSO!                                       │ │
│  │                                                   │ │
│  │ [IMAGEM GERADA PREVIEW]                           │ │
│  │ Banner moderno, logo + tema combinados            │ │
│  │                                                   │ │
│  │ 💾 Salvo em:                                      │ │
│  │ users/5/images/generated/                          │ │
│  │   └─ 2024-01-15_banner_001.png                    │ │
│  │                                                   │ │
│  │ ⏱️ Tempo: 52 segundos                              │ │
│  │ 📊 Qualidade: 2048x1024                            │ │
│  │ 🎨 Estilo: Vetorial Clean                          │ │
│  │                                                   │ │
│  │ [Gerar Variação] [Download] [Usar em Campanha]   │ │
│  │ [Refinar] [Re-gerar] [Salvar na Biblioteca]       │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Operador: Clica [Usar em Campanha]                    │
│        ↓                                                │
│  ✅ Redirecionado para Ferramenta #3 (Disparo)         │
│     └─ Campanha de BB                                  │
│     └─ Imagem: banner_001.png (já selecionada)        │
│     └─ Operador dispara para 500 leads                │
│                                                         │
│  ✅ RESULTADO FINAL: Campanha com Banner Gerado!      │
│     └─ Banner foi criado em 5 min com IA              │
│     └─ Sem photoshop/design manual                    │
│     └─ Pronto para disparar!                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔌 Integração de Endpoints

### **Fluxo de Requisições**

```
┌─ ASSISTENTE (Chat)
│
├─ Intent: "gerar banner"
│
├─ IA Detecta: SUGGEST_ACTION + IMAGE_GENERATION
│
├─ Chama Ferramenta #9: IA Gemini Vision
│
└─ Faz 5 Chamadas API:

   1️⃣ POST /api/oauth/authorize (se não OAuth)
      └─ Redireciona para Google
      
   2️⃣ POST /api/images/upload (Imagem 1)
      └─ Ctrl+V → Logo
      └─ Response: {image_id: "img_1", url, analysis}
      
   3️⃣ POST /api/images/upload (Imagem 2)
      └─ Ctrl+V → Tema
      └─ Response: {image_id: "img_2", url, analysis}
      
   4️⃣ POST /api/images/generate
      ├─ Body: {ref1: "img_1", ref2: "img_2", style: "vector"}
      └─ Response: {image_id: "img_gen_1", url, time: "52s"}
      
   5️⃣ POST /api/campaigns (Integração com Disparo)
      ├─ Usa imagem gerada: "img_gen_1"
      └─ Cria campanha com banner novo
```

---

## 💬 Diálogos de Exemplo (No Assistente)

### **Exemplo 1: Operador pede análise**

```
OPERADOR: "Analisa essa imagem de email template"
          [Cola screenshot com Ctrl+V]

ASSISTENTE:
"📷 Imagem recebida: template_email.png

❌ Nota: Preciso de OAuth para análise com IA
   [Desbloquear com Google]"

[Operador clica OAuth]

"✅ Autorizado! Analisando...

ANÁLISE:
• Layout: 1 coluna, margem 20px
• Cores: Laranja #ff7417, Branco #fff
• CTA: Botão [Solicitar Crédito] em destaque
• Tipografia: Outfit Bold para títulos
• Imagens: Logo BB 64x64px no topo

PROBLEMAS DETECTADOS:
⚠️ CTA muito pequeno (precisa 60px mín)
⚠️ Sem versão mobile responsiva
⚠️ Falta de espaço entre seções

SUGESTÕES:
✅ Aumentar padding do CTA
✅ Adicionar media queries
✅ Testar A/B com cores diferentes"

[Gerar Variação com Estilo Diferente]
[Salvar Análise]
[Usar em Campanha]
```

### **Exemplo 2: Gerar 3 variações**

```
OPERADOR: "Gera 3 versões dessa imagem com estilos diferentes"
          [Cola imagem + ref2]

ASSISTENTE:
"🎨 Vou gerar 3 variações para A/B testing!

Escolha os estilos:
1️⃣ [Selecionar] → 📸 Foto Realista
2️⃣ [Selecionar] → 🎨 Vetorial
3️⃣ [Selecionar] → 🎬 Cartoon

[Gerar 3 Variações]"

[Operador confirma]

"⏳ Gerando 3 imagens... (2-3 minutos)

✅ Variação 1 (Foto): 
   users/5/images/generated/variant_photo_001.png

✅ Variação 2 (Vetorial):
   users/5/images/generated/variant_vector_001.png

✅ Variação 3 (Cartoon):
   users/5/images/generated/variant_cartoon_001.png

COMPARAR:
[Lado a Lado] [Melhor para Campanha] [Re-gerar Estilo X]"
```

### **Exemplo 3: Iteração + Refinamento**

```
OPERADOR: "Ó gerada não ficou boa. Refina o estilo"

ASSISTENTE:
"Entendi! Vou refinar a imagem anterior.

Qual ajuste você quer?
○ Mais cores vibrantes
○ Menos saturation
○ Adicionar efeito XX
○ Mudar composição
○ Tudo acima"

OPERADOR: Seleciona "Mais cores vibrantes"

ASSISTENTE:
"⏳ Gerando com cores mais vibrantes...

✅ Nova versão gerada!
   users/5/images/generated/refined_001.png

Ficou melhor? [SIM - Usar] [NÃO - Refinar Mais] [Cancelar]"
```

---

## 📱 UI/UX: Componentes Novos

### **1. OAuth Login Button (No Popup)**

```html
<div class="oauth-unlock">
  <p class="oauth-message">
    🔐 Esta ferramenta precisa de autenticação
  </p>
  
  <button class="btn-oauth-google" onclick="startOAuth()">
    <span class="oauth-icon">🔑</span>
    <span class="oauth-text">Desbloquear com Google</span>
  </button>
  
  <p class="oauth-info">
    Você só faz login uma vez.
    Usaremos sua conta Google para usar Gemini IA.
  </p>
</div>

<style>
.btn-oauth-google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 24px;
  background: white;
  color: #181716;
  border: 3px solid #181716;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 4px 4px 0 #181716;
  transition: all 0.2s;
}

.btn-oauth-google:hover {
  transform: translate(-3px, -3px);
  box-shadow: 6px 6px 0 #181716;
}
</style>
```

### **2. Image Upload Zone (Drag & Drop)**

```html
<div class="image-upload-zone" ondrop="handleDrop(event)" ondragover="handleDragOver(event)">
  <div class="upload-icon">📷</div>
  <p class="upload-text">
    Arraste imagem aqui ou <span class="upload-link">clique para upload</span>
  </p>
  <p class="upload-hint">
    ou <kbd>Ctrl+V</kbd> para colar da clipboard
  </p>
  
  <input type="file" id="file-input" style="display: none;" accept="image/*" />
</div>

<style>
.image-upload-zone {
  border: 3px dashed #ff7417;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  background: rgba(255, 116, 23, 0.05);
  transition: all 0.2s;
}

.image-upload-zone:hover,
.image-upload-zone.dragover {
  background: rgba(255, 116, 23, 0.15);
  border-color: #ff7417;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}
</style>
```

### **3. Image Preview Card**

```html
<div class="image-preview-card">
  <img src="..." alt="Preview" class="preview-image">
  
  <div class="preview-info">
    <p class="preview-name">logo_bb.png</p>
    <p class="preview-size">245 KB • 1920x1080px</p>
    <p class="preview-analysis">
      ✅ Logo oficial Banco do Brasil, cores azul + branco
    </p>
  </div>
  
  <div class="preview-actions">
    <button class="btn-use" onclick="selectAsRef1()">Usar como Ref 1</button>
    <button class="btn-delete" onclick="deleteImage()">❌</button>
  </div>
</div>
```

### **4. Render Select Component**

```html
<div class="render-select">
  <h3>Escolha o Estilo de Render</h3>
  
  <div class="render-grid">
    <label class="render-option">
      <input type="radio" name="render" value="photo_realistic" checked>
      <div class="render-card photo-realistic">
        <span class="icon">📸</span>
        <span class="name">Foto Realista</span>
        <span class="desc">Fotografia profissional 4K</span>
      </div>
    </label>
    
    <label class="render-option">
      <input type="radio" name="render" value="vector">
      <div class="render-card vector">
        <span class="icon">🎨</span>
        <span class="name">Vetorial</span>
        <span class="desc">Arte limpa e moderna</span>
      </div>
    </label>
    
    <!-- Mais 4 estilos... -->
  </div>
  
  <div class="render-actions">
    <input type="text" placeholder="Descrição (opcional)" class="prompt-input">
    <button class="btn-generate" onclick="generateImage()">
      🚀 Gerar Imagem
    </button>
  </div>
</div>

<style>
.render-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin: 16px 0;
}

.render-option input:checked + .render-card {
  background: var(--v3-orange);
  color: white;
  box-shadow: 6px 6px 0 var(--v3-ink);
}

.render-card {
  padding: 12px;
  border: 3px solid var(--v3-ink);
  border-radius: 10px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.render-icon {
  display: block;
  font-size: 2rem;
  margin-bottom: 8px;
}
</style>
```

### **5. Generation Progress**

```html
<div class="generation-progress">
  <p class="progress-title">Gerando imagem com Gemini 3.8...</p>
  
  <div class="progress-bar">
    <div class="progress-fill" style="width: 65%"></div>
  </div>
  
  <div class="progress-details">
    <p class="detail">📷 Processando 2 imagens de referência...</p>
    <p class="detail">🎨 Aplicando estilo: Vetorial</p>
    <p class="detail">⏱️ Tempo: 32s / ~60s estimado</p>
  </div>
  
  <button class="btn-cancel" onclick="cancelGeneration()">
    ❌ Cancelar
  </button>
</div>

<style>
.progress-bar {
  height: 8px;
  background: #ddd;
  border-radius: 4px;
  overflow: hidden;
  margin: 12px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff7417, #ffbd16);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>
```

---

## 🔄 Fluxo de Estado (State Machine)

```
┌──────────────┐
│ INICIAL      │
│ (Locked)     │
└────────┬─────┘
         │
         │ [Clica: Desbloquear com Google]
         ▼
┌──────────────────────┐
│ OAUTH_PENDING        │
│ (Esperando token)    │
└────────┬─────────────┘
         │
         │ ✅ OAuth autorizado
         ▼
┌──────────────────────┐
│ UNLOCKED             │
│ (IA Ativada)         │
└────────┬─────────────┘
         │
         │ [Upload Imagem 1]
         ▼
┌──────────────────────┐
│ UPLOADING_1          │
└────────┬─────────────┘
         │
         │ ✅ Salvo
         ▼
┌──────────────────────┐
│ ANALYZING_1          │
│ (Gemini processa)    │
└────────┬─────────────┘
         │
         │ ✅ Análise completa
         ▼
┌──────────────────────┐
│ REF1_READY           │
│ (Aguarda Ref 2)      │
└────────┬─────────────┘
         │
         │ [Upload Imagem 2]
         ▼
┌──────────────────────┐
│ UPLOADING_2          │
└────────┬─────────────┘
         │
         │ ✅ Salvo
         ▼
┌──────────────────────┐
│ ANALYZING_2          │
│ (Gemini processa)    │
└────────┬─────────────┘
         │
         │ ✅ Análise completa
         ▼
┌──────────────────────┐
│ REFS_READY           │
│ (Aguarda estilo)     │
└────────┬─────────────┘
         │
         │ [Seleciona estilo + Gerar]
         ▼
┌──────────────────────┐
│ GENERATING           │
│ (Gemini está criando)│
└────────┬─────────────┘
         │
         │ ✅ Imagem gerada
         ▼
┌──────────────────────┐
│ GENERATED            │
│ (Pronto para usar)   │
└────────┬─────────────┘
         │
         ├─ [Download]
         ├─ [Usar em Campanha]
         ├─ [Refinar]
         └─ [Gerar Nova Variação]
```

---

## 📊 Casos de Uso (Use Cases)

### **UC-1: Análise de Template**
```
Pré-requisito: OAuth desbloqueado
Entrada: 1 imagem (template de email)
Processo: Gemini Vision analisa
Saída: Análise completa + sugestões
Tempo: ~15 segundos
```

### **UC-2: Gerar com 2 Referências**
```
Pré-requisito: OAuth desbloqueado
Entrada: 2 imagens + estilo
Processo: Gemini gera nova imagem
Saída: Imagem gerada (salva em disco)
Tempo: 30-60 segundos
```

### **UC-3: A/B Testing Visual**
```
Pré-requisito: OAuth desbloqueado
Entrada: 1 imagem + 3 estilos
Processo: Gera 3 variações
Saída: 3 imagens diferentes
Tempo: ~2-3 minutos
```

### **UC-4: Refinar/Iterar**
```
Pré-requisito: Imagem já gerada
Entrada: Feedback do operador ("mais cores", "menos saturação", etc)
Processo: Gemini refina imagem anterior
Saída: Versão refinada
Tempo: 30-60 segundos
```

### **UC-5: Chat com Imagem**
```
Pré-requisito: OAuth desbloqueado
Entrada: Imagem + pergunta
Processo: Gemini responde sobre imagem
Saída: Resposta contextualizada
Tempo: ~10 segundos
```

---

## 🎯 Fluxo de Permissões (Com OAuth)

```javascript
// 1. Verificar OAuth status
if (!isOAuthAuthorized(vendorId)) {
  return showOAuthUnlockDialog();
}

// 2. Verificar token válido
if (isOAuthExpired(vendorId)) {
  return showOAuthRefreshDialog();
}

// 3. Permitir acesso à ferramenta
enableGeminiVisionTool(vendorId);

// 4. Fazer chamada para Gemini
const result = await callGeminiAPI(vendorId, params);

// 5. Salvar resultado
await saveImageToUserFolder(vendorId, result);
```

---

## 💡 Exemplos de Prompts (Para Operador)

```
1. "Analisa essa imagem de anúncio"
   └─ Dispara: /images/analyze

2. "Gera um banner combinando logo + tema"
   └─ Dispara: /images/generate (com 2 refs)

3. "Cria 5 variações desse design"
   └─ Dispara: /images/generate (loop 5x com estilos diferentes)

4. "Qual é a cor principal dessa imagem?"
   └─ Dispara: /copilot/chat-with-image

5. "Melhora essa imagem com estilo cartoon"
   └─ Dispara: /images/generate (refinamento)

6. "Gera versão mobile dessa imagem"
   └─ Dispara: /images/generate (com prompt específico)

7. "Compare essas 2 designs. Qual é melhor?"
   └─ Dispara: /copilot/chat-with-image (com 2 imagens)

8. "Extrai o texto dessa imagem"
   └─ Dispara: /copilot/chat-with-image (OCR)
```

---

## ✨ Conclusão da Integração

A ferramenta **IA Gemini Vision** se integra perfeitamente ao assistente como:

✅ **9ª ferramenta modular** (sem quebrar as 8 existentes)  
✅ **Desbloqueada via OAuth** (apenas usuários autenticados)  
✅ **Conversacional** (operador conversa naturalmente com IA)  
✅ **Visual** (aceita imagens, gera imagens)  
✅ **Iterativa** (pode refinar múltiplas vezes)  
✅ **Integrada com Campanhas** (usa imagens geradas em disparos)  

**Timeline: +4-5 semanas após as 8 ferramentas base**

Pode ser implementada em **paralelo** com as demais ferramentas!
