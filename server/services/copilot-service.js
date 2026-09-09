// ============================================================================
// COPILOT AI SERVICE — Assistente Inteligente com Tools para Vendedor & Admin
// ============================================================================
const db = require('../database/db');
const antiBan = require('./anti-ban-service');
const campaignService = require('./campaign-service');
const leadService = require('./lead-service');
const settings = require('./settings-service');
const whatsapp = require('./whatsapp-service');
const { normalizePhone } = require('../utils/phone');

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || (process.env.NVIDIA_API_KEY ? 'https://integrate.api.nvidia.com/v1' : 'https://api.openai.com/v1');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY;
const COPILOT_MODEL = process.env.COPILOT_MODEL || process.env.AI_EDITOR_MODEL || process.env.OPENAI_MODEL || (process.env.NVIDIA_API_KEY ? 'meta/llama-3.1-8b-instruct' : 'gpt-4o-mini');

// ---------------------------------------------------------------------------
// 1. Definições das Tools disponíveis
// ---------------------------------------------------------------------------
const TOOLS_SPEC = [
    {
        name: 'consultar_leads',
        description: 'Pesquisa leads no CRM por termo (nome, telefone, cpf, cidade), status no funil ou score.',
        parameters: {
            type: 'object',
            properties: {
                termo: { type: 'string', description: 'Nome, telefone, CPF ou cidade do lead' },
                status: { type: 'string', enum: ['novos', 'enviados', 'sim', 'nao', 'bloqueado', 'todos'], description: 'Estágio do funil' },
                limite: { type: 'number', description: 'Quantidade máxima de leads a retornar (padrão 5)' }
            }
        }
    },
    {
        name: 'detalhar_lead',
        description: 'Exibe os dados detalhados de um lead específico: contato, valores, histórico de mensagens e link WhatsApp.',
        parameters: {
            type: 'object',
            properties: {
                lead_id: { type: 'number', description: 'ID do lead' },
                termo: { type: 'string', description: 'Telefone, CPF ou nome caso não saiba o ID' }
            }
        }
    },
    {
        name: 'mover_estagio_funil',
        description: 'Move um lead para outro status/estágio do funil de vendas (novos, enviados, sim, nao, bloqueado).',
        parameters: {
            type: 'object',
            properties: {
                lead_id: { type: 'number', description: 'ID do lead a mover' },
                novo_status: { type: 'string', enum: ['novos', 'enviados', 'sim', 'nao', 'bloqueado'], description: 'Novo estágio do lead' },
                observacao: { type: 'string', description: 'Observação opcional sobre o avanço/negociação' }
            },
            required: ['lead_id', 'novo_status']
        }
    },
    {
        name: 'gerar_abordagem',
        description: 'Cria uma abordagem persuasiva personalizada de WhatsApp focada em crédito consignado, FGTS ou reengajamento.',
        parameters: {
            type: 'object',
            properties: {
                tipo: { type: 'string', enum: ['consignado', 'fgts', 'primeiro_contato', 'reengajamento', 'fechamento', 'revisao_margem'], description: 'Tipo de produto ou momento da conversa' },
                lead_id: { type: 'number', description: 'ID opcional do lead para puxar nome, valores e cidade automaticamente' },
                nome_cliente: { type: 'string', description: 'Nome do cliente caso não use lead_id' }
            }
        }
    },
    {
        name: 'metricas_operacao',
        description: 'Consulta métricas reais em tempo real do CRM: total de leads, taxa de conversão, envios e distribuição por estágios do funil.',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'status_anti_ban',
        description: 'Consulta a saúde dos chips/números de WhatsApp, mensagens enviadas hoje, limite diário e status de proteção anti-ban.',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'criar_disparo_rapido',
        description: 'Cria e agenda uma campanha rápida de mensagens para leads de um status específico (ex: novos ou sim).',
        parameters: {
            type: 'object',
            properties: {
                nome_campanha: { type: 'string', description: 'Nome da campanha' },
                mensagem: { type: 'string', description: 'Texto da mensagem (pode usar {nome})' },
                status_alvo: { type: 'string', enum: ['novos', 'enviados', 'sim'], description: 'Status dos leads alvo' },
                limite: { type: 'number', description: 'Máximo de leads a incluir' }
            },
            required: ['nome_campanha', 'mensagem']
        }
    }
];

// ---------------------------------------------------------------------------
// 2. Execução das Tools
// ---------------------------------------------------------------------------
async function executeTool(name, args = {}, userContext = {}) {
    const isSeller = userContext.role === 'seller';
    const sellerId = userContext.id;
    const orgId = userContext.organization_id || 1;

    switch (name) {
        case 'consultar_leads': {
            const limit = Math.min(Math.max(Number(args.limite) || 5, 1), 20);
            const status = (args.status && args.status !== 'todos') ? args.status.toLowerCase() : null;
            const termo = (args.termo || '').trim();

            let sql = `
                SELECT l.id, l.name, l.phone, l.city, l.status, l.score, l.prioridade, l.limite_est, l.renda, l.valor_desejado, l.origem,
                       s.name AS vendedor_nome
                FROM leads l
                LEFT JOIN sellers s ON s.id = l.seller_id
                WHERE l.organization_id = ?
            `;
            const params = [orgId];

            if (isSeller) {
                sql += ' AND l.seller_id = ?';
                params.push(sellerId);
            }

            if (status) {
                sql += ' AND l.status = ?';
                params.push(status);
            }

            if (termo) {
                const digits = termo.replace(/\D/g, '');
                if (digits.length >= 8) {
                    sql += ' AND (l.phone LIKE ? OR l.cpf LIKE ? OR l.name LIKE ?)';
                    params.push(`%${digits}%`, `%${digits}%`, `%${termo}%`);
                } else {
                    sql += ' AND (l.name LIKE ? OR l.city LIKE ? OR l.phone LIKE ?)';
                    params.push(`%${termo}%`, `%${termo}%`, `%${termo}%`);
                }
            }

            sql += ' ORDER BY l.updated_at DESC LIMIT ?';
            params.push(limit);

            const leads = await db.all(sql, params);
            return {
                tool: 'consultar_leads',
                total_encontrados: leads.length,
                leads: leads.map(l => ({
                    id: l.id,
                    nome: l.name,
                    telefone: l.phone,
                    status: l.status,
                    score: l.score || 50,
                    prioridade: l.prioridade,
                    cidade: l.city || 'Não informada',
                    limite_est: l.limite_est,
                    renda: l.renda,
                    valor_desejado: l.valor_desejado,
                    vendedor: l.vendedor_nome,
                    wa_link: `https://wa.me/${l.phone.replace(/\D/g, '')}`
                }))
            };
        }

        case 'detalhar_lead': {
            let lead = null;
            if (args.lead_id) {
                lead = await db.get(
                    `SELECT l.*, s.name AS vendedor_nome, s.phone AS vendedor_phone
                     FROM leads l
                     LEFT JOIN sellers s ON s.id = l.seller_id
                     WHERE l.id = ? AND l.organization_id = ? ${isSeller ? 'AND l.seller_id = ?' : ''}`,
                    isSeller ? [args.lead_id, orgId, sellerId] : [args.lead_id, orgId]
                );
            } else if (args.termo) {
                const digits = String(args.termo).replace(/\D/g, '');
                const termStr = `%${args.termo}%`;
                lead = await db.get(
                    `SELECT l.*, s.name AS vendedor_nome, s.phone AS vendedor_phone
                     FROM leads l
                     LEFT JOIN sellers s ON s.id = l.seller_id
                     WHERE l.organization_id = ? ${isSeller ? 'AND l.seller_id = ?' : ''}
                       AND (${digits.length >= 8 ? 'l.phone LIKE ? OR l.cpf LIKE ? OR ' : ''} l.name LIKE ?)
                     ORDER BY l.updated_at DESC LIMIT 1`,
                    isSeller
                        ? (digits.length >= 8 ? [orgId, sellerId, `%${digits}%`, `%${digits}%`, termStr] : [orgId, sellerId, termStr])
                        : (digits.length >= 8 ? [orgId, `%${digits}%`, `%${digits}%`, termStr] : [orgId, termStr])
                );
            }

            if (!lead) {
                return { tool: 'detalhar_lead', encontrado: false, mensagem: 'Lead não encontrado ou sem permissão de acesso.' };
            }

            // Histórico recente de envios e de funil
            const sends = await db.all(
                `SELECT s.status, s.sent_at, s.wa_message, c.name AS campanha_nome
                 FROM sends s
                 LEFT JOIN campaigns c ON c.id = s.campaign_id
                 WHERE s.lead_id = ?
                 ORDER BY s.id DESC LIMIT 3`,
                [lead.id]
            );

            const history = await db.all(
                `SELECT from_status, to_status, created_at
                 FROM lead_history
                 WHERE lead_id = ?
                 ORDER BY id DESC LIMIT 5`,
                [lead.id]
            );

            return {
                tool: 'detalhar_lead',
                encontrado: true,
                lead: {
                    id: lead.id,
                    nome: lead.name,
                    telefone: lead.phone,
                    cpf: lead.cpf,
                    status: lead.status,
                    score: lead.score || 50,
                    prioridade: lead.prioridade,
                    cidade: lead.city,
                    renda: lead.renda,
                    limite_est: lead.limite_est,
                    valor_desejado: lead.valor_desejado,
                    origem: lead.origem,
                    obs: lead.obs,
                    vendedor: lead.vendedor_nome,
                    wa_link: `https://wa.me/${lead.phone.replace(/\D/g, '')}`,
                    ultimos_disparos: sends,
                    historico_status: history
                }
            };
        }

        case 'mover_estagio_funil': {
            const leadId = Number(args.lead_id);
            const novoStatus = String(args.novo_status || '').toLowerCase();
            const allowed = ['novos', 'enviados', 'sim', 'nao', 'bloqueado'];
            if (!allowed.includes(novoStatus)) {
                return { erro: `Status '${novoStatus}' inválido. Válidos: ${allowed.join(', ')}` };
            }

            // Checa lead
            const lead = await db.get(
                `SELECT * FROM leads WHERE id = ? AND organization_id = ? ${isSeller ? 'AND seller_id = ?' : ''}`,
                isSeller ? [leadId, orgId, sellerId] : [leadId, orgId]
            );

            if (!lead) {
                return { erro: 'Lead não encontrado ou você não tem permissão para editá-lo.' };
            }

            const statusAnterior = lead.status;
            await leadService.updateStatus(leadId, lead.seller_id, novoStatus);

            if (args.observacao) {
                const obsNova = lead.obs
                    ? `${lead.obs} | [Copilot ${new Date().toLocaleDateString('pt-BR')}]: ${args.observacao}`
                    : `[Copilot ${new Date().toLocaleDateString('pt-BR')}]: ${args.observacao}`;
                await db.run('UPDATE leads SET obs = ? WHERE id = ?', [obsNova, leadId]);
            }

            return {
                tool: 'mover_estagio_funil',
                sucesso: true,
                lead_id: leadId,
                nome: lead.name,
                status_anterior: statusAnterior,
                novo_status: novoStatus,
                observacao_adicionada: args.observacao || null
            };
        }

        case 'gerar_abordagem': {
            let nomeCliente = args.nome_cliente || 'Cliente';
            let limiteEst = null;
            let cidade = null;

            if (args.lead_id) {
                const lead = await db.get(
                    `SELECT * FROM leads WHERE id = ? AND organization_id = ? ${isSeller ? 'AND seller_id = ?' : ''}`,
                    isSeller ? [args.lead_id, orgId, sellerId] : [args.lead_id, orgId]
                );
                if (lead) {
                    nomeCliente = lead.name.split(' ')[0];
                    limiteEst = lead.limite_est;
                    cidade = lead.city;
                }
            }

            const tipo = (args.tipo || 'consignado').toLowerCase();
            let abordagem = '';
            let titulo = '';

            switch (tipo) {
                case 'consignado':
                    titulo = 'Abordagem Consignado / Margem Livre (INSS / SIAPE)';
                    abordagem = `Olá, ${nomeCliente}! Tudo bem? 😃\n\nSou consultor(a) da *Prime Sul* especializada em crédito consignado. Verifiquei aqui no sistema que há uma oportunidade excelente com redução de taxas e margem pré-aprovada${limiteEst ? ` de aproximadamente *${limiteEst}*` : ''}.\n\nVocê tem 2 minutinhos para conferirmos se liberou direto na sua folha, sem mexer no que você já tem? Me dá um *SIM* para eu te mandar a tabela detalhada! 📈`;
                    break;

                case 'fgts':
                    titulo = 'Abordagem Antecipação Saque-Aniversário FGTS';
                    abordagem = `Olá, ${nomeCliente}! Como vai? 💸\n\nSabia que você pode antecipar até 10 parcelas do seu Saque-Aniversário do FGTS direto na sua conta, sem pagar boleto mensal nem comprometer seu salário?\n\nO desconto é feito apenas 1x ao ano no próprio saldo FGTS! Posso fazer uma consulta rápida do valor disponível agora mesmo sem nenhum custo? Responda *QUERO*! 👍`;
                    break;

                case 'reengajamento':
                    titulo = 'Reengajamento de Lead Frio / Parado';
                    abordagem = `Olá, ${nomeCliente}! Passando rapidinho pra saber se você ainda tem interesse em consultar condições especiais de crédito com a Prime Sul.\n\nTivemos uma atualização nas tabelas com taxas reduzidas essa semana. Se fizer sentido para você agora, responda com *OPORTUNIDADE* e te envio a melhor simulação! 🤝`;
                    break;

                case 'fechamento':
                    titulo = 'Fechamento / Assinatura de Contrato';
                    abordagem = `Olá, ${nomeCliente}! Aprovamos a sua proposta com as melhores condições do dia! 🚀\n\nPara liberarmos o crédito na sua conta nas próximas horas, só precisamos confirmar os seus dados e fazer a assinatura digital segura pelo celular.\n\nPodemos fazer agora? É super rápido e 100% online. Confirma comigo? ✨`;
                    break;

                case 'revisao_margem':
                    titulo = 'Revisão de Margem e Portabilidade';
                    abordagem = `Oi, ${nomeCliente}! Notícia importante: saiu uma nova tabela de portabilidade com redução de parcelas e troco em conta! 💰\n\nPodemos analisar os seus contratos antigos para reduzir o valor das parcelas ou liberar um valor extra sem aumentar o desconto? Me avisa se posso calcular para você! 😉`;
                    break;

                default:
                    titulo = 'Primeiro Contato Institucional';
                    abordagem = `Olá, ${nomeCliente}! Aqui é da *Prime Sul*. Você solicitou uma simulação de crédito conosco recentemente. Gostaria de receber os valores e prazos disponíveis para você agora? Responda *SIM* para continuar!`;
                    break;
            }

            return {
                tool: 'gerar_abordagem',
                tipo,
                titulo,
                texto: abordagem,
                cliente: nomeCliente,
                dica_venda: 'Personalize o início citando a cidade ou o valor pretendido para aumentar a taxa de resposta em até 40%.'
            };
        }

        case 'metricas_operacao': {
            const counts = await leadService.countsBySeller(sellerId);
            const funnel = await leadService.funnelBySeller(sellerId);
            return {
                tool: 'metricas_operacao',
                sucesso: true,
                leads: counts.leads,
                envios: counts.envios,
                confirmados: counts.confirmados,
                conversao: counts.conversao,
                funil: funnel
            };
        }

        case 'status_anti_ban': {
            await antiBan.ensureFresh();
            const limit = await antiBan.currentLimit();
            const cooldownHours = await antiBan.currentCooldownHours();

            const numbers = await db.all(
                `SELECT id, number, label, status, messages_sent, cooled_until, seller_id
                 FROM bot_numbers
                 WHERE organization_id = ? ${isSeller ? 'AND (seller_id IS NULL OR seller_id = ?)' : ''}
                 ORDER BY status ASC, messages_sent DESC`,
                isSeller ? [orgId, sellerId] : [orgId]
            );

            const total = numbers.length;
            const ativos = numbers.filter(n => n.status === 'ativo').length;
            const resfriados = numbers.filter(n => n.status === 'resfriado').length;
            const banidos = numbers.filter(n => n.status === 'banido').length;
            const msgsHoje = numbers.reduce((acc, n) => acc + (n.messages_sent || 0), 0);
            const capacidadeTotalDia = total * limit;

            return {
                tool: 'status_anti_ban',
                resumo: {
                    total_numeros: total,
                    ativos,
                    resfriados,
                    banidos,
                    mensagens_enviadas_hoje: msgsHoje,
                    limite_por_numero: limit,
                    capacidade_restante: Math.max(0, capacidadeTotalDia - msgsHoje),
                    tempo_cooldown_horas: cooldownHours,
                    saude_sistema: banidos === 0 ? 'Excelente (Sem banimentos)' : `${banidos} número(s) requerem atenção`
                },
                numeros: numbers.map(n => ({
                    id: n.id,
                    numero: n.number,
                    label: n.label || 'Bot Disparo',
                    status: n.status,
                    envios_hoje: `${n.messages_sent || 0}/${limit}`,
                    resfriado_ate: n.cooled_until || null
                }))
            };
        }

        case 'criar_disparo_rapido': {
            const nomeCampanha = args.nome_campanha || `Disparo Copilot ${new Date().toLocaleDateString('pt-BR')}`;
            const mensagem = args.mensagem;
            const statusAlvo = args.status_alvo || 'novos';
            const limiteLeads = Math.min(Number(args.limite) || 20, 100);

            if (!mensagem) {
                return { erro: 'Mensagem obrigatória para criar a campanha.' };
            }

            const campaign = await campaignService.createCampaign({
                seller_id: sellerId,
                organization_id: orgId,
                name: nomeCampanha,
                message: mensagem,
                filters: {
                    status: [statusAlvo],
                    limit: limiteLeads
                }
            });

            return {
                tool: 'criar_disparo_rapido',
                sucesso: true,
                campanha_id: campaign.id,
                nome: campaign.name,
                status: campaign.status,
                leads_selecionados: campaign.total_target,
                mensagem_prevista: mensagem.substring(0, 100) + '...'
            };
        }

        default:
            return { erro: `Tool desconhecida: ${name}` };
    }
}

// ---------------------------------------------------------------------------
// 3. NLP Router Inteligente (Offline / Fallback / Instantâneo)
// ---------------------------------------------------------------------------
function matchIntentAndTool(userMessage) {
    const text = userMessage.toLowerCase().trim();

    // 1. Status Anti-Ban / Bots / WhatsApp
    if (
        /(anti-?ban|status\s*dos?\s*bots?|bots?|chips?|numeros?|instancia|limite|capacidade|quantos\s*envios|quantas\s*mensagens|sa[uú]de)/i.test(text) &&
        !/(criar campanha|disparar)/i.test(text)
    ) {
        return { name: 'status_anti_ban', args: {} };
    }

    // 2. Gerar Abordagem / Copy WhatsApp / Mensagem de Venda
    if (/(abordag|copy|texto de|mensagem de|escrever mensagem|gerar mensagem|como abordar|mandar mensagem)/i.test(text) && !/(criar campanha|disparar em massa)/i.test(text)) {
        let tipo = 'consignado';
        if (/fgts|saque/i.test(text)) tipo = 'fgts';
        else if (/reengaja|frio|sumid|recontat/i.test(text)) tipo = 'reengajamento';
        else if (/fechamento|assina|contrato/i.test(text)) tipo = 'fechamento';
        else if (/revis|portabilidade|troco/i.test(text)) tipo = 'revisao_margem';
        else if (/primeiro contato|ol[aá]|bom dia/i.test(text)) tipo = 'primeiro_contato';

        const matchId = text.match(/(?:lead\s*#?|id\s*#?|#)([0-9]+)/i);
        const lead_id = matchId ? Number(matchId[1]) : null;

        const matchNome = text.match(/(?:cliente|para\s+a|para\s+o)\s+([a-zA-ZÀ-ÿ]+)/i);
        const nome_cliente = matchNome ? matchNome[1] : undefined;

        return { name: 'gerar_abordagem', args: { tipo, lead_id, nome_cliente } };
    }

    // 3. Métricas e Desempenho Real da Operação no CRM
    if (/(m[eé]trica|desempenho|resultado|convers[aã]o|contador|quantos leads|meu funil|funil de vendas|kpi|estat[ií]stica)/i.test(text)) {
        return { name: 'metricas_operacao', args: {} };
    }

    // 4. Mover Estágio do Funil
    if (/(mudar status|mova|mover|alterar status|colocar em|passar para|avançar|bloquear lead|marcar como)/i.test(text)) {
        let novo_status = 'sim';
        if (/bloque|opt-?out|reclam/i.test(text)) novo_status = 'bloqueado';
        else if (/n[aã]o|recus|perdid/i.test(text)) novo_status = 'nao';
        else if (/enviad|contat/i.test(text)) novo_status = 'enviados';
        else if (/novo/i.test(text)) novo_status = 'novos';
        else if (/sim|ganho|fechad|interess/i.test(text)) novo_status = 'sim';

        const matchId = text.match(/(?:lead\s*#?|id\s*#?|#)([0-9]+)/i);
        const lead_id = matchId ? Number(matchId[1]) : null;

        if (lead_id) {
            return { name: 'mover_estagio_funil', args: { lead_id, novo_status } };
        }
    }

    // 5. Detalhar Lead Específico
    const matchDetalhe = text.match(/(?:detalh|ficha|dados|info|ver)\s+(?:do\s+)?lead\s*#?([0-9]+)/i);
    if (matchDetalhe) {
        return { name: 'detalhar_lead', args: { lead_id: Number(matchDetalhe[1]) } };
    }

    // 6. Consultar Leads / Busca no CRM
    if (/(lead|cliente|contato|busca|procura|pesquisa|lista|mostrar|quem)/i.test(text)) {
        let status = null;
        if (/novos?/i.test(text)) status = 'novos';
        else if (/enviados?/i.test(text)) status = 'enviados';
        else if (/sim|ganhos?|fechados?/i.test(text)) status = 'sim';
        else if (/n[aã]os?|recusados?/i.test(text)) status = 'nao';

        // Tenta achar nome ou termo
        const cleanTerm = text
            .replace(/(leads?|clientes?|contatos?|mostrar|buscar|pesquisar|listar|novos?|enviados?|sim|n[aã]o|quem [eé]|por favor|do funil)/gi, '')
            .trim();

        return {
            name: 'consultar_leads',
            args: {
                termo: cleanTerm.length > 2 ? cleanTerm : '',
                status: status || 'todos',
                limite: 5
            }
        };
    }

    return null;
}

// ---------------------------------------------------------------------------
// 4. Orquestrador Principal do Copilot
// ---------------------------------------------------------------------------
async function processMessage({ message, conversationHistory = [], userContext = {} }) {
    const roleName = userContext.role === 'admin' ? 'Administrador' : 'Vendedor Operador';
    const userName = userContext.name || 'Usuário';

    // 1. Tenta identificar se o usuário chamou uma tool de imediato via NLP
    const matchedIntent = matchIntentAndTool(message);
    let toolResult = null;
    let executedTool = null;

    if (matchedIntent) {
        executedTool = matchedIntent.name;
        toolResult = await executeTool(matchedIntent.name, matchedIntent.args, userContext);
    }

    // 2. Se houver chave de API configurada (OpenAI ou NVIDIA/OpenRouter), usa LLM para síntese de alto nível
    if (OPENAI_API_KEY) {
        try {
            const systemPrompt = [
                `Você é o Copilot IA da Prime Sul Soluções Financeiras, assistente especialista em crédito consignado, antecipação Saque-Aniversário FGTS e gestão de funil comercial WhatsApp.`,
                `Você está conversando com: ${userName} (${roleName}).`,
                `Responda de forma ágil, profissional, prestativa e motivadora, focada em ajudar a fechar negócios e proteger os números do banimento.`,
                `Use markdown com negrito para valores e números, listas com marcadores e formatação clara.`,
                toolResult ? `Uma tool foi executada (${executedTool}) e retornou os seguintes dados estruturados:\n${JSON.stringify(toolResult, null, 2)}.\nUtilize esses dados para responder e explicar a resposta ao usuário de forma amigável.` : `Nenhuma tool específica foi disparada automaticamente. Responda a dúvida do usuário sobre o sistema, crédito ou vendas.`
            ].join('\n\n');

            const messages = [
                { role: 'system', content: systemPrompt },
                ...conversationHistory.slice(-4).map(m => ({ role: m.role, content: m.content })),
                { role: 'user', content: message }
            ];

            const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: COPILOT_MODEL,
                    temperature: 0.4,
                    messages
                })
            });

            if (response.ok) {
                const data = await response.json();
                const replyText = data?.choices?.[0]?.message?.content;
                if (replyText) {
                    return {
                        reply: replyText.trim(),
                        tool: executedTool,
                        tool_data: toolResult,
                        mode: 'llm_enhanced'
                    };
                }
            }
        } catch (e) {
            console.warn('[copilot] Fallback para motor nativo:', e.message);
        }
    }

    // 3. Fallback Nativo (100% Funcional sem chaves de API externas)
    let reply = '';
    if (toolResult) {
        switch (executedTool) {
            case 'consultar_leads':
                if (!toolResult.leads || toolResult.leads.length === 0) {
                    reply = `🔎 Não encontrei nenhum lead com os critérios informados. Deseja cadastrar um novo lead ou buscar por outro termo?`;
                } else {
                    reply = `📋 Encontrei **${toolResult.leads.length} lead(s)** no CRM:\n\n` +
                        toolResult.leads.map(l =>
                            `• **#${l.id} - ${l.nome}** (${l.cidade})\n  📱 ${l.telefone} | Estágio: **${l.status.toUpperCase()}** | Score: **${l.score}/100**\n  💰 Renda/Limite: ${l.limite_est || l.renda || 'Não inf.'}`
                        ).join('\n\n') +
                        `\n\n💡 _Dica: Digite "ver ficha do lead #${toolResult.leads[0].id}" ou "gerar abordagem para lead #${toolResult.leads[0].id}"._`;
                }
                break;

            case 'detalhar_lead':
                if (!toolResult.encontrado) {
                    reply = `⚠️ ${toolResult.mensagem}`;
                } else {
                    const l = toolResult.lead;
                    reply = `👤 **Ficha do Lead #${l.id} — ${l.nome}**\n\n` +
                        `• **Telefone:** ${l.telefone}\n` +
                        `• **CPF:** ${l.cpf || 'Não informado'}\n` +
                        `• **Cidade:** ${l.cidade || 'Não informada'}\n` +
                        `• **Estágio Funil:** ${l.status.toUpperCase()} (Prioridade ${l.prioridade.toUpperCase()})\n` +
                        `• **Score de Conversão:** ${l.score}/100 ⭐\n` +
                        `• **Renda / Limite:** ${l.renda || l.limite_est || 'Em análise'}\n` +
                        `• **Vendedor Responsável:** ${l.vendedor || 'Institucional'}\n` +
                        (l.obs ? `• **Observações:** ${l.obs}\n` : '') +
                        `\n👉 [Abrir conversa no WhatsApp](${l.wa_link})`;
                }
                break;

            case 'mover_estagio_funil':
                if (toolResult.erro) {
                    reply = `❌ ${toolResult.erro}`;
                } else {
                    reply = `✅ **Lead #${toolResult.lead_id} (${toolResult.nome})** atualizado com sucesso!\n\n` +
                        `• De: **${toolResult.status_anterior.toUpperCase()}** ➔ Para: **${toolResult.novo_status.toUpperCase()}**` +
                        (toolResult.observacao_adicionada ? `\n• Nota registrada: _"${toolResult.observacao_adicionada}"_` : '');
                }
                break;

            case 'gerar_abordagem':
                reply = `✨ **${toolResult.titulo}**\n\n` +
                    `\`\`\`\n${toolResult.texto}\n\`\`\`\n\n` +
                    `💡 **Dica de Venda:** ${toolResult.dica_venda}`;
                break;

            case 'metricas_operacao':
                reply = `📊 **Métricas da Operação em Tempo Real (Dados Reais do CRM)**\n\n` +
                    `• **Leads Cadastrados:** **${toolResult.leads}**\n` +
                    `• **Disparos Efetuados:** **${toolResult.envios}**\n` +
                    `• **Leads Confirmados (Respostas SIM):** **${toolResult.confirmados}**\n` +
                    `• **Taxa de Conversão:** **${toolResult.conversao}%**\n\n` +
                    (toolResult.funil ? `**Distribuição no Funil:**\n• Novos: **${toolResult.funil.novos || 0}** | Contatados: **${toolResult.funil.enviados || 0}** | Em Negociação (SIM): **${toolResult.funil.sim || 0}** | Não: **${toolResult.funil.nao || 0}**` : '');
                break;

            case 'status_anti_ban':
                const r = toolResult.resumo;
                reply = `🛡️ **Status do Sistema Anti-Ban & WhatsApp**\n\n` +
                    `• **Saúde Geral:** ${r.saude_sistema}\n` +
                    `• **Números Ativos:** ${r.ativos} / ${r.total_numeros}\n` +
                    `• **Resfriados:** ${r.resfriados} | **Banidos:** ${r.banidos}\n` +
                    `• **Envios Hoje:** ${r.mensagens_enviadas_hoje} mensagens\n` +
                    `• **Capacidade Restante Hoje:** ~${r.capacidade_restante} disparos\n` +
                    `• **Limite Seguro Diário:** ${r.limite_por_numero} msgs/número (${r.tempo_cooldown_horas}h cooldown)\n\n` +
                    `O fluxo rotativo e resfriamento automático estão operando normalmente.`;
                break;

            case 'criar_disparo_rapido':
                if (toolResult.erro) {
                    reply = `❌ ${toolResult.erro}`;
                } else {
                    reply = `🚀 **Campanha Criada com Sucesso!**\n\n` +
                        `• ID: **#${toolResult.campanha_id}**\n` +
                        `• Nome: **${toolResult.nome}**\n` +
                        `• Leads Selecionados: **${toolResult.leads_selecionados}**\n` +
                        `• Status: **${toolResult.status.toUpperCase()}**\n\n` +
                        `A campanha respeitará as pausas aleatórias do motor anti-ban para garantir a entrega segura.`;
                }
                break;
        }
    } else {
        reply = `👋 Olá, **${userName}**! Sou o **Copilot IA da Prime Sul**.\n\nPosso te ajudar em tempo real com ferramentas integradas ao CRM:\n\n` +
            `• 🔎 **Buscar Leads:** _"Buscar lead Carlos"_, _"Mostrar leads novos"_\n` +
            `• 📋 **Ficha de Lead:** _"Ver ficha do lead #1"_\n` +
            `• 🔄 **Avançar Funil:** _"Mover lead #1 para sim"_, _"Bloquear lead #2"_\n` +
            `• ✨ **Criar Abordagem:** _"Criar mensagem FGTS"_, _"Abordagem consignado"_\n` +
            `• 📊 **Métricas da Operação:** _"Ver minhas métricas"_, _"Taxa de conversão de hoje"_\n` +
            `• 🛡️ **Anti-Ban:** _"Status dos bots"_, _"Limite de disparos hoje"_\n\n` +
            `O que você precisa agora?`;
    }

    return {
        reply,
        tool: executedTool,
        tool_data: toolResult,
        mode: 'native_engine'
    };
}

module.exports = {
    TOOLS_SPEC,
    executeTool,
    matchIntentAndTool,
    processMessage
};
