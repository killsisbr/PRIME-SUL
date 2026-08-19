const db = require('../database/db');

// Produtos da vitrine — focados em coleta de lead, sem expor taxas/valores.
// Sobrescritos pelas settings do painel (key: site_products).
const DEFAULT_PRODUCTS = [
    {
        id: 'emprestimo',
        name: 'Empréstimo Pessoal',
        tagline: 'Crédito rápido, sem burocracia',
        desc: 'Você preenche em 30 segundos e nossa equipe analisa seu caso.',
        icone: 'fa-money-bill-wave',
        cor: '#ff7417',
        beneficios: ['Contratação 100% digital', 'Atendimento humanizado no WhatsApp', 'Sem consulta à restrição']
    },
    {
        id: 'consignado',
        name: 'Crédito Consignado',
        tagline: 'A condição que cabe no seu bolso',
        desc: 'Parcelas descontadas direto no benefício ou folha de pagamento.',
        icone: 'fa-building-columns',
        cor: '#3b82f6',
        beneficios: ['Desconto em folha ou benefício', 'Condições especiais para aposentados', 'Análise gratuita e sem compromisso']
    },
    {
        id: 'consorcio',
        name: 'Consórcio',
        tagline: 'Realize seus planos com tranquilidade',
        desc: 'Planeje a aquisição do seu bem com parcelas que cabem no orçamento.',
        icone: 'fa-hand-holding-dollar',
        cor: '#10b981',
        beneficios: ['Sem entrada', 'Planejamento de longo prazo', 'Acompanhamento dedicado']
    }
];

const KNOWN_IDS = DEFAULT_PRODUCTS.map(p => p.id);

async function list() {
    const raw = await db.get('SELECT value FROM settings WHERE key = ?', ['site_products']);
    let custom = [];
    if (raw && raw.value) {
        try {
            const parsed = JSON.parse(raw.value);
            if (Array.isArray(parsed)) custom = parsed;
        } catch (e) { console.warn('[vitrine] settings site_products inválida:', e.message); }
    }
    return DEFAULT_PRODUCTS.map(base => {
        const c = custom.find(p => p && p.id === base.id);
        if (!c) return base;
        return {
            ...base,
            name: c.name || base.name,
            tagline: c.tagline || base.tagline,
            desc: c.desc || base.desc,
            icone: c.icone || base.icone,
            cor: c.cor || base.cor,
            beneficios: Array.isArray(c.beneficios) && c.beneficios.length ? c.beneficios : base.beneficios
        };
    });
}

async function getById(id) {
    const all = await list();
    return all.find(p => p.id === id) || null;
}

module.exports = { list, getById, KNOWN_IDS, DEFAULT_PRODUCTS };