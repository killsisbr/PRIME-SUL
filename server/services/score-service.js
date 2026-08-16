const db = require('../database/db');

// Converte "R$ 4.500,00" / "4500" / "15.000" para número
function moneyNum(v) {
    if (v === null || v === undefined) return null;
    const s = String(v);
    const d = s.replace(/[^\d]/g, '');
    if (!d) return null;
    return /,\d{2}/.test(s) ? parseFloat(d) / 100 : parseFloat(d);
}

// Score 0-100 explicável: quanto mais dados e melhor a qualidade do lead, maior o score.
function computeScore(lead) {
    let s = 0;

    // Completude do cadastro
    if (lead.name && lead.name.trim()) s += 5;
    if (lead.city && lead.city.trim()) s += 5;

    // Renda estimada (fator mais importante no crédito)
    const renda = moneyNum(lead.renda);
    if (renda !== null && renda > 0) {
        s += renda >= 6000 ? 25 : renda >= 4000 ? 20 : renda >= 2500 ? 15 : renda >= 1200 ? 10 : 5;
    }

    // Limite estimado preenchido
    if (moneyNum(lead.limite_est) !== null) s += 15;

    // Valor desejado
    const valor = moneyNum(lead.valor_desejado);
    if (valor !== null && valor > 0) {
        s += valor >= 50000 ? 15 : valor >= 20000 ? 12 : valor >= 10000 ? 9 : 6;
    }

    // Origem (indicação e simulação convertem mais)
    const origem = (lead.origem || '').toUpperCase();
    if (origem === 'INDICACAO') s += 10;
    else if (origem === 'SIMULACAO') s += 8;
    else if (origem === 'SITE') s += 5;

    // Prioridade do vendedor
    const pri = (lead.prioridade || '').toLowerCase();
    if (pri === 'alta') s += 10;
    else if (pri === 'media') s += 5;

    // Estágio atual do funil
    switch ((lead.status || '').toLowerCase()) {
        case 'concluido': s += 20; break;
        case 'confirmado': s += 15; break;
        case 'contato': s += 5; break;
        case 'bloqueado':
        case 'duplicado': s -= 5; break;
    }

    return Math.max(0, Math.min(100, Math.round(s)));
}

async function recalcScoresFor(leadIds) {
    let scored = 0;
    let changed = 0;
    for (const id of leadIds) {
        const lead = await db.get('SELECT * FROM leads WHERE id = ?', [id]);
        if (!lead) continue;
        const next = computeScore(lead);
        scored++;
        if (lead.score !== next) {
            await db.run('UPDATE leads SET score = ? WHERE id = ?', [next, id]);
            changed++;
        }
    }
    return { scored, changed };
}

module.exports = { computeScore, recalcScoresFor };
