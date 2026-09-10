#!/usr/bin/env node
/**
 * PRIME SUL — Unificação de telefones no banco
 * ---------------------------------------------------------------------------
 * Fase 1: funde leads duplicados que são o MESMO número em formas diferentes
 *         ("554191798537" x "5541991798537"), reapontando sends / lead_history
 *         / followups / handoffs para o lead mais antigo.
 * Fase 2: normaliza leads.phone / phone2 / phone3 e opt_outs.phone para a forma
 *         canônica (celular BR sempre COM o 9).
 *
 * A ordem importa: fundir primeiro evita colisão no índice UNIQUE de leads.phone
 * quando dois leads viram o mesmo número após a normalização.
 *
 * Uso:
 *   node scripts/dedupe_phones.js            # dry-run (só mostra o que faria)
 *   node scripts/dedupe_phones.js --apply    # aplica de verdade
 *
 * Fusão só acontece entre leads do MESMO vendedor. Duplicados de vendedores
 * diferentes são apenas listados (decisão manual — envolve carteira).
 */
require('dotenv').config();
const db = require('../server/database/db');
const { phoneKey } = require('../server/utils/phone');

const APPLY = process.argv.includes('--apply');

// Quanto maior, mais "avançado" no funil — na fusão o lead vencedor herda o
// status mais avançado do grupo. Cobre os dois vocabulários de status usados.
const STATUS_RANK = {
    bloqueado: -1, duplicado: -1, nao: -1,
    novo: 0, novos: 0,
    contato: 1, enviados: 1,
    confirmado: 2, sim: 2,
    concluido: 3
};
const rank = s => (STATUS_RANK[s] ?? 0);

const CHILD_TABLES = ['sends', 'lead_history', 'followups', 'handoffs'];

async function mergeDuplicates(leads) {
    const groups = new Map(); // "org:phoneKey" -> [lead, ...]
    for (const l of leads) {
        const k = phoneKey(l.phone);
        if (!k) continue;
        const gk = `${l.organization_id || 1}:${k}`;
        if (!groups.has(gk)) groups.set(gk, []);
        groups.get(gk).push(l);
    }

    let merged = 0, conflicts = 0;
    for (const [gk, list] of groups) {
        if (list.length < 2) continue;

        if (new Set(list.map(l => l.seller_id)).size > 1) {
            conflicts++;
            console.log(`⚠️  CONFLITO ${gk}: mesmo número em vendedores diferentes — ` +
                list.map(l => `#${l.id}(${l.name}/vend ${l.seller_id})`).join(', ') + ' — pulado');
            continue;
        }

        const keeper = list.reduce((a, b) => (a.id <= b.id ? a : b)); // mais antigo
        const losers = list.filter(l => l.id !== keeper.id);

        let bestStatus = keeper.status;
        for (const l of list) if (rank(l.status) > rank(bestStatus)) bestStatus = l.status;

        const fill = {};
        for (const f of ['cpf', 'phone2', 'phone3', 'city', 'renda', 'limite_est', 'valor_desejado', 'tags', 'score']) {
            if (keeper[f] == null || keeper[f] === '') {
                const donor = losers.find(l => l[f] != null && l[f] !== '');
                if (donor) fill[f] = donor[f];
            }
        }
        const obsParts = list.map(l => l.obs).filter(Boolean);
        const mergedObs = obsParts.length ? obsParts.join('\n---\n') : null;

        console.log(`FUNDIR ${gk}: manter #${keeper.id} (${keeper.name}), absorver ` +
            losers.map(l => `#${l.id}(${l.name})`).join(', ') +
            ` | status -> ${bestStatus}` +
            (Object.keys(fill).length ? ` | preenche ${Object.keys(fill).join(',')}` : ''));

        if (APPLY) {
            for (const l of losers) {
                for (const t of CHILD_TABLES) {
                    await db.run(`UPDATE ${t} SET lead_id = ? WHERE lead_id = ?`, [keeper.id, l.id])
                        .catch(e => console.error(`  erro movendo ${t} do lead ${l.id}:`, e.message));
                }
                await db.run('DELETE FROM leads WHERE id = ?', [l.id]);
            }
            const sets = { status: bestStatus, ...fill };
            if (mergedObs) sets.obs = mergedObs;
            const cols = Object.keys(sets).map(k => `${k} = ?`).join(', ');
            await db.run(`UPDATE leads SET ${cols}, updated_at = datetime('now') WHERE id = ?`,
                [...Object.values(sets), keeper.id]);
        }
        merged += losers.length;
    }
    return { merged, conflicts };
}

async function normalizePhones() {
    const leads = await db.all('SELECT * FROM leads ORDER BY id ASC');
    let normCount = 0;
    for (const l of leads) {
        const patch = {};
        for (const f of ['phone', 'phone2', 'phone3']) {
            if (!l[f]) continue;
            const canon = phoneKey(l[f]);
            if (canon && canon !== l[f]) patch[f] = canon;
        }
        if (!Object.keys(patch).length) continue;
        normCount++;
        console.log(`lead #${l.id} ${l.name}: ` +
            Object.entries(patch).map(([k, v]) => `${k} "${l[k]}" -> "${v}"`).join(', '));
        if (APPLY) {
            const sets = Object.keys(patch).map(k => `${k} = ?`).join(', ');
            try {
                await db.run(`UPDATE leads SET ${sets} WHERE id = ?`, [...Object.values(patch), l.id]);
            } catch (e) {
                console.error(`  ⚠️  não normalizou lead #${l.id}: ${e.message}`);
            }
        }
    }

    let optNorm = 0;
    for (const o of await db.all('SELECT * FROM opt_outs')) {
        const canon = phoneKey(o.phone);
        if (!canon || canon === o.phone) continue;
        optNorm++;
        console.log(`opt_out #${o.id}: "${o.phone}" -> "${canon}"`);
        if (APPLY) {
            await db.run('DELETE FROM opt_outs WHERE organization_id = ? AND phone = ? AND id != ?',
                [o.organization_id, canon, o.id]).catch(() => {});
            await db.run('UPDATE opt_outs SET phone = ? WHERE id = ?', [canon, o.id]).catch(e =>
                console.error(`  ⚠️  opt_out #${o.id}: ${e.message}`));
        }
    }
    return { normCount, optNorm };
}

async function run() {
    await db.init();
    console.log(APPLY ? '=== MODO APLICAR ===\n' : '=== DRY-RUN (nada será alterado) ===\n');

    console.log('--- Fase 1: fusão de duplicados ---');
    const leads = await db.all('SELECT * FROM leads ORDER BY id ASC');
    const { merged, conflicts } = await mergeDuplicates(leads);
    console.log(`${merged} lead(s) duplicado(s) ${APPLY ? 'fundido(s)' : 'seriam fundidos'}` +
        (conflicts ? `, ${conflicts} conflito(s) de vendedor ignorado(s)` : '') + '.\n');

    console.log('--- Fase 2: normalização de telefones ---');
    const { normCount, optNorm } = await normalizePhones();
    console.log(`${normCount} lead(s) e ${optNorm} opt_out(s) ${APPLY ? 'normalizado(s)' : 'seriam normalizados'}.`);

    if (!APPLY) console.log('\nRode com --apply para aplicar.');
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
