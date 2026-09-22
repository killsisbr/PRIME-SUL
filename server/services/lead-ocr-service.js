// ============================================================================
// LEAD OCR SERVICE — extração real de dados de documentos (CNH, RG, Holerite,
// prints de tela de CRM/sistema bancário) via modelo de visão da NVIDIA NIM
// (API compatível com OpenAI chat/completions).
//
// Este serviço:
//   - Nunca inventa CPF, telefone, renda, limite, agência ou conta.
//   - Retorna null por campo quando o documento não deixa claro / não está legível.
//   - Devolve uma nota de confiança geral pra UI exigir revisão humana.
//   - Faz DUAS chamadas de IA menores em vez de uma grande: uma para os dados
//     pessoais (nome/CPF/telefone/agência/conta) e outra para a tabela de
//     simulações de crédito. Testes mostraram que pedir tudo numa chamada só
//     faz o modelo 11B quebrar o formato JSON em imagens densas (telas de CRM
//     com muito texto); duas chamadas simples são muito mais consistentes.
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

const FIELD_KEYS = ['name', 'phone', 'cpf', 'city', 'renda', 'limite', 'agencia', 'conta'];

// -------- Prompt 1: dados pessoais (chamada pequena e focada) --------
// Mantido deliberadamente curto e direto: testes mostraram que prompts mais longos/
// detalhados fazem o modelo 11B "explicar" a resposta em texto livre em vez de responder
// só o JSON, mesmo com response_format json_object habilitado.
const PERSONAL_PROMPT = [
    'Extraia dados pessoais desta imagem (documento brasileiro ou tela de sistema/CRM).',
    'Responda SÓ um objeto JSON, sem explicação, sem markdown, com exatamente estas chaves:',
    '{"raw_text":"","name":null,"cpf":null,"phone":null,"city":null,"agencia":null,',
    '"conta":null,"renda":null,"confidence":0,"doc_type":null,"notes":null}',
    '',
    'raw_text = texto com nome, CPF, telefone, filial e conta visíveis na imagem.',
    'name = só o nome completo, sem rótulo do campo.',
    'cpf = só os números/máscara do CPF, sem rótulo.',
    'phone = telefone/WhatsApp. Pode estar rotulado "Telefone", "WhatsApp", "Celular",',
    '"Contato" ou "Pontos de Contato" (comum em telas de CRM — extraia o número de telefone',
    'de dentro dessa seção mesmo que o rótulo exato seja "Pontos de Contato"). Nunca confunda',
    'com número de conta bancária, código de filial ou CPF (esses são números sem o formato',
    'de telefone — DDD + número).',
    'agencia = número que aparece EXATAMENTE ao lado do rótulo "Código da filial", "Agência"',
    'ou "Filial" — se esse rótulo não aparecer literalmente na imagem, agencia = null. NUNCA',
    'use MCI, CPF ou qualquer outro número que não esteja sob esse rótulo específico.',
    'conta = número que aparece EXATAMENTE ao lado do rótulo "Número da conta", "Conta',
    'Corrente" ou "Conta" — se esse rótulo não aparecer literalmente na imagem, conta = null.',
    'NUNCA use CPF, MCI ou qualquer outro número que não esteja sob esse rótulo específico.',
    'Campo sem valor visível na imagem = null. Nunca invente nome, CPF, telefone, cidade,',
    'filial ou conta. Campo com valor visível deve ser preenchido com esse valor real. É',
    'MELHOR deixar agencia/conta null do que preencher com um número errado de outro campo.',
    'confidence = 0 a 1 (0 se não achar nada legível; 0.8+ se nome/CPF nítidos).',
    'doc_type = um de: cnh, rg, holerite, comprovante_residencia, tela_sistema, outro.'
].join('\n');

// -------- Prompt 2: tabela de simulações (chamada separada, só quando fizer sentido) --------
const SIMULACOES_PROMPT = [
    'Esta imagem pode conter uma tabela de "Simulações" de crédito/empréstimo (colunas',
    'tipo Produto, Modalidade, Valor, Data).',
    '',
    'Responda APENAS um objeto JSON válido, uma linha, sem markdown, sem texto fora do JSON:',
    '{"tem_tabela":false,"simulacoes":[]}',
    '',
    'tem_tabela = true SOMENTE se você realmente vê essa tabela na imagem.',
    'simulacoes = copie EXATAMENTE as 5 primeiras linhas da tabela (as do topo) como',
    '{"produto":"","modalidade":"","valor":"","data":""} cada. Se a tabela tiver menos de 5',
    'linhas, copie todas. NUNCA invente uma linha que não está na imagem. Se tem_tabela é',
    'false, simulacoes deve ser [].'
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

// Chamada genérica ao modelo de visão da NVIDIA, com uma imagem + um prompt de sistema.
// Lança erro se a chave não estiver configurada, a rede falhar, ou a API responder erro.
async function callVisionModel(dataUrl, systemPrompt, userText, maxTokens) {
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
                max_tokens: maxTokens,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: userText },
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
        e.status = 502;
        throw e;
    }

    const content = data?.choices?.[0]?.message?.content;
    let parsed = safeParseJson(content);
    if (!parsed) {
        parsed = parseFromLabeledText(content);
        if (parsed) {
            // Nesse caminho de fallback não seguiu o schema JSON; usamos a própria
            // resposta bruta como evidência textual pro raw_text.
            parsed.raw_text = String(content || '');
        }
    }
    if (!parsed) {
        console.warn('[lead-ocr] resposta em formato inesperado do modelo (uma das duas chamadas falhou, seguindo com o que der):', JSON.stringify(content).slice(0, 800));
        return null;
    }
    return parsed;
}

function sanitizePersonalData(raw) {
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
    const validDocTypes = new Set(['cnh', 'rg', 'holerite', 'comprovante_residencia', 'tela_sistema', 'outro']);
    const docType = normalizeField(raw.doc_type);
    out.doc_type = docType && validDocTypes.has(String(docType).toLowerCase()) ? String(docType).toLowerCase() : 'outro';
    out.notes = normalizeField(raw.notes);
    const conf = Number(raw.confidence);
    // Modelo às vezes devolve null/ausente apesar da instrução; usamos confiança neutra
    // nesse caso (nem alta nem baixa) em vez de 0, que forçaria "sem confiança" indevido.
    out.confidence = Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5;

    // Defesa determinística contra confusão de campo: agência/conta nunca devem ser
    // exatamente iguais ao CPF (só dígitos comparados) — isso já aconteceu no modelo
    // (confundiu "Código da filial"/"Número da conta" com CPF/MCI quando não viu os
    // rótulos certos no raw_text truncado). Zeramos o campo errado em vez de mostrar um
    // número de filial/conta que na verdade é outra coisa.
    const cpfDigits = out.cpf ? String(out.cpf).replace(/\D/g, '') : '';
    for (const key of ['agencia', 'conta']) {
        if (out[key] && cpfDigits && String(out[key]).replace(/\D/g, '') === cpfDigits) {
            console.log(`[lead-ocr] campo "${key}" descartado: idêntico ao CPF (provável confusão de campo).`);
            out[key] = null;
        }
    }
    if (out.agencia && out.conta && String(out.agencia) === String(out.conta)) {
        console.log('[lead-ocr] agencia e conta idênticos entre si — descartando ambos (provável confusão de campo).');
        out.agencia = null;
        out.conta = null;
    }

    // Defesa contra alucinação: exigimos que o NOME extraído apareça (mesmo que
    // parcialmente) dentro do raw_text que a própria IA transcreveu. É a checagem mínima
    // que ainda pega o padrão clássico de alucinação ("Fulano de Tal" / "João Silva"
    // inventado do nada em imagens sem documento real), sem ser tão rígida a ponto de
    // descartar CPF/telefone válidos quando o raw_text vem truncado (o nome sozinho é
    // suficiente como âncora — CPF/telefone/agência/conta não precisam bater literalmente
    // porque costumam ter máscara/formatação diferente entre raw_text e o campo extraído).
    const rawText = typeof raw.raw_text === 'string' ? raw.raw_text.trim() : '';
    const rawTextNorm = rawText.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    function nameAppearsInRawText() {
        if (!out.name) return true; // nada a validar
        const nameNorm = String(out.name).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
        if (!nameNorm) return true;
        if (!rawTextNorm) return false; // nome presente mas raw_text vazio — suspeito
        // Exige que pelo menos a primeira palavra do nome apareça no raw_text — barra
        // nomes totalmente inventados sem quebrar em variações de espaçamento/acentos.
        const firstWord = String(out.name).trim().split(/\s+/)[0].toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
        return firstWord.length >= 2 && rawTextNorm.includes(firstWord);
    }

    const looksInvented = out.name && !nameAppearsInRawText();
    if (looksInvented) {
        console.log(`[lead-ocr] bloqueado: nome "${out.name}" não aparece no raw_text ("${rawText.slice(0, 200)}") — provável alucinação.`);
        for (const key of FIELD_KEYS) out[key] = null;
        out.confidence = 0;
        if (!out.notes) out.notes = 'A leitura ficou inconsistente (nome não confere com o texto identificado) — preencha manualmente.';
    } else if (rawText.length === 0 && !out.name && !out.cpf) {
        console.log('[lead-ocr] bloqueado: raw_text vazio e nenhum nome/CPF extraído.');
        for (const key of FIELD_KEYS) out[key] = null;
        out.confidence = 0;
        if (!out.notes) out.notes = 'A IA não identificou texto legível nesta imagem — não é um documento reconhecível.';
    } else if ((out.name || out.cpf) && out.confidence === 0) {
        // Se a IA encontrou nome ou CPF mas não reportou confiança, isso é inconsistente —
        // ajustamos pra um valor neutro-alto em vez de 0, já que 0 sinalizaria "sem
        // leitura" quando na verdade os dados vieram.
        out.confidence = 0.6;
    }
    return out;
}

function sanitizeSimulacoes(raw) {
    if (!raw || typeof raw !== 'object' || raw.tem_tabela !== true) return [];
    const list = Array.isArray(raw.simulacoes) ? raw.simulacoes : [];
    const out = [];
    for (const item of list.slice(0, 5)) {
        if (!item || typeof item !== 'object') continue;
        const produto = normalizeField(item.produto);
        const modalidade = normalizeField(item.modalidade);
        const valor = normalizeField(item.valor);
        const data = normalizeField(item.data);
        if (!produto && !modalidade && !valor && !data) continue;
        out.push({ produto, modalidade, valor, data });
    }
    return out;
}

/**
 * @param {Buffer} imageBuffer
 * @param {string} mimeType ex: 'image/png', 'image/jpeg'
 * @returns {Promise<{name:string|null, phone:string|null, cpf:string|null, city:string|null,
 *   renda:number|null, limite:null, agencia:string|null, conta:string|null, confidence:number,
 *   doc_type:string|null, notes:string|null, simulacoes:Array}>}
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
        const out = sanitizePersonalData({
            raw_text: '',
            notes: 'Arquivo de imagem muito simples/pequeno para ser um documento real — verifique o envio.'
        });
        out.simulacoes = [];
        return out;
    }
    if (imageBuffer.length > MAX_IMAGE_BYTES) {
        const e = new Error('Imagem muito grande (máximo 8MB). Envie uma foto ou scan mais leve.');
        e.status = 413;
        throw e;
    }

    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType || 'image/png'};base64,${base64}`;

    // Duas chamadas independentes e mais simples, em paralelo, em vez de uma chamada
    // complexa só — reduz muito a chance do modelo quebrar o formato JSON em imagens
    // densas (telas de CRM com bastante texto).
    let [personalRaw, simsRaw] = await Promise.all([
        callVisionModel(dataUrl, PERSONAL_PROMPT, 'Extraia os dados pessoais desta imagem em JSON.', 500),
        callVisionModel(dataUrl, SIMULACOES_PROMPT, 'Extraia a tabela de simulações desta imagem em JSON, se houver.', 600)
    ]);

    // Retry único: a chamada de dados pessoais é a que mais importa (nome/CPF), então
    // vale uma segunda tentativa isolada se a primeira não veio em formato utilizável.
    if (!personalRaw) {
        console.log('[lead-ocr] retry da chamada de dados pessoais (primeira tentativa falhou)');
        personalRaw = await callVisionModel(dataUrl, PERSONAL_PROMPT, 'Extraia os dados pessoais desta imagem em JSON.', 500);
    }
    // Simulações são um extra opcional — uma tentativa a mais só se a primeira falhou,
    // sem bloquear a resposta principal se não der certo de novo.
    if (!simsRaw) {
        console.log('[lead-ocr] retry da chamada de simulações (primeira tentativa falhou)');
        simsRaw = await callVisionModel(dataUrl, SIMULACOES_PROMPT, 'Extraia a tabela de simulações desta imagem em JSON, se houver.', 600);
    }

    if (!personalRaw) {
        const e = new Error('A IA Vision respondeu em um formato inesperado. Preencha manualmente.');
        e.status = 502;
        throw e;
    }
    console.log(`[lead-ocr] resposta pessoal (${imageBuffer.length} bytes de imagem):`, JSON.stringify(personalRaw).slice(0, 800));
    if (simsRaw) console.log('[lead-ocr] resposta simulações:', JSON.stringify(simsRaw).slice(0, 800));

    const personal = sanitizePersonalData(personalRaw);
    personal.simulacoes = sanitizeSimulacoes(simsRaw);

    console.log(`[lead-ocr] resultado final: name=${personal.name ? 'OK' : 'null'} cpf=${personal.cpf ? 'OK' : 'null'} agencia=${personal.agencia ? 'OK' : 'null'} conta=${personal.conta ? 'OK' : 'null'} confidence=${personal.confidence} simulacoes=${personal.simulacoes.length}`);
    return personal;
}

module.exports = { extractFromImage, MAX_IMAGE_BYTES };
