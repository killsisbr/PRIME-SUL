# FERRAMENTA IA COM VISÃO — Gemini 3.8 + OAuth + Image Generation

## 🎯 Visão Geral

Implementar uma **ferramenta IA avançada** integrada ao assistente que permite:
- 📷 **Upload/Cola de imagens** (Ctrl+V direto no chat)
- 💾 **Armazenamento** em pasta do vendedor (D:\PRIME SUL\users\{seller_id}\images)
- 🎨 **Geração de imagens** usando 2 imagens de referência
- 🎛️ **Sistema de render select** (escolher estilo/modelo)
- 🔐 **OAuth Antigravity** para autenticação
- 🚀 **Gemini 3.8** (modelo de IA com visão + geração)
- 🔑 **Desbloqueio por OAuth** (cada vendedor faz login)

---

## 📊 Fluxo Completo

```
┌────────────────────────────────────────────────────────────┐
│ OPERADOR (Painel PRIME SUL)                                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ 1️⃣ AUTENTICAÇÃO OAUTH                                     │
│    ┌──────────────────────────────────────┐               │
│    │ [Login com Google/Antigravity OAuth]  │               │
│    │ ↓                                    │               │
│    │ ✅ Token OAuth recebido              │               │
│    │ ✅ Desbloqueado: Ferramenta IA       │               │
│    └──────────────────────────────────────┘               │
│                                                            │
│ 2️⃣ UPLOAD DE IMAGENS                                      │
│    ┌──────────────────────────────────────┐               │
│    │ Ctrl+V → Cola imagem                 │               │
│    │ ou [Clica para upload]               │               │
│    │ ↓                                    │               │
│    │ ✅ Salva em:                         │               │
│    │ D:\PRIME SUL\users\5\images\         │               │
│    │   └─ 2024-01-15_screenshot.png       │               │
│    │   └─ template-vendedor.jpg           │               │
│    │ ↓                                    │               │
│    │ ✅ Preview no chat                   │               │
│    └──────────────────────────────────────┘               │
│                                                            │
│ 3️⃣ ANÁLISE COM VISÃO (Gemini 3.8)                         │
│    ┌──────────────────────────────────────┐               │
│    │ Operador: "Analisar imagem"         │               │
│    │ ↓                                    │               │
│    │ Gemini processa:                     │               │
│    │ • Detecta objetos/texto              │               │
│    │ • Reconhece marca/produto            │               │
│    │ • Sugere melhorias                   │               │
│    │ ↓                                    │               │
│    │ ✅ Resposta com análise              │               │
│    └──────────────────────────────────────┘               │
│                                                            │
│ 4️⃣ GERAÇÃO DE IMAGENS (2 referências)                     │
│    ┌──────────────────────────────────────┐               │
│    │ Operador: "Gera imagem com estilo"  │               │
│    │ Seleciona 2 imagens de referência:   │               │
│    │  [Template 1] + [Tema 2]             │               │
│    │ ↓                                    │               │
│    │ Render Select (escolhe modelo):      │               │
│    │ ○ Foto realista                     │               │
│    │ ○ Ilustração vetorial               │               │
│    │ ○ Arte digital                      │               │
│    │ ○ Cartoon/Anime                     │               │
│    │ ↓                                    │               │
│    │ Gemini gera nova imagem              │               │
│    │ ↓                                    │               │
│    │ ✅ Salva em: users\5\images\generated\
│    │    └─ 2024-01-15_generated_001.png   │               │
│    │ ✅ Preview no chat                   │               │
│    └──────────────────────────────────────┘               │
│                                                            │
│ 5️⃣ GERENCIAR IMAGENS                                      │
│    ┌──────────────────────────────────────┐               │
│    │ Visualizar biblioteca de imagens      │               │
│    │ • Originals (24 imagens)             │               │
│    │ • Generated (12 imagens)             │               │
│    │                                      │               │
│    │ [Deletar] [Renomear] [Download]      │               │
│    │ [Usar como referência] [Compartilhar]│               │
│    └──────────────────────────────────────┘               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 🔐 Sistema de Autenticação OAuth

### **Flow OAuth Antigravity**

```
1. OPERADOR CLICA: [Desbloquear IA com Google]
                    │
                    ▼
2. REDIRECT: https://antigravity.oauth.com/authorize?
              client_id=PRIME_SUL_001
              redirect_uri=http://localhost:5000/oauth/callback
              scope=email,profile,drive
                    │
                    ▼
3. OPERADOR: Faz login no Google/Antigravity
                    │
                    ▼
4. GOOGLE RETORNA: code=abc123xyz
                    │
                    ▼
5. BACKEND TROCA: code → access_token (via POST)
                    │
                    ▼
6. BACKEND VALIDA: email da conta
                    │
                    ▼
7. CRIA SESSION: 
   {
     oauth_token: "ya29.a0AfH6SMBx...",
     oauth_email: "vendedor@empresa.com",
     oauth_id: "117845xxxx",
     gemini_enabled: true,
     expiry: "2025-01-15T10:00:00Z"
   }
                    │
                    ▼
8. OPERADOR: Acesso liberado! ✅
```

### **Endpoints OAuth**

```javascript
// 1. Iniciar OAuth
GET /api/oauth/authorize
  └─ Redireciona para Google

// 2. Callback do OAuth
GET /oauth/callback?code=xxx&state=yyy
  ├─ Troca code por token
  ├─ Valida email
  ├─ Cria sessão
  └─ Redireciona ao painel

// 3. Verificar status
GET /api/oauth/status
  └─ {
       authorized: true,
       email: "vendedor@empresa.com",
       expiry: "2025-01-15T10:00:00Z"
     }

// 4. Revogar acesso
POST /api/oauth/revoke
  └─ Deleta token + sessão
```

---

## 📷 Sistema de Upload de Imagens

### **Métodos de Upload**

#### **Método 1: Ctrl+V (Paste direto)**

```html
<!-- Chat Input com suporte a Ctrl+V -->
<div id="chat-input-wrapper">
  <textarea id="chat-input" placeholder="Digite... ou Ctrl+V para colar imagem"></textarea>
  
  <script>
    document.addEventListener('paste', (e) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          uploadImage(blob);
          e.preventDefault(); // Evita colar texto
        }
      }
    });
  </script>
</div>
```

#### **Método 2: Clique para Upload**

```html
<button class="upload-image" onclick="document.getElementById('file-input').click()">
  📷 Adicionar Imagem
</button>

<input id="file-input" type="file" accept="image/*" style="display: none;" 
       onchange="uploadImage(this.files[0])" />
```

#### **Método 3: Drag & Drop**

```javascript
const chatBox = document.getElementById('chat-messages');

chatBox.addEventListener('dragover', (e) => {
  e.preventDefault();
  chatBox.style.borderColor = 'var(--v3-orange)';
});

chatBox.addEventListener('drop', (e) => {
  e.preventDefault();
  chatBox.style.borderColor = 'var(--v3-ink)';
  
  const files = e.dataTransfer.files;
  for (const file of files) {
    if (file.type.includes('image')) {
      uploadImage(file);
    }
  }
});
```

### **Upload Function**

```javascript
async function uploadImage(file) {
  // 1. Validar arquivo
  if (!file.type.includes('image')) {
    showError('Apenas imagens são aceitas');
    return;
  }
  
  if (file.size > 50 * 1024 * 1024) { // 50 MB max
    showError('Arquivo muito grande (máx 50 MB)');
    return;
  }
  
  // 2. Criar FormData
  const formData = new FormData();
  formData.append('file', file);
  formData.append('seller_id', getCurrentSellerId());
  
  // 3. Upload para backend
  try {
    const response = await fetch('/api/images/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      // 4. Salvar referência no chat
      addImageToChat({
        id: data.image_id,
        url: data.url,
        filename: data.filename,
        size: data.size,
        created_at: data.created_at,
        local_path: data.local_path
      });
      
      showNotification('✅ Imagem salva com sucesso');
    } else {
      showError(data.error);
    }
  } catch (error) {
    showError('Erro ao fazer upload da imagem');
    console.error(error);
  }
}
```

---

## 💾 Estrutura de Armazenamento

### **Diretórios do Vendedor**

```
D:\PRIME SUL\
└── users\
    └── {seller_id}\                    # Pasta do vendedor (ex: 5)
        ├── images\
        │   ├── originals\              # Imagens originais (upload)
        │   │   ├── 2024-01-15_00.png
        │   │   ├── template_bb.jpg
        │   │   └── theme_promo.jpg
        │   │
        │   ├── generated\               # Imagens geradas
        │   │   ├── 2024-01-15_gen_001.png
        │   │   ├── 2024-01-15_gen_002.png
        │   │   └── 2024-01-15_gen_003.png
        │   │
        │   ├── temp\                    # Processamento (cache)
        │   │   └─ (arquivos temporários)
        │   │
        │   └── metadata.json            # Índice de imagens
        │       {
        │         "originals": [
        │           {
        │             "id": "img_abc123",
        │             "filename": "template_bb.jpg",
        │             "size": 245000,
        │             "created_at": "2024-01-15T10:30:00Z",
        │             "analysis": "Logo Banco do Brasil com botão CTA",
        │             "tags": ["template", "bb", "oficial"]
        │           }
        │         ],
        │         "generated": [...]
        │       }
        │
        └── ai_settings.json             # Config IA do vendedor
            {
              "oauth_enabled": true,
              "oauth_token": "ya29.a0AfH6SMBx...",
              "oauth_email": "vendedor@empresa.com",
              "gemini_key_alias": "antigravity_oauth",
              "default_render_style": "photo_realistic",
              "auto_cleanup_days": 30
            }
```

### **Database Table: images**

```sql
CREATE TABLE IF NOT EXISTS seller_images (
    id           TEXT PRIMARY KEY,
    seller_id    INTEGER NOT NULL REFERENCES sellers(id),
    filename     TEXT NOT NULL,
    original_name TEXT,
    size         INTEGER,
    type         TEXT,  -- 'original' | 'generated'
    local_path   TEXT NOT NULL,  -- D:\PRIME SUL\users\5\images\originals\...
    url          TEXT,   -- URL pública se hospedada
    
    -- Análise da imagem
    analysis     TEXT,   -- Descrição do Gemini
    tags         TEXT,   -- JSON array ["tag1", "tag2"]
    
    -- Geração
    generated_from_images TEXT,  -- JSON [img1_id, img2_id]
    render_style TEXT,   -- photo_realistic | vector | digital_art | cartoon
    
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_seller_images ON seller_images(seller_id, type, created_at DESC);
```

---

## 🎨 Sistema de Render Select

### **Opções de Render (Estilos)**

```javascript
const renderStyles = [
  {
    id: 'photo_realistic',
    name: '📸 Foto Realista',
    description: 'Imagens fotográficas de alta qualidade',
    prompt_suffix: 'photorealistic, professional photography, 4K, sharp focus',
    icon: '📸'
  },
  {
    id: 'vector',
    name: '🎨 Ilustração Vetorial',
    description: 'Arte vetorial limpa e moderna',
    prompt_suffix: 'vector illustration, flat design, minimalist, clean lines',
    icon: '🎨'
  },
  {
    id: 'digital_art',
    name: '🖼️ Arte Digital',
    description: 'Pintura digital com texturas',
    prompt_suffix: 'digital painting, artistic, textured brushstrokes, oil painting effect',
    icon: '🖼️'
  },
  {
    id: 'cartoon',
    name: '🎬 Cartoon/Anime',
    description: 'Estilo cartoon ou anime',
    prompt_suffix: 'cartoon style, anime art, bright colors, comic book style',
    icon: '🎬'
  },
  {
    id: 'minimalist',
    name: '⬜ Minimalista',
    description: 'Design minimalista e clean',
    prompt_suffix: 'minimalist, simple, monochrome, negative space, modern',
    icon: '⬜'
  },
  {
    id: 'watercolor',
    name: '🎭 Aquarela',
    description: 'Estilo aquarela artístico',
    prompt_suffix: 'watercolor painting, artistic, soft colors, ink wash technique',
    icon: '🎭'
  }
];
```

### **UI do Render Select**

```html
<div class="render-select-container">
  <h3>Escolha o Estilo de Render</h3>
  
  <div class="render-grid">
    <label class="render-option">
      <input type="radio" name="render_style" value="photo_realistic" checked>
      <div class="render-card">
        <span class="render-icon">📸</span>
        <span class="render-name">Foto Realista</span>
        <span class="render-desc">Fotografia 4K profissional</span>
      </div>
    </label>
    
    <label class="render-option">
      <input type="radio" name="render_style" value="vector">
      <div class="render-card">
        <span class="render-icon">🎨</span>
        <span class="render-name">Vetorial</span>
        <span class="render-desc">Ilustração limpa</span>
      </div>
    </label>
    
    <!-- Mais opções... -->
  </div>
  
  <button onclick="generateImage()" class="btn-generate">
    🚀 Gerar Imagem
  </button>
</div>

<style>
.render-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin: 16px 0;
}

.render-option input[type="radio"]:checked + .render-card {
  background: var(--v3-orange);
  color: white;
  border-color: var(--v3-ink);
  box-shadow: 6px 6px 0 var(--v3-ink);
}

.render-card {
  padding: 12px;
  border: 3px solid var(--v3-ink);
  border-radius: 12px;
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

---

## 🤖 Integração com Gemini 3.8

### **API Gemini via OAuth**

```javascript
class GeminiVisionService {
  constructor(oauthToken) {
    this.oauthToken = oauthToken;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1/models/gemini-3.8';
  }

  // 1. Análise de Imagem (Vision)
  async analyzeImage(imagePath) {
    const imageData = fs.readFileSync(imagePath, { encoding: 'base64' });
    const mimeType = this.getMimeType(imagePath);
    
    const response = await fetch(
      `${this.baseUrl}:generateContent?key=${this.oauthToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Analise esta imagem. Descreva: objetos, cores, texto, composição, estilo. Sugestões de melhorias?' },
              {
                inlineData: {
                  mimeType,
                  data: imageData
                }
              }
            ]
          }]
        })
      }
    );
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  // 2. Geração de Imagem (2 referências)
  async generateImage(ref1Path, ref2Path, style, prompt) {
    const ref1Data = fs.readFileSync(ref1Path, { encoding: 'base64' });
    const ref2Data = fs.readFileSync(ref2Path, { encoding: 'base64' });
    
    const styleConfig = renderStyles.find(s => s.id === style);
    const fullPrompt = `${prompt}. ${styleConfig.prompt_suffix}`;
    
    const response = await fetch(
      `${this.baseUrl}:generateContent?key=${this.oauthToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Gere uma nova imagem criativa baseada nessas 2 referências: ${fullPrompt}` },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: ref1Data
                }
              },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: ref2Data
                }
              }
            ]
          }]
        })
      }
    );
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].image.data; // Base64
  }

  // 3. Chat com Imagem (Histórico)
  async chatWithImage(imagePath, userMessage, conversationHistory) {
    const imageData = fs.readFileSync(imagePath, { encoding: 'base64' });
    
    const contents = [
      // Histórico anterior
      ...conversationHistory,
      // Nova mensagem
      {
        parts: [
          { text: userMessage },
          {
            inlineData: {
              mimeType: this.getMimeType(imagePath),
              data: imageData
            }
          }
        ]
      }
    ];
    
    const response = await fetch(
      `${this.baseUrl}:generateContent?key=${this.oauthToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      }
    );
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  getMimeType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }
}

module.exports = GeminiVisionService;
```

---

## 🔌 Endpoints Novos

```javascript
// 1. OAuth: Iniciar login
GET /api/oauth/authorize
  └─ Redireciona para Google OAuth

// 2. OAuth: Callback
GET /oauth/callback?code=xxx
  ├─ Troca code por token
  ├─ Valida email
  ├─ Cria sessão
  └─ Redireciona ao painel

// 3. OAuth: Status
GET /api/oauth/status
  └─ {authorized: true, email: "...", expiry: "..."}

// 4. Upload de Imagem
POST /api/images/upload
  ├─ Body: FormData(file, seller_id)
  ├─ Valida arquivo
  ├─ Salva em: users/{seller_id}/images/originals/
  ├─ Cria entrada no DB
  └─ Response: {success, image_id, url, local_path}

// 5. Analisar Imagem (Gemini Vision)
POST /api/images/analyze
  ├─ Body: {image_id}
  ├─ Lê arquivo do disco
  ├─ Envia para Gemini
  ├─ Salva análise no DB
  └─ Response: {analysis, tags}

// 6. Gerar Imagem (2 referências)
POST /api/images/generate
  ├─ Body: {
  │   ref1_id: "img1",
  │   ref2_id: "img2",
  │   style: "photo_realistic",
  │   prompt: "Logo moderno para BB"
  │ }
  ├─ Lê 2 imagens
  ├─ Envia para Gemini
  ├─ Salva em: users/{seller_id}/images/generated/
  └─ Response: {image_id, url, generation_time}

// 7. Listar Imagens
GET /api/images/library?type=original|generated
  ├─ Lê metadata.json
  ├─ Pagina resultados
  └─ Response: {images: [], total, pages}

// 8. Deletar Imagem
DELETE /api/images/{image_id}
  ├─ Valida propriedade
  ├─ Remove arquivo do disco
  ├─ Remove do DB
  └─ Response: {success}

// 9. Compartilhar/Exportar
GET /api/images/{image_id}/download
  ├─ Valida propriedade
  ├─ Retorna arquivo
  └─ Content-Type: image/*

// 10. Chat com Imagem (Assistente)
POST /api/copilot/chat-with-image
  ├─ Body: {image_id, message}
  ├─ Lê histórico de conversa
  ├─ Envia para Gemini com imagem
  ├─ Salva resposta
  └─ Response: {reply, suggestions}
```

---

## 🔑 Fluxo Completo de Uso

### **Scenario: Gerar Marketing Banner**

```
OPERADOR (9:00 AM):
"Preciso gerar um banner pra BB com logo + tema promo"

1️⃣ OAUTH LOGIN (primeira vez)
   └─ [Desbloquear IA com Google]
      └─ Login OAuth realizado ✅
      └─ Token salvo em: users/5/ai_settings.json

2️⃣ UPLOAD IMAGEM 1 (Logo)
   └─ Ctrl+V → Cola screenshot do logo BB
   └─ ✅ Salvo em: users/5/images/originals/logo_bb.png
   └─ Gemini analisa: "Logo oficial do Banco do Brasil, cores azul e branco"

3️⃣ UPLOAD IMAGEM 2 (Tema)
   └─ Ctrl+V → Cola imagem de tema promocional
   └─ ✅ Salvo em: users/5/images/originals/theme_promo.jpg
   └─ Gemini analisa: "Tema tropical, cores vibrantes"

4️⃣ GERAR IMAGEM
   └─ Operador: "Combine logo + tema em um banner moderno"
   └─ Seleciona render: 📸 Foto Realista
   └─ Clica: [🚀 Gerar Imagem]
   └─ Gemini processa (30-60 segundos)...
   └─ ✅ Nova imagem gerada!
   └─ ✅ Salvo em: users/5/images/generated/2024-01-15_gen_001.png

5️⃣ ITERAÇÕES (A/B Testing)
   └─ Operador: "Tenta com estilo cartoon"
   └─ Seleciona render: 🎬 Cartoon
   └─ Clica: [🚀 Gerar Imagem]
   └─ ✅ Nova variação gerada!
   └─ ✅ Pode comparar lado a lado

6️⃣ USAR NA CAMPANHA
   └─ Operador: "Usar essa imagem na campanha BB"
   └─ [Download] → Salva em Downloads
   └─ [Usar em Campanha] → Integra ao disparo
   └─ ✅ Banner pronto para disparar!

RESULTADO:
📊 Tempo economizado: ~2-3 horas
🎨 Qualidade visual: Profissional
🚀 Velocidade: Iterações em minutos
```

---

## 📊 Matriz de Permissões

```
┌──────────────────┬─────────────┬──────────┬──────────┐
│ Recurso          │ Sem OAuth   │ Com OAuth│ Admin    │
├──────────────────┼─────────────┼──────────┼──────────┤
│ Upload Imagens   │ ❌          │ ✅       │ ✅       │
│ Analisar Imagem  │ ❌          │ ✅       │ ✅       │
│ Gerar Imagens    │ ❌          │ ✅       │ ✅       │
│ Ver Biblioteca   │ ❌          │ ✅       │ ✅ (todas)
│ Deletar Imagem   │ ❌          │ ✅ (própria) │ ✅   │
│ Exportar         │ ❌          │ ✅       │ ✅       │
│ Chat com Imagem  │ ❌          │ ✅       │ ✅       │
│ Usar em Campanha │ ❌          │ ✅       │ ✅       │
└──────────────────┴─────────────┴──────────┴──────────┘
```

---

## 💾 Backend: Estrutura de Serviços

### **Novo Service: ai-vision-service.js**

```javascript
const fs = require('fs').promises;
const path = require('path');
const GeminiVisionService = require('./gemini-vision-service');
const db = require('../database/db');

class AIVisionService {
  
  // 1. Upload de Imagem
  async uploadImage(sellerId, file) {
    const fileName = `${Date.now()}_${file.originalname}`;
    const dirPath = path.join(
      __dirname,
      `../../users/${sellerId}/images/originals`
    );
    
    // Criar diretório se não existir
    await fs.mkdir(dirPath, { recursive: true });
    
    const filePath = path.join(dirPath, fileName);
    
    // Salvar arquivo
    await fs.writeFile(filePath, file.buffer);
    
    // Salvar no DB
    const imageId = `img_${Date.now()}`;
    await db.run(
      `INSERT INTO seller_images (
        id, seller_id, filename, original_name, size, type, local_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [imageId, sellerId, fileName, file.originalname, file.size, 'original', filePath]
    );
    
    return {
      image_id: imageId,
      filename: fileName,
      size: file.size,
      local_path: filePath,
      url: `/api/images/${imageId}`
    };
  }

  // 2. Analisar Imagem com Gemini
  async analyzeImage(sellerId, imageId) {
    // Validar propriedade
    const image = await db.get(
      'SELECT * FROM seller_images WHERE id = ? AND seller_id = ?',
      [imageId, sellerId]
    );
    
    if (!image) throw new Error('Imagem não encontrada');
    
    // Obter token OAuth
    const settings = await this.getAISettings(sellerId);
    if (!settings.oauth_token) throw new Error('OAuth não configurado');
    
    // Analisar com Gemini
    const gemini = new GeminiVisionService(settings.oauth_token);
    const analysis = await gemini.analyzeImage(image.local_path);
    
    // Extrair tags (simples)
    const tags = this.extractTags(analysis);
    
    // Salvar análise no DB
    await db.run(
      'UPDATE seller_images SET analysis = ?, tags = ? WHERE id = ?',
      [analysis, JSON.stringify(tags), imageId]
    );
    
    return {
      analysis,
      tags
    };
  }

  // 3. Gerar Imagem (2 referências)
  async generateImage(sellerId, ref1Id, ref2Id, style, prompt) {
    // Validar propriedade de ambas imagens
    const ref1 = await db.get(
      'SELECT * FROM seller_images WHERE id = ? AND seller_id = ?',
      [ref1Id, sellerId]
    );
    const ref2 = await db.get(
      'SELECT * FROM seller_images WHERE id = ? AND seller_id = ?',
      [ref2Id, sellerId]
    );
    
    if (!ref1 || !ref2) throw new Error('Imagens de referência não encontradas');
    
    // Obter token OAuth
    const settings = await this.getAISettings(sellerId);
    if (!settings.oauth_token) throw new Error('OAuth não configurado');
    
    // Gerar com Gemini
    const gemini = new GeminiVisionService(settings.oauth_token);
    const imageBase64 = await gemini.generateImage(
      ref1.local_path,
      ref2.local_path,
      style,
      prompt
    );
    
    // Salvar imagem gerada
    const fileName = `${Date.now()}_generated.png`;
    const dirPath = path.join(
      __dirname,
      `../../users/${sellerId}/images/generated`
    );
    
    await fs.mkdir(dirPath, { recursive: true });
    
    const filePath = path.join(dirPath, fileName);
    const buffer = Buffer.from(imageBase64, 'base64');
    await fs.writeFile(filePath, buffer);
    
    // Salvar no DB
    const imageId = `img_${Date.now()}`;
    await db.run(
      `INSERT INTO seller_images (
        id, seller_id, filename, size, type, local_path, 
        generated_from_images, render_style
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        imageId,
        sellerId,
        fileName,
        buffer.length,
        'generated',
        filePath,
        JSON.stringify([ref1Id, ref2Id]),
        style
      ]
    );
    
    return {
      image_id: imageId,
      filename: fileName,
      local_path: filePath,
      generation_time: '45s'
    };
  }

  // 4. Chat com Imagem
  async chatWithImage(sellerId, imageId, userMessage, conversationHistory) {
    const image = await db.get(
      'SELECT * FROM seller_images WHERE id = ? AND seller_id = ?',
      [imageId, sellerId]
    );
    
    if (!image) throw new Error('Imagem não encontrada');
    
    const settings = await this.getAISettings(sellerId);
    if (!settings.oauth_token) throw new Error('OAuth não configurado');
    
    const gemini = new GeminiVisionService(settings.oauth_token);
    const reply = await gemini.chatWithImage(
      image.local_path,
      userMessage,
      conversationHistory
    );
    
    return { reply };
  }

  // 5. Obter configurações OAuth do vendedor
  async getAISettings(sellerId) {
    const settingsPath = path.join(
      __dirname,
      `../../users/${sellerId}/ai_settings.json`
    );
    
    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  // 6. Salvar configurações OAuth
  async saveAISettings(sellerId, settings) {
    const dirPath = path.join(__dirname, `../../users/${sellerId}`);
    await fs.mkdir(dirPath, { recursive: true });
    
    const settingsPath = path.join(dirPath, 'ai_settings.json');
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
  }

  // 7. Extrair tags da análise
  extractTags(analysis) {
    // Implementação simples (usar ML depois)
    const keywords = [
      'logo', 'template', 'banner', 'promo', 'bb', 'banco',
      'azul', 'branco', 'moderno', 'profissional', 'clean'
    ];
    
    const tags = [];
    for (const keyword of keywords) {
      if (analysis.toLowerCase().includes(keyword)) {
        tags.push(keyword);
      }
    }
    
    return tags;
  }
}

module.exports = new AIVisionService();
```

---

## 📋 Checklist de Implementação

### **Fase 1: OAuth + Upload (1 semana)**
- [ ] Setup Google OAuth
- [ ] Endpoints: /oauth/authorize, /oauth/callback
- [ ] Sistema de permissões (oauth_enabled flag)
- [ ] Upload de imagens (Ctrl+V + UI)
- [ ] Armazenamento em pastas do vendedor
- [ ] Database table: seller_images

### **Fase 2: Gemini Vision (1 semana)**
- [ ] Integração com Gemini 3.8 API
- [ ] Análise de imagem (vision)
- [ ] Extração de tags
- [ ] Chat com imagem (histórico)
- [ ] Endpoints: /images/analyze, /copilot/chat-with-image

### **Fase 3: Geração de Imagens (1-2 semanas)**
- [ ] Sistema de render select (6 estilos)
- [ ] Geração com 2 referências
- [ ] Salvamento de imagens geradas
- [ ] UI de seleção + preview
- [ ] Endpoint: /images/generate

### **Fase 4: Gerenciamento (1 semana)**
- [ ] Biblioteca de imagens (list/delete/share)
- [ ] Export/download
- [ ] Integração com campanhas
- [ ] Thumbnails + metadata
- [ ] Limpeza automática (>30 dias)

### **Fase 5: Polish (3-5 dias)**
- [ ] Performance + cache
- [ ] Tratamento de erros
- [ ] Testes + QA
- [ ] Documentação
- [ ] Deploy

**Total: 4-5 semanas para ferramenta completa**

---

## 🔒 Segurança

### **Validações Obrigatórias**

```javascript
// 1. Validar OAuth Token
middleware.oauthRequired = async (req, res, next) => {
  const settings = await getAISettings(req.user.id);
  if (!settings.oauth_token || !settings.oauth_enabled) {
    return res.status(403).json({error: 'IA não desbloqueada. Faça login com OAuth'});
  }
  
  // Validar expiração
  if (new Date(settings.expiry) < new Date()) {
    return res.status(403).json({error: 'Token OAuth expirado. Re-autentique'});
  }
  
  next();
};

// 2. Validar tamanho de arquivo
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
if (file.size > MAX_FILE_SIZE) {
  throw new Error('Arquivo muito grande');
}

// 3. Validar tipo MIME
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
if (!ALLOWED_TYPES.includes(file.mimetype)) {
  throw new Error('Tipo de arquivo não permitido');
}

// 4. Validar propriedade
const image = await db.get(
  'SELECT * FROM seller_images WHERE id = ? AND seller_id = ?',
  [imageId, req.user.id]
);
if (!image) throw new Error('Acesso negado');

// 5. Rate limiting por ferramenta
const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 gerações por minuto
  keyGenerator: (req) => `gemini_${req.user.id}`
});
```

---

## 📊 Custo Estimado

### **Google Gemini 3.8 Pricing (via OAuth)**

```
Vision API:
  • Análise de imagem: $0.0075 por imagem
  • 100 análises/mês = $0.75

Image Generation (Gemini):
  • 1024x1024: $0.04 por imagem
  • 512x512: $0.02 por imagem
  • 100 gerações/mês (512x512) = $2.00

Estimativa mensal por vendedor:
  • 100 análises + 100 gerações = ~$2.75/mês
  
Estimativa para 10 vendedores:
  • $27.50/mês (bem viável!)
  
Alternativa: Usar quota da Antigravity (se incluir)
  • Possível usar API deles com OAuth
  • Economizar em custos de API
```

---

## ✨ Exemplos de Uso

### **Use Case 1: Análise de Template**

```
Operador: "Analisa esse template de email"
[Cola screenshot do template]

IA Gemini:
"Template analisado:
- Layout: 1 coluna, limpo
- Cores: Laranja (#ff7417) e azul (#3b82f6)
- CTA: Botão verde [Solicitar Crédito]
- Texto: Bem hierarquizado

Sugestões:
1. Aumentar padding do CTA (mais destaque)
2. Adicionar logo do BB no topo
3. Considerar versão mobile
4. A/B test: 2 cores de CTA"

[Gerar Variação] [Salvar Analysis] [Usar em Campanha]
```

### **Use Case 2: Gerar Variações**

```
Operador: "Gera 3 versões dessa imagem com estilos diferentes"

1️⃣ Render: 📸 Foto Realista
   └─ ✅ Gerada (photo_realistic_001.png)

2️⃣ Render: 🎨 Vetorial  
   └─ ✅ Gerada (vector_001.png)

3️⃣ Render: 🎬 Cartoon
   └─ ✅ Gerada (cartoon_001.png)

[Comparar lado a lado] [Usar melhor] [Re-gerar]
```

### **Use Case 3: Gerar Banner com 2 Referências**

```
Operador: "Combine logo + tema em um banner"

Seleciona:
- Ref 1: logo_bb.png (Logo oficial)
- Ref 2: theme_promo.jpg (Tema tropical)
- Render: 📸 Foto Realista
- Prompt: "Banner moderno para campanha de crédito"

IA Gemini:
"Gerando imagem que combina:
- Logo do BB (azul + branco)
- Tema tropical (cores vibrantes)
- Estilo: Fotografia profissional"

[30 segundos depois...]

✅ Banner gerado!
📊 Qualidade: 2048x1024, 4K
💾 Salvo em: generated/banner_promo_001.png

[Preview] [Download] [Usar em Campanha] [Gerar Variação]
```

---

## 🎯 Conclusão

A ferramenta **IA com Visão + OAuth + Gemini 3.8** adiciona uma dimensão visual ao assistente que permite:

✅ **Análise inteligente de imagens** (detectar logos, cores, layout)  
✅ **Geração de conteúdo visual** (combinar 2 referências)  
✅ **A/B Testing visual** (testar múltiplos estilos)  
✅ **Integração com campanhas** (usar imagens geradas direto)  
✅ **Segurança via OAuth** (apenas usuários autenticados)  
✅ **Armazenamento organizado** (pasta por vendedor)  
✅ **Model de IA robusto** (Gemini 3.8 é profissional)  

**Timeline total:** 4-5 semanas para implementação completa.
