const db = require('../server/database/db');

const FIRST_NAMES = ['Maria', 'João', 'Ana', 'Carlos', 'Fernanda', 'Roberto', 'Juliana', 'Lucas', 'Patricia', 'Thiago', 'Vanessa', 'Rodrigo', 'Camila', 'Diego', 'Bruna', 'Marcelo', 'Larissa', 'Gabriel', 'Aline', 'Rafael', 'Renata', 'Felipe', 'Mariana', 'Gustavo', 'Beatriz'];
const LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Ferreira', 'Souza', 'Mendes', 'Costa', 'Ramos', 'Fonseca', 'Machado', 'Castro', 'Pinto', 'Nogueira', 'Freitas', 'Barbosa', 'Carvalho', 'Azevedo', 'Teixeira', 'Cardoso', 'Almeida', 'Duarte', 'Moraes'];
const CITIES = ['Porto Alegre', 'Caxias do Sul', 'Canoas', 'Pelotas', 'Novo Hamburgo', 'Santa Maria', 'São Leopoldo', 'Passo Fundo', 'Rio Grande', 'Gravataí', 'Viamão', 'Bento Gonçalves'];
const STAGES = ['novo', 'novo', 'novo', 'contato', 'contato', 'confirmado'];

async function seed() {
    await db.migrate();
    const existing = await db.all('SELECT COUNT(*) c FROM leads');
    console.log('Leads atuais no banco:', existing[0].c);

    const sellers = await db.all('SELECT id FROM sellers LIMIT 1');
    const sellerId = sellers.length ? sellers[0].id : 1;

    for (let i = 0; i < 50; i++) {
        const fn = FIRST_NAMES[i % FIRST_NAMES.length];
        const ln1 = LAST_NAMES[(i * 3) % LAST_NAMES.length];
        const ln2 = LAST_NAMES[(i * 7) % LAST_NAMES.length];
        const city = CITIES[i % CITIES.length];
        const stage = STAGES[i % STAGES.length];
        const phoneNum = `(51) 9${String(91000000 + i * 1337).slice(0, 8)}`;
        const name = `${fn} ${ln1} ${ln2}`;

        try {
            await db.run(
                `INSERT INTO leads (organization_id, seller_id, name, phone, city, status, origem, score, prioridade)
                 VALUES (1, ?, ?, ?, ?, ?, 'SITE', ?, 'media')`,
                [sellerId, name, phoneNum, city, stage, Math.floor(50 + Math.random() * 45)]
            );
        } catch (e) {
            // Ignora duplicados se o telefone já existir
        }
    }

    const updated = await db.all('SELECT COUNT(*) c FROM leads');
    console.log('Novo total de leads no banco SQLite:', updated[0].c);
    process.exit(0);
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
