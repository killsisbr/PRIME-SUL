const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const testDb = path.join(os.tmpdir(), `prime-sul-${process.pid}.db`);
process.env.DB_PATH = testDb;
process.env.BOT_ENABLED = 'false';
const db = require('../server/database/db');
const { normalizePhone } = require('../server/utils/phone');
const campaign = require('../server/services/campaign-service');
const botFlow = require('../server/services/bot-flow-service');
const antiBan = require('../server/services/anti-ban-service');
const stageConfig = require('../server/services/stage-config-service');

test.before(async () => { await db.init(); await db.migrate(); });
test.after(() => { db.db.close(() => { for (const suffix of ['', '-wal', '-shm']) fs.rmSync(testDb + suffix, { force: true }); }); });

test('normaliza apenas telefones E.164 plausíveis', () => {
    assert.equal(normalizePhone('(11) 99999-0000'), '5511999990000');
    assert.equal(normalizePhone('123'), null);
});

test('vendedor não controla campanha de outro vendedor', async () => {
    const hash = 'x';
    const a = await db.run("INSERT INTO sellers(name,email,password,phone) VALUES('A','a@test',?,'5511999990001')", [hash]);
    const b = await db.run("INSERT INTO sellers(name,email,password,phone) VALUES('B','b@test',?,'5511999990002')", [hash]);
    const c = await db.run("INSERT INTO campaigns(organization_id,seller_id,name,message) VALUES(1,?,'C','M')", [a.lastID]);
    await assert.rejects(() => campaign.pauseCampaign(c.lastID, b.lastID, 'seller'), /Acesso negado/);
});

test('confirmação é idempotente e cria um único handoff', async () => {
    const seller = await db.get("SELECT * FROM sellers WHERE email='a@test'");
    const number = await db.run("INSERT INTO bot_numbers(organization_id,number,label) VALUES(1,'5511888880000','triagem')");
    const lead = await db.run("INSERT INTO leads(organization_id,seller_id,name,phone) VALUES(1,?,'Cliente','5511777770000')", [seller.id]);
    const camp = await db.run("INSERT INTO campaigns(organization_id,seller_id,number_id,name,message) VALUES(1,?,?,'Teste','Oi')", [seller.id, number.lastID]);
    await db.run("INSERT INTO seller_numbers(organization_id,seller_id,number,label) VALUES(1,?,'5511666660000','principal')", [seller.id]);
    await db.run("INSERT INTO sends(campaign_id,lead_id,number_id,status) VALUES(?,?,?,'sent')", [camp.lastID, lead.lastID, number.lastID]);
    const input = { botNumber: '5511888880000', phone: '5511777770000', text: 'sim' };
    await botFlow.handleIncoming(input);
    await botFlow.handleIncoming(input);
    const updated = await db.get('SELECT total_yes FROM campaigns WHERE id=?', [camp.lastID]);
    const count = await db.get('SELECT COUNT(*) c FROM handoffs WHERE lead_id=?', [lead.lastID]);
    assert.equal(updated.total_yes, 1);
    assert.equal(count.c, 1);
});

test('rotação nunca usa número privado de outro vendedor', async () => {
    const a = await db.get("SELECT id FROM sellers WHERE email='a@test'");
    const b = await db.get("SELECT id FROM sellers WHERE email='b@test'");
    await db.run("INSERT INTO bot_numbers(organization_id,seller_id,number,label) VALUES(1,?,'5511555550000','A')", [a.id]);
    await db.run("INSERT INTO bot_numbers(organization_id,seller_id,number,label) VALUES(1,?,'5511444440000','B')", [b.id]);
    const selected = await antiBan.pickBestNumber(1, a.id);
    assert.notEqual(selected.seller_id, b.id);
});

test('automação do funil é isolada por vendedor', async () => {
    const a = await db.get("SELECT id FROM sellers WHERE email='a@test'");
    const b = await db.get("SELECT id FROM sellers WHERE email='b@test'");
    const n = await db.run("INSERT INTO bot_numbers(organization_id,seller_id,number,label) VALUES(1,?,'5511333330000','Automação A')", [a.id]);
    await stageConfig.saveForSeller('novo', { auto_send: true, message: 'Olá {nome}', number_id: n.lastID }, a.id, 1);
    const own = await stageConfig.get('novo', a.id, 1);
    const other = await stageConfig.get('novo', b.id, 1);
    assert.equal(own.auto_send, true);
    assert.equal(other.auto_send, undefined);
    await assert.rejects(() => stageConfig.saveForSeller('concluido', { auto_send: true, message: 'Oi' }, a.id, 1), /somente nas etapas/);
});
