require('dotenv').config();
const db = require('../server/database/db');
const bcrypt = require('bcryptjs');

async function seedMockData() {
    console.log('[seed-mock] Inicializando banco e migrações...');
    await db.init();
    await db.migrate();

    const ORG_ID = 1;

    // 1. Vendedores
    console.log('[seed-mock] Criando vendedores mockados...');
    const passHash = await bcrypt.hash('vendedor123456', 10);
    
    const sellersData = [
        { name: 'Admin Prime Sul', email: 'admin@primesul.com.br', phone: '5511999990000', role: 'admin', max_leads: 0 },
        { name: 'Carlos Silva (Operador)', email: 'vendedor@primesul.com.br', phone: '5511988880000', role: 'seller', max_leads: 100 },
        { name: 'Mariana Souza (Consignado)', email: 'mariana.souza@primesul.com.br', phone: '5511977770001', role: 'seller', max_leads: 150 },
        { name: 'Roberto Mendes (FGTS)', email: 'roberto.mendes@primesul.com.br', phone: '5511977770002', role: 'seller', max_leads: 120 }
    ];

    const sellerMap = {};
    for (const s of sellersData) {
        const existing = await db.get('SELECT id FROM sellers WHERE email = ?', [s.email]);
        let id;
        if (!existing) {
            const res = await db.run(
                'INSERT INTO sellers (organization_id, name, email, password, phone, role, max_leads) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [ORG_ID, s.name, s.email, passHash, s.phone, s.role, s.max_leads]
            );
            id = res.lastID;
        } else {
            id = existing.id;
            await db.run('UPDATE sellers SET name = ?, phone = ?, role = ? WHERE id = ?', [s.name, s.phone, s.role, id]);
        }
        sellerMap[s.email] = id;

        // Número do vendedor
        await db.run(
            'INSERT OR IGNORE INTO seller_numbers (organization_id, seller_id, number, label) VALUES (?, ?, ?, ?)',
            [ORG_ID, id, s.phone, 'principal']
        );
    }

    const sellerIds = Object.values(sellerMap);
    const carlosId = sellerMap['vendedor@primesul.com.br'];
    const marianaId = sellerMap['mariana.souza@primesul.com.br'];
    const robertoId = sellerMap['roberto.mendes@primesul.com.br'];

    // 2. Números Bot de Triagem / Anti-Ban
    console.log('[seed-mock] Criando números de triagem do bot...');
    const botNumbers = [
        { slot: 1, num: '5511910000001', push: 'Prime Sul Bot 01', status: 'ativo', msgs: 42, limit: 100 },
        { slot: 2, num: '5511910000002', push: 'Prime Sul Bot 02', status: 'ativo', msgs: 88, limit: 100 },
        { slot: 3, num: '5511910000003', push: 'Prime Sul Bot 03', status: 'resfriado', msgs: 100, limit: 100, cooled_until: new Date(Date.now() + 3600000).toISOString() },
        { slot: 4, num: '5511910000004', push: 'Prime Sul Bot 04', status: 'ativo', msgs: 15, limit: 100 },
        { slot: 5, num: '5511910000005', push: 'Prime Sul Bot 05', status: 'banido', msgs: 0, limit: 100 }
    ];

    const botNumberIds = [];
    for (const b of botNumbers) {
        const exist = await db.get('SELECT id FROM bot_numbers WHERE number = ?', [b.num]);
        let bId;
        if (!exist) {
            const res = await db.run(
                'INSERT INTO bot_numbers (organization_id, number, push_name, status, messages_sent, slot_index, daily_limit_override, cooled_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [ORG_ID, b.num, b.push, b.status, b.msgs, b.slot, b.limit, b.cooled_until || null]
            );
            bId = res.lastID;
        } else {
            bId = exist.id;
            await db.run('UPDATE bot_numbers SET status = ?, messages_sent = ? WHERE id = ?', [b.status, b.msgs, bId]);
        }
        botNumberIds.push(bId);
    }

    // 3. Templates de Mensagem
    console.log('[seed-mock] Criando templates de mensagem...');
    const templates = [
        { name: 'Triagem INSS Standard', purpose: 'screening', body: 'Olá {nome}! Notamos que você tem margem disponível no Consignado INSS. Gostaria de simular a liberação de até R$ 15.000 sem compromisso?' },
        { name: 'Saque Aniversário FGTS', purpose: 'screening', body: 'Oi {nome}! Você sabia que pode antecipar até 10 parcelas do seu Saque Aniversário FGTS hoje mesmo? Responda SIM para simular.' },
        { name: 'Handoff Vendedor Especialista', purpose: 'handoff', body: 'Olá {nome}! Sou o especialista {vendedor} da Prime Sul. Recebi sua confirmação e já preparei sua proposta pré-aprovada de R$ {valor}. Podemos falar agora?' },
        { name: 'Follow-up Reengajamento 24h', purpose: 'followup', body: 'Olá {nome}! Sua margem consignada continua reservada. Podemos finalizar a simulação para digitar a proposta no sistema?' }
    ];

    const templateIds = [];
    for (const t of templates) {
        const exist = await db.get('SELECT id FROM message_templates WHERE name = ?', [t.name]);
        if (!exist) {
            const res = await db.run(
                'INSERT INTO message_templates (organization_id, name, purpose, body) VALUES (?, ?, ?, ?)',
                [ORG_ID, t.name, t.purpose, t.body]
            );
            templateIds.push(res.lastID);
        } else {
            templateIds.push(exist.id);
        }
    }

    // 4. Leads do Funil
    console.log('[seed-mock] Inserindo leads mockados...');
    const mockLeads = [
        { name: 'João Carlos Oliveira', phone: '5511981112233', status: 'confirmado', renda: '4500', valor: '12000', cpf: '123.456.789-01', prioridade: 'alta', score: 850, tags: 'INSS,Margem Livre', obs: 'Aposentado INSS, prefere atendimento no período da manhã.', seller_id: carlosId },
        { name: 'Ana Paula Ferreira', phone: '5511982223344', status: 'contato', renda: '3200', valor: '8000', cpf: '234.567.890-12', prioridade: 'media', score: 720, tags: 'FGTS,Saque Aniversario', obs: 'Trabalha em empresa privada, saldo FGTS R$ 14.000', seller_id: carlosId },
        { name: 'Marcos Vinicius Santos', phone: '5511983334455', status: 'novo', renda: '6800', valor: '25000', cpf: '345.678.901-23', prioridade: 'alta', score: 910, tags: 'Servidor Publico,SIAPE', obs: 'Servidor Federal, margem cheia.', seller_id: marianaId },
        { name: 'Beatriz Lima Mendes', phone: '5511984445566', status: 'concluido', renda: '2900', valor: '5000', cpf: '456.789.012-34', prioridade: 'media', score: 780, tags: 'INSS,Portabilidade', obs: 'Contrato digitado no banco BB. Proposta nº 884192.', seller_id: marianaId },
        { name: 'Lucas Gabriel Costa', phone: '5511985556677', status: 'confirmado', renda: '5100', valor: '18000', cpf: '567.890.123-45', prioridade: 'alta', score: 840, tags: 'INSS,Refin', obs: 'Pediu troco mínimo de R$ 4.000 no refinanciamento.', seller_id: carlosId },
        { name: 'Fernanda Rocha', phone: '5511986667788', status: 'contato', renda: '3800', valor: '9500', cpf: '678.901.234-56', prioridade: 'baixa', score: 650, tags: 'FGTS', obs: 'Aguardando liberação de lote pelo aplicativo do FGTS.', seller_id: robertoId },
        { name: 'Eduardo Martins', phone: '5511987778899', status: 'bloqueado', renda: '2100', valor: '3000', cpf: '789.012.345-67', prioridade: 'baixa', score: 450, tags: 'Sem Margem', obs: 'Sem margem disponível e restrição interna.', seller_id: robertoId },
        { name: 'Camila Rodrigues', phone: '5511988889900', status: 'novo', renda: '7200', valor: '30000', cpf: '890.123.456-78', prioridade: 'alta', score: 930, tags: 'Servidor Estadual,Margem Livre', obs: 'Policial Militar SP. Quer simulação em 84x.', seller_id: marianaId },
        { name: 'Ricardo Alves', phone: '5511989990011', status: 'confirmado', renda: '4100', valor: '11000', cpf: '901.234.567-89', prioridade: 'media', score: 790, tags: 'INSS', obs: 'Pensionista do INSS. Documentação enviada via WhatsApp.', seller_id: carlosId },
        { name: 'Patricia Souza Lima', phone: '5511990001122', status: 'concluido', renda: '8500', valor: '42000', cpf: '012.345.678-90', prioridade: 'alta', score: 950, tags: 'SIAPE,Margem Livre', obs: 'Pago via PIX em conta corrente Banco do Brasil.', seller_id: robertoId },
        { name: 'Thiago Henrique', phone: '5511991112233', status: 'novo', renda: '2500', valor: '4500', cpf: '111.222.333-44', prioridade: 'media', score: 680, tags: 'FGTS', obs: 'Simulou Saque Aniversário.', seller_id: carlosId },
        { name: 'Vanessa Camargo', phone: '5511992223344', status: 'contato', renda: '3900', valor: '10000', cpf: '222.333.444-55', prioridade: 'alta', score: 810, tags: 'INSS', obs: 'Dúvidas sobre taxa de juros do consignado.', seller_id: marianaId }
    ];

    const leadIds = [];
    for (const l of mockLeads) {
        const exist = await db.get('SELECT id FROM leads WHERE phone = ?', [l.phone]);
        let leadId;
        if (!exist) {
            const res = await db.run(
                `INSERT INTO leads (organization_id, name, phone, status, renda, valor_desejado, cpf, prioridade, score, tags, obs, seller_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [ORG_ID, l.name, l.phone, l.status, l.renda, l.valor, l.cpf, l.prioridade, l.score, l.tags, l.obs, l.seller_id]
            );
            leadId = res.lastID;
        } else {
            leadId = exist.id;
            await db.run(
                'UPDATE leads SET name = ?, status = ?, renda = ?, valor_desejado = ?, prioridade = ?, score = ?, tags = ?, obs = ?, seller_id = ? WHERE id = ?',
                [l.name, l.status, l.renda, l.valor, l.prioridade, l.score, l.tags, l.obs, l.seller_id, leadId]
            );
        }
        leadIds.push(leadId);
    }

    // 5. Campanhas de Disparo
    console.log('[seed-mock] Criando campanhas de disparo...');
    const campaignsData = [
        { name: 'Disparo Consignado INSS - Agreste & Sul', status: 'done', total: 120, sent: 120, confirmed: 45, template_id: templateIds[0] },
        { name: 'Antecipação FGTS Lote 08/2026', status: 'running', total: 80, sent: 52, confirmed: 18, template_id: templateIds[1] },
        { name: 'Refinanciamento Margem Livre - Servidores', status: 'draft', total: 150, sent: 0, confirmed: 0, template_id: templateIds[0] }
    ];

    for (const c of campaignsData) {
        const exist = await db.get('SELECT id FROM campaigns WHERE name = ?', [c.name]);
        if (!exist) {
            await db.run(
                'INSERT INTO campaigns (organization_id, name, status, total_target, total_sent, total_yes, template_id, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [ORG_ID, c.name, c.status, c.total, c.sent, c.confirmed, c.template_id, 'Mensagem demonstrativa de disparo']
            );
        }
    }

    // 6. Marketing Posts (Status do WhatsApp)
    console.log('[seed-mock] Criando posts de marketing...');
    const postsData = [
        { title: 'Promoção Consignado INSS 1.66% a.m.', type: 'text', message: '🔥 ATENÇÃO APOSENTADOS E PENSIONISTAS INSS!\n\nTaxa especial de 1.66% a.m. Liberação rápida em até 24h sem consulta ao SPC/Serasa.\n\nFale com nossos especialistas agora!', color: 'orange', font: '2', status: 'scheduled' },
        { title: 'Antecipação FGTS em 10 Minutos', type: 'text', message: '💸 Precisa de dinheiro rápido? Antecipe até 10 parcelas do seu Saque Aniversário FGTS sem sair de casa!\n\nChame no WhatsApp!', color: 'teal', font: '1', status: 'sent' }
    ];

    for (const p of postsData) {
        const exist = await db.get('SELECT id FROM marketing_posts WHERE title = ?', [p.title]);
        if (!exist) {
            await db.run(
                'INSERT INTO marketing_posts (title, type, message, color, font, status) VALUES (?, ?, ?, ?, ?, ?)',
                [p.title, p.type, p.message, p.color, p.font, p.status]
            );
        }
    }

    // 7. Eventos da Timeline dos Bots
    console.log('[seed-mock] Inserindo linha do tempo dos bots...');
    const botEvents = [
        { num: '5511910000001', label: 'Prime Sul Bot 01', type: 'system', detail: 'Sessão WhatsApp autenticada com sucesso (slot 1)' },
        { num: '5511910000001', label: 'Prime Sul Bot 01', type: 'send', detail: 'Mensagem de triagem enviada para 5511981112233' },
        { num: '5511910000001', label: 'Prime Sul Bot 01', type: 'reply', detail: 'Resposta do lead 5511981112233: "Sim, quero simular"' },
        { num: '5511910000002', label: 'Prime Sul Bot 02', type: 'handoff', detail: 'Handoff gerado para o vendedor Carlos Silva (Lead #1)' },
        { num: '5511910000003', label: 'Prime Sul Bot 03', type: 'warning', detail: 'Limite diário de 100 mensagens atingido. Entrando em quarentena de 1 hora.' }
    ];

    for (const e of botEvents) {
        await db.run(
            'INSERT INTO bot_events (number, label, type, detail) VALUES (?, ?, ?, ?)',
            [e.num, e.label, e.type, e.detail]
        );
    }

    console.log('✅ [seed-mock] Dados mockados inseridos e sincronizados com sucesso!');
    process.exit(0);
}

seedMockData().catch(err => {
    console.error('❌ Erro no seed mock:', err);
    process.exit(1);
});
