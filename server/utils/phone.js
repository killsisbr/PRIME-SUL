function normalizePhone(input) {
    if (!input) return null;
    let p = String(input).replace(/\D/g, '');
    if (p.length === 10 || p.length === 11) p = '55' + p;      // nacional → E.164
    if (p.startsWith('0')) p = '55' + p.slice(1);               // remove 0 discagem
    if (p.length < 12 || p.length > 15 || /^0/.test(p)) return null;
    return p;
}

module.exports = { normalizePhone };
