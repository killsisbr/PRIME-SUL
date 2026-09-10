// ============================================================================
// PRIME SUL — Normalização e unificação de telefones (foco Brasil / 9º dígito)
// ----------------------------------------------------------------------------
// Estrutura de um celular BR em E.164:  55 + DDD(2) + 9 + assinante(8)  -> 13 díg
// Formato antigo (ainda usado por operadoras e por contas antigas do WhatsApp):
//                                       55 + DDD(2) +     assinante(8)  -> 12 díg
//
// O mesmo cliente aparece nas duas formas ("554191798537" x "5541991798537").
// Aqui a gente:
//   - normalizePhone : E.164 só dígitos, assume 55 quando falta o país
//   - phoneVariants  : todas as formas plausíveis do mesmo número (com/sem 9)
//   - phoneKey       : chave canônica p/ deduplicar (sempre COM o 9)
//   - samePhone      : compara dois números ignorando o 9 / máscara / +55
// ============================================================================

// Normaliza para E.164 (só dígitos, sem "+"). Retorna null se não der pra
// montar um número discável.
function normalizePhone(input) {
    if (input == null) return null;
    let p = String(input).replace(/\D/g, '');
    if (!p) return null;

    if (p.startsWith('00')) p = p.slice(2);          // prefixo internacional "00"
    // "0" de seleção de operadora na discagem nacional (0 + DDD + numero)
    if (p.length >= 11 && p.length <= 13 && p.startsWith('0')) p = p.slice(1);

    // Sem código de país (DDD + numero) -> assume Brasil
    if (p.length === 10 || p.length === 11) p = '55' + p;

    if (p.length < 12 || p.length > 15) return null;
    return p;
}

// Decompõe um número BR em { ddd, subscriber, hasNine, mobile }.
// Retorna null se não for um número BR reconhecível.
function parseBR(input) {
    const n = normalizePhone(input);
    if (!n || !n.startsWith('55')) return null;
    const rest = n.slice(2); // DDD + numero
    if (rest.length !== 10 && rest.length !== 11) return null;

    const ddd = rest.slice(0, 2);
    let subscriber = rest.slice(2);
    let hasNine = false;

    if (subscriber.length === 9) {
        hasNine = subscriber[0] === '9';
        // móvel = tem o 9 na frente; alguns fixos legados também têm 9 díg, então
        // consideramos móvel quando começa com 9.
    }
    // Primeiro dígito do assinante (sem o 9 de celular): 2-5 = fixo, 6-9 = móvel
    const core = subscriber.length === 9 && subscriber[0] === '9' ? subscriber.slice(1) : subscriber;
    const mobile = /^[6-9]/.test(core) && (subscriber.length === 8 || (subscriber.length === 9 && subscriber[0] === '9'));

    return { ddd, subscriber, core, hasNine, mobile };
}

// Todas as formas E.164 plausíveis do MESMO número. Para celular BR devolve a
// versão com o 9 e a sem o 9. Para os demais, devolve só a forma normalizada.
function phoneVariants(input) {
    const n = normalizePhone(input);
    if (!n) return [];
    const out = new Set([n]);
    const br = parseBR(n);
    if (br && br.mobile) {
        out.add(`55${br.ddd}9${br.core}`); // com 9  (13 díg)
        out.add(`55${br.ddd}${br.core}`);  // sem 9  (12 díg)
    }
    return [...out];
}

// Chave canônica para deduplicação / índice único.
// Celular BR -> sempre a forma COM o 9 (padrão atual da Anatel).
// Demais números -> a forma normalizada.
function phoneKey(input) {
    const n = normalizePhone(input);
    if (!n) return null;
    const br = parseBR(n);
    if (br && br.mobile) return `55${br.ddd}9${br.core}`;
    return n;
}

// true se os dois números são o mesmo contato (ignora máscara, +55 e o 9).
function samePhone(a, b) {
    const ka = phoneKey(a);
    const kb = phoneKey(b);
    return !!ka && ka === kb;
}

module.exports = { normalizePhone, parseBR, phoneVariants, phoneKey, samePhone };
