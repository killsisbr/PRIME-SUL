const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

process.env.DB_PATH = path.join(__dirname, 'multi-zap-test.db');
const db = require('../server/database/db');
const messageService = require('../server/services/message-service');

test.before(async () => {
    try { fs.unlinkSync(process.env.DB_PATH); } catch (e) {}
    await db.init();
    await db.migrate();
    await db.run("INSERT OR IGNORE INTO organizations (id, name) VALUES (1, 'Prime Sul')");
    await db.run("INSERT OR IGNORE INTO sellers (id, organization_id, name, email, password, phone, role) VALUES (1, 1, 'Admin', 'admin@prime.com', 'hash', '5511999990001', 'admin')");
    
    // Inserir dois bots de teste (WhatsApp 1 e WhatsApp 2)
    await db.run("INSERT OR IGNORE INTO bot_numbers (id, organization_id, number, label, slot_index, real_number, push_name, status) VALUES (101, 1, 'slot-1-1', 'WhatsApp 1', 1, '5542842991234', 'Killsis', 'ativo')");
    await db.run("INSERT OR IGNORE INTO bot_numbers (id, organization_id, number, label, slot_index, real_number, push_name, status) VALUES (102, 1, 'slot-1-2', 'WhatsApp 2', 2, '5547920056094', 'Atendimento 2', 'ativo')");

    // Inserir lead
    await db.run("INSERT OR IGNORE INTO leads (id, organization_id, seller_id, name, phone, status) VALUES (201, 1, 1, 'Rafael Teste', '5547988453168', 'novos')");

    // Limpar mensagens de testes anteriores
    await db.run("DELETE FROM messages WHERE lead_id = 201");

    // Inserir mensagens trocadas: mensagem 1 pelo WhatsApp 1, mensagem 2 pelo WhatsApp 2
    await messageService.record({
        organizationId: 1,
        leadId: 201,
        leadPhone: '5547988453168',
        botNumber: 'slot-1-1',
        direction: 'in',
        body: 'Olá, gostaria de saber sobre simulação'
    });

    await messageService.record({
        organizationId: 1,
        leadId: 201,
        leadPhone: '5547988453168',
        botNumber: 'slot-1-2',
        direction: 'out',
        body: 'Olá Rafael! Estou te respondendo pelo WhatsApp 2'
    });
});

test.after(() => {
    try {
        if (db.db && db.db.close) db.db.close();
    } catch (e) {}
});

test('summaryForLeads identifica corretamente os bots e o último bot usado', async () => {
    const summary = await messageService.summaryForLeads([201], 1);
    assert.ok(summary[201], 'Lead 201 deve estar presente no resumo');
    assert.strictEqual(summary[201].total, 2);
    assert.strictEqual(summary[201].bot_numbers.length, 2);
    assert.ok(summary[201].bot_numbers.includes('slot-1-1'));
    assert.ok(summary[201].bot_numbers.includes('slot-1-2'));

    // Verifica que os objetos dos bots vieram com labels e slot_index
    const botLabels = summary[201].bots.map(b => b.label);
    assert.ok(botLabels.includes('WhatsApp 1'));
    assert.ok(botLabels.includes('WhatsApp 2'));

    // O último bot deve ser slot-1-2 (pois foi o último inserido)
    assert.strictEqual(summary[201].last_bot.number, 'slot-1-2');
    assert.strictEqual(summary[201].last_bot.slot_index, 2);
});

test('conversationsForLead retorna threads enriquecidos com metadados dos bots e available_bots', async () => {
    const data = await messageService.conversationsForLead(201);
    assert.strictEqual(data.threads.length, 2);

    const thread1 = data.threads.find(t => t.bot_number === 'slot-1-1');
    assert.ok(thread1, 'Thread do WhatsApp 1 deve existir');
    assert.strictEqual(thread1.bot_label, 'WhatsApp 1');
    assert.strictEqual(thread1.bot_slot_index, 1);
    assert.strictEqual(thread1.bot_real_number, '5542842991234');

    const thread2 = data.threads.find(t => t.bot_number === 'slot-1-2');
    assert.ok(thread2, 'Thread do WhatsApp 2 deve existir');
    assert.strictEqual(thread2.bot_label, 'WhatsApp 2');
    assert.strictEqual(thread2.bot_slot_index, 2);

    // Available bots deve listar os bots cadastrados da organização
    assert.ok(Array.isArray(data.available_bots));
    assert.ok(data.available_bots.length >= 2);
});
