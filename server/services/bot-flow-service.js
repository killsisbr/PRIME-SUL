const db = require('../database/db');
const whatsapp = require('./whatsapp-service');

const YES = (process.env.BOT_CONFIRM_KEYWORDS || 'sim,sim,ok,confirmo,quero,claro,pode,pode sim')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const NO = (process.env.BOT_DENY_KEYWORDS || 'nao,não,nope,dispenso,obrigado')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

function normalizeText(t) { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

function match(text, list) {
    const t = normalizeText(text);
    return list.some(k => {
        const nk = normalizeText(k);
        return t === nk || t.startsWith(nk + ' ') || t.includes(' ' + nk) || t.startsWith(nk);
    });
}

// Registra o fluxo de confirmação no bot principal
function register() {
    whatsapp.onMessage(async ({ botNumber, phone, text }) => {
        // Encontra o envio pendente/enviado deste lead no número do bot principal
        const send = await db.get(`
            SELECT s.*, l.name AS lead_name, l.seller_id, c.name AS campaign_name
            FROM sends s
            JOIN leads l ON l.id = s.lead_id
            LEFT JOIN campaigns c ON c.id = s.campaign_id
            WHERE l.phone = ? AND s.number_id IN (
                SELECT id FROM bot_numbers WHERE number = ?
            )
            ORDER BY s.id DESC LIMIT 1
        `, [phone, botNumber]);

        if (!send) return;

        if (match(text, YES)) {
            await db.run("UPDATE sends SET status = 'confirmado', replied_at = datetime('now') WHERE id = ?", [send.id]);
            await db.run("UPDATE leads SET status = 'confirmado', updated_at = datetime('now') WHERE id = ?", [send.lead_id]);
            await db.run(
                "UPDATE campaigns SET total_yes = total_yes + 1 WHERE id = ?",
                [send.campaign_id]
            );

            // Repassa para o bot do vendedor dono do lead
            const seller = await db.get('SELECT * FROM sellers WHERE id = ?', [send.seller_id]);
            if (seller && seller.phone) {
                await whatsapp.connect(seller.phone, `vendedor-${seller.id}`);
                const ok = await whatsapp.sendMessage(
                    seller.phone,
                    phone,
                    `Cliente confirmou interesse!\n\n*${send.lead_name}*\nQuer receber a simulação de crédito.`
                );
                if (!ok.sent) {
                    console.warn(`[bot-flow] Bot do vendedor ${seller.phone} offline — repasse pendente`);
                }
            }
        } else if (match(text, NO)) {
            await db.run("UPDATE sends SET status = 'recusado', replied_at = datetime('now') WHERE id = ?", [send.id]);
            await db.run("UPDATE leads SET status = 'bloqueado', updated_at = datetime('now') WHERE id = ?", [send.lead_id]);
            console.log(`[bot-flow] Lead ${send.lead_id} recusou — bloqueado`);
        }
    });
}

module.exports = { register };