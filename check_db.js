const db = require('./server/database/db');

async function checkDatabase() {
    try {
        console.log('=== Checking Sellers ===');
        const sellers = await db.all('SELECT id, name, email, phone, role, active FROM sellers WHERE organization_id = 1');
        console.log(`Found ${sellers.length} sellers:`);
        sellers.forEach(seller => {
            console.log(`  ID: ${seller.id}, Name: ${seller.name}, Email: ${seller.email}, Phone: ${seller.phone}, Role: ${seller.role}, Active: ${seller.active}`);
        });

        console.log('\n=== Checking Leads ===');
        try {
            const leads = await db.all('SELECT id, name, phone, city, origem, valor_desejado, renda, prioridade FROM leads WHERE organization_id = 1 ORDER BY id DESC LIMIT 10');
            console.log(`Found ${leads.length} recent leads:`);
            leads.forEach(lead => {
                console.log(`  ID: ${lead.id}, Name: ${lead.name}, Phone: ${lead.phone}, City: ${lead.city || 'N/A'}, Origem: ${lead.origem}, Valor: ${lead.valor_desejado || 'N/A'}, Renda: ${lead.renda || 'N/A'}, Prioridade: ${lead.prioridade || 'N/A'}`);
            });
        } catch (leadError) {
            console.log('Error querying leads table (might not exist or different name):', leadError.message);
            // Try to list tables
            try {
                const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
                console.log('\nAvailable tables:');
                tables.forEach(table => console.log(`  ${table.name}`));
            } catch (tableError) {
                console.log('Error listing tables:', tableError.message);
            }
        }
    } catch (error) {
        console.error('Database error:', error);
    } finally {
        // Close database connection if needed
        if (db && typeof db.close === 'function') {
            db.close();
        }
    }
}

checkDatabase();