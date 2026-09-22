// ============================================================================
// LEAD OCR SERVICE — extração real de dados de documentos (CNH, RG, Holerite)
// via modelo de visão da NVIDIA NIM (API compatível com OpenAI chat/completions).
//
// Ao contrário da versão anterior (mock), este serviço:
//   - Nunca inventa CPF, telefone, renda ou limite.
//   - Retorna null por campo quando o documento não deixa claro / não está legível.
//   - Devolve uma nota de confiança geral pra UI exigir revisão humana.
// ============================================================================

// OPENAI_BASE_URL não é usado aqui de propósito: nesta máquina/ambiente ele já vem
// setado pelo sistema para um proxy genérico não-multimodal (opencode.ai/zen), o que
// quebraria o OCR silenciosamente. LEADS_OCR_BASE_URL é específico deste serviço.
const OCR_BASE_URL = process.env.LEADS_OCR_BASE_URL
    || (process.env.NVIDIA_API_KEY ? 'https://integrate.api.nvidia.com/v1' : 'https://api.openai.com/v1');
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY;
// Modelo multimodal (texto + imagem) — o modelo padrão de texto do resto do app
// (meta/llama-3.1-8b-instruct) NÃO enxerga imagem, por isso um modelo dedicado aqui.
const OCR_MODEL = process.env.LEADS_OCR_MODEL || 'meta/llama-3.2-11b-vision-instruct';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB — documento fotografado cabe tranquilo
// Imagens degeneradas (em branco, cor sólida, 1x1px de teste) comprimem para poucas
// centenas de bytes. Uma foto real de documento — mesmo pequena — tem textura, ruído de
// câmera e texto, e nunca fica tão pequena. Isso barra o caso mais grave de alucinação
// (o modelo "vendo" um documento inteiro numa imagem vazia) ANTES de gastar uma chamada de
// IA, sem risco de falso positivo em documentos reais.
const MIN_PLAUSIBLE_IMAGE_BYTES = 2 * 1024; // 2KB

const FIELD_KEYS = ['name', 'phone', 'cpf', 'city', 'renda', 'limite'];

const SYSTEM_PROMPT = [
    'Você é um extrator de dados de documentos brasileiros (CNH, RG, holerite/contracheque,',
    'comprovante de residência ou comprovante de renda) a partir de uma imagem.',
    '',
    'PASSO 1 — OBRIGATÓRIO: antes de preencher qualquer campo, transcreva em "raw_text"',
    'TODO o texto que você consegue literalmente ler na imagem, palavra por palavra, exatamente',
    'como aparece. Se a imagem não tiver nenhum texto visível (vazia, cor sólida, foto sem',
    'letras/números), "raw_text" deve ser uma string vazia "". Este passo ancora sua resposta',
    'em evidência real da imagem e não pode ser pulado.',
    '',
    'PASSO 2: preencha os campos estruturados USANDO SOMENTE o que apareceu em "raw_text".',
    'Se "raw_text" está vazio ou não contém um nome/CPF real, TODOS os campos de dados devem',
    'ser null — não copie exemplos de nomes ou CPFs comuns "para não deixar em branco"; um',
    'campo null é sempre a resposta correta quando a informação não está no raw_text.',
    'Se um campo específico simplesmente não aparece no raw_text (ex: documento sem telefone),',
    'retorne null só para esse campo, mantendo os demais que você conseguiu ler normalmente.',
    '',
    'Responda ESTRITAMENTE com um único objeto JSON, sem markdown, sem texto antes ou depois,',
    'no formato exato:',
    '{"raw_text": string, "name": string|null, "phone": string|null, "cpf": string|null,',
    ' "city": string|null, "renda": number|null, "limite": null, "confidence": number,',
    ' "doc_type": string|null, "notes": string|null}',
    '',
    'Regras por campo:',
    '- raw_text: transcrição literal do texto visível na imagem (pode ser longo); "" se não',
    '  houver texto nenhum visível.',
    '- name: nome completo da pessoa, como aparece no documento.',
    '- phone: telefone se aparecer explicitamente no documento (raro em CNH/RG); senão null.',
    '- cpf: CPF no formato 000.000.000-00 se estiver legível; senão null. Nunca gere dígitos.',
    '- city: cidade/UF de residência ou naturalidade se aparecer; senão null.',
    '- renda: valor numérico de renda/salário bruto SE aparecer explicitamente escrito no',
    '  documento (ex: holerite). Em CNH/RG normalmente não existe — retorne null.',
    '- limite: SEMPRE null. Limite de crédito é uma decisão de negócio, não um dado do',
    '  documento — nunca deve ser inferido pela IA.',
    '- confidence: OBRIGATÓRIO, um número entre 0 e 1 (nunca null) — sua confiança geral na',
    '  leitura (baixa tipo 0.2 se a imagem estiver borrada, cortada, girada ou ilegível;',
    '  alta tipo 0.9 se o texto estiver nítido e completo; 0 se não houver documento algum).',
    '- doc_type: exatamente um destes valores: "cnh", "rg", "holerite",',
    '  "comprovante_residencia", "outro". Nunca use a categoria da CNH (ex: "B") aqui.',
    '- notes: uma frase curta em português avisando qualquer limitação da leitura, ou null.'
].join('\n');

function stripCodeFence(text) {
    return String(text || '')
        .trim()
        .replace(/^```[a-z]*\n?/i, '')
        .replace(/```$/, '')
        .trim();
}

function safeParseJson(text) {
    const cleaned = stripCodeFence(text);
    try { return JSON.parse(cleaned); } catch { /* tenta recortar */ }
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* falhou mesmo */ }
    }
    return null;
}

// Alguns modelos de visão, mesmo instruídos a responder só em JSON, às vezes devolvem
// texto livre/markdown tipo "**Nome:** Fulano". Este fallback extrai por rótulo em vez
// de simplesmente falhar e forçar preenchimento 100% manual.
const LABEL_PATTERNS = {
    name: /\bnome\b\s*[:\-]?\s*\**\s*([^\n*]+)/i,
    phone: /\btelefone\b\s*[:\-]?\s*\**\s*([^\n*]+)/i,
    cpf: /\bcpf\b\s*[:\-]?\s*\**\s*([^\n*]+)/i,
    city: /\b(?:local|cidade)\b\s*[:\-]?\s*\**\s*([^\n*]+)/i,
    renda: /\b(?:renda|sal[aá]rio)\b\s*[:\-]?\s*\**\s*([^\n*]+)/i,
    confidence: /\bconfidence\b\s*[:\-]?\s*\**\s*([^\n*]+)/i,
    doc_type: /\bdoc[_ ]?type\b\s*[:\-]?\s*\**\s*([^\n*]+)/i,
    notes: /\bnotes\b\s*[:\-]?\s*\**\s*([^\n*]+)/i
};

function parseFromLabeledText(text) {
    const raw = String(text || '');
    if (!raw.trim()) return null;
    const out = {};
    let hits = 0;
    for (const [key, pattern] of Object.entries(LABEL_PATTERNS)) {
        const m = raw.match(pattern);
        if (m && m[1] && m[1].trim()) { out[key] = m[1].trim(); hits++; }
    }
    // Exige pelo menos nome ou CPF reconhecido — senão não é uma extração válida,
    // é só ruído, e é mais seguro reportar falha do que devolver lixo parcial.
    return (hits > 0 && (out.name || out.cpf)) ? out : null;
}

function normalizeField(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed || /^n\/?a$|^null$|^n[ãa]o (informad|legível)/i.test(trimmed)) return null;
        return trimmed;
    }
    return value;
}

function sanitizeExtracted(raw) {
    const out = { doc_type: null, notes: null, confidence: 0 };
    for (const key of FIELD_KEYS) out[key] = null;
    if (!raw || typeof raw !== 'object') return out;

    for (const key of FIELD_KEYS) {
        if (key === 'limite') { out.limite = null; continue; } // nunca inferido pela IA
        out[key] = normalizeField(raw[key]);
    }
    if (out.renda !== null) {
        const n = Number(String(out.renda).replace(/[^\d.,]/g, '').replace(',', '.'));
        out.renda = Number.isFinite(n) ? n : null;
    }
    const validDocTypes = new Set(['cnh', 'rg', 'holerite', 'comprovante_residencia', 'outro']);
    const docType = normalizeField(raw.doc_type);
    out.doc_type = docType && validDocTypes.has(String(docType).toLowerCase()) ? String(docType).toLowerCase() : 'outro';
    out.notes = normalizeField(raw.notes);
    const conf = Number(raw.confidence);
    // Modelo às vezes devolve null/ausente apesar da instrução; usamos confiança neutra
    // nesse caso (nem alta nem baixa) em vez de 0, que forçaria "sem confiança" indevido.
    out.confidence = Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5;

    // Defesa em profundidade contra alucinação: NÃO confiamos no julgamento subjetivo do
    // modelo sobre "há documento ou não" nem só na confiança que ele reporta. Em vez disso,
    // ancoramos numa evidência objetiva e verificável em código: o próprio texto bruto que
    // o modelo diz ter lido (raw_text, pedido no PASSO 1 do prompt). Se ele não transcreveu
    // texto nenhum (ou quase nada), é impossível que os campos estruturados venham de algo
    // real na imagem — são invenção, mesmo que o modelo tenha reportado confiança alta.
    const rawText = typeof raw.raw_text === 'string' ? raw.raw_text.trim() : '';
    const noEvidenceOfText = rawText.length < 6; // limiar baixo: até "N/A" ou "-" não conta como documento
    // Além disso, cada campo extraído precisa aparecer de fato dentro do raw_text
    // transcrito — se o modelo "extraiu" um nome/CPF que não está no texto que ele mesmo
    // transcreveu, é sinal claro de invenção, então descartamos só aquele campo.
    const rawTextNorm = rawText.toLowerCase();
    function appearsInRawText(value) {
        if (!value) return true; // já é null, nada a verificar
        const v = String(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
        if (!v) return true;
        const haystack = rawTextNorm.replace(/[^\p{L}\p{N}]/gu, '');
        return haystack.includes(v.slice(0, Math.max(4, Math.floor(v.length * 0.6))));
    }

    if (noEvidenceOfText) {
        console.log(`[lead-ocr] bloqueado por raw_text vazio/curto (len=${rawText.length}). raw_text recebido: ${JSON.stringify(rawText).slice(0, 300)}`);
        for (const key of FIELD_KEYS) out[key] = null;
        out.confidence = 0;
        if (!out.notes) out.notes = 'A IA não identificou texto legível nesta imagem — não é um documento reconhecível.';
    } else {
        for (const key of ['name', 'phone', 'cpf', 'city']) {
            if (out[key] && !appearsInRawText(out[key])) {
                console.log(`[lead-ocr] campo "${key}"="${out[key]}" descartado: não corresponde ao raw_text transcrito.`);
                out[key] = null; // campo não corresponde a nada no texto transcrito — descarta só ele
            }
        }
    }
    console.log(`[lead-ocr] resultado final: name=${out.name ? 'OK' : 'null'} cpf=${out.cpf ? 'OK' : 'null'} phone=${out.phone ? 'OK' : 'null'} confidence=${out.confidence} raw_text_len=${rawText.length}`);
    return out;
}

/**
 * @param {Buffer} imageBuffer
 * @param {string} mimeType ex: 'image/png', 'image/jpeg'
 * @returns {Promise<{name:string|null, phone:string|null, cpf:string|null, city:string|null,
 *   renda:number|null, limite:null, confidence:number, doc_type:string|null, notes:string|null}>}
 */
async function extractFromImage(imageBuffer, mimeType) {
    if (!NVIDIA_API_KEY) {
        const e = new Error('IA Vision não configurada: defina NVIDIA_API_KEY (ou OPENAI_API_KEY) no .env/.env.local do servidor.');
        e.status = 503;
        throw e;
    }
    if (!imageBuffer || !imageBuffer.length) {
        const e = new Error('Arquivo de imagem vazio ou inválido.');
        e.status = 400;
        throw e;
    }
    if (imageBuffer.length < MIN_PLAUSIBLE_IMAGE_BYTES) {
        // Barreira determinística (não-IA): arquivo pequeno demais pra ser uma foto real de
        // documento — provavelmente imagem em branco/degenerada. Evita gastar uma chamada de
        // IA num caso onde o modelo tende a alucinar dados "de exemplo".
        console.log(`[lead-ocr] bloqueado por tamanho mínimo: ${imageBuffer.length} bytes < ${MIN_PLAUSIBLE_IMAGE_BYTES} bytes`);
        return sanitizeExtracted({
            raw_text: '',
            notes: 'Arquivo de imagem muito simples/pequeno para ser um documento real — verifique o envio.'
        });
    }
    if (imageBuffer.length > MAX_IMAGE_BYTES) {
        const e = new Error('Imagem muito grande (máximo 8MB). Envie uma foto ou scan mais leve.');
        e.status = 413;
        throw e;
    }

    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType || 'image/png'};base64,${base64}`;

    let res;
    try {
        res = await fetch(`${OCR_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NVIDIA_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: OCR_MODEL,
                temperature: 0.1,
                max_tokens: 900,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Extraia os dados deste documento seguindo exatamente o formato JSON pedido.' },
                            { type: 'image_url', image_url: { url: dataUrl } }
                        ]
                    }
                ]
            })
        });
    } catch (networkErr) {
        const e = new Error(`Falha de rede ao contatar a IA Vision: ${networkErr.message}`);
        e.status = 502;
        throw e;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data?.error?.message || data?.message || `Erro na API de IA Vision (HTTP ${res.status})`;
        const e = new Error(msg);
        e.status = res.status === 401 || res.status === 403 ? 502 : 502;
        throw e;
    }

    const content = data?.choices?.[0]?.message?.content;
    let parsed = safeParseJson(content);
    if (!parsed) {
        parsed = parseFromLabeledText(content);
        if (parsed) {
            parsed.confidence = parsed.confidence ? Number(String(parsed.confidence).replace(',', '.')) || 0.4 : 0.4;
            // Nesse caminho de fallback não pedimos raw_text (é texto livre do modelo,
            // não seguiu o schema); usamos a própria resposta bruta como evidência textual.
            parsed.raw_text = String(content || '');
        }
    }
    if (!parsed) {
        console.error('[lead-ocr] resposta em formato inesperado do modelo:', JSON.stringify(content).slice(0, 2000));
        const e = new Error('A IA Vision respondeu em um formato inesperado. Preencha manualmente.');
        e.status = 502;
        throw e;
    }
    console.log(`[lead-ocr] resposta bruta do modelo (${imageBuffer.length} bytes de imagem):`, JSON.stringify(parsed).slice(0, 1500));

    return sanitizeExtracted(parsed);
}

module.exports = { extractFromImage, MAX_IMAGE_BYTES };
