require('dotenv').config();
const db = require('../server/database/db');

async function testFlow() {
    console.log('--- TESTE END-TO-END DO CICLO HÍBRIDO ---');
    
    // 1. Login do Vendedor
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'vendedor@primesul.com.br', password: 'vendedor123456' })
    });
    const cookie = loginRes.headers.get('set-cookie');
    const loginData = await loginRes.json();
    console.log('1. Vendedor logado:', loginData.user.name, 'ID:', loginData.user.id);
    
    // 2. Cria lead de teste do vendedor
    const testPhone = '5511977779999';
    await db.run('DELETE FROM lead_history WHERE lead_id IN (SELECT id FROM leads WHERE phone = ?)', [testPhone]);
    await db.run('DELETE FROM handoffs WHERE lead_id IN (SELECT id FROM leads WHERE phone = ?)', [testPhone]);
    await db.run('DELETE FROM sends WHERE lead_id IN (SELECT id FROM leads WHERE phone = ?)', [testPhone]);
    await db.run('DELETE FROM leads WHERE phone = ?', [testPhone]);
    
    const createLeadRes = await fetch('http://localhost:5000/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
        body: JSON.stringify({
            name: 'Cliente Teste Fluxo Hibrido',
            phone: testPhone,
            origem: 'SIMULACAO',
            prioridade: 'alta',
            renda: 5000,
            valor_desejado: 15000
        })
    });
    const leadCreated = await createLeadRes.json();
    console.log('2. Lead cadastrado pelo vendedor:', leadCreated.name, 'ID:', leadCreated.id, 'Status:', leadCreated.status);
    
    // 3. Simula envio inicial do bot descartável (número 554191798537)
    const botNumber = '554191798537';
    const botDb = await db.get('SELECT id FROM bot_numbers WHERE number = ?', [botNumber]);
    await db.run('INSERT INTO sends (lead_id, number_id, status, wa_message, sent_at) VALUES (?, ?, "sent", "Olá! Pediu simulação?", datetime("now"))', [leadCreated.id, botDb.id]);
    await db.run('UPDATE leads SET status = "enviados" WHERE id = ?', [leadCreated.id]);
    console.log('3. Bot descartável disparou triagem. Lead status: enviados');
    
    // 4. Cliente responde "SIM"
    console.log('4. Cliente responde SIM...');
    const replyRes = await fetch('http://localhost:5000/api/whatsapp/mock-incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
        body: JSON.stringify({
            phone: testPhone,
            text: 'SIM, quero a simulação com o vendedor!',
            botNumber: botNumber
        })
    });
    const replyData = await replyRes.json();
    console.log('   Resultado resposta:', replyData.results);
    
    // 5. Verifica se o lead foi devolvido ao vendedor em 'sim'
    const leadAfter = await db.get('SELECT id, name, status, seller_id FROM leads WHERE id = ?', [leadCreated.id]);
    console.log('5. Lead após retorno do cliente: Status =', leadAfter.status, '(Dono = vendedor #' + leadAfter.seller_id + ')');
    
    // 6. Vendedor dispara pelo bot próprio usando a rota /api/handoffs/lead/:leadId/send
    console.log('6. Vendedor acionando disparo do Bot Próprio no card...');
    const handoffSendRes = await fetch('http://localhost:5000/api/handoffs/lead/' + leadCreated.id + '/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
        body: JSON.stringify({
            message: 'Olá Cliente Teste! Sou o vendedor Carlos da Prime Sul. Sua simulação está pronta!'
        })
    });
    const handoffResult = await handoffSendRes.json();
    console.log('   Resultado do disparo do vendedor:', handoffResult);
    
    // 7. Confere o status final do handoff
    const handoffDb = await db.get('SELECT * FROM handoffs WHERE lead_id = ?', [leadCreated.id]);
    console.log('7. Status final do handoff no banco:', handoffDb.status, 'Enviado às:', handoffDb.sent_at);
    
    if (leadAfter.status === 'sim' && handoffResult.success && handoffDb.status === 'sent') {
        console.log('✅ TESTE PONTUAL APROVADO COM SUCESSO! Ciclo completo funcionando.');
    } else {
        console.error('❌ Falha na validação do ciclo');
    }
}

testFlow().then(() => process.exit(0)).catch(err => {
    console.error('Erro no teste:', err);
    process.exit(1);
});
