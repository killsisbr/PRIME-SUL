function normalizePhone(input) {
    if (!input) return null;
    let p = String(input).replace(/\D/g, '');
    if (p.length === 10 || p.length === 11) p = '55' + p;      // nacional → E.164
    if (p.startsWith('0')) p = '55' + p.slice(1);               // remove 0 discagem
    return p;
}

function isValidPhone(p) {
    return /^55[1-9]\d{10,11}$/.test(p);
}

module.exports = { normalizePhone, isValidPhone };