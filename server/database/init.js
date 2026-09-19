const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const DB_PATH = path.join(__dirname, '../../data/prime_sul.db');
const DATA_DIR = dirname(DB_PATH);

// Criar diretório data se não existir
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`✅ Created directory: ${DATA_DIR}`);
}

// Criar/inicializar banco
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Database error:', err);
    process.exit(1);
  }
  console.log(`✅ Connected to: ${DB_PATH}`);
});

// Ler schema
const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');

// Executar schema
db.exec(schema, (err) => {
  if (err) {
    console.error('❌ Schema error:', err);
    process.exit(1);
  }
  console.log('✅ Database schema initialized');
  
  // Seedar dados de teste
  seedDatabase(db);
});

function seedDatabase(db) {
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const sellerPassword = bcrypt.hashSync('seller123', 10);

  db.run(
    `INSERT OR IGNORE INTO sellers (name, email, password, phone, role) 
     VALUES ('Admin', 'admin@test.com', ?, '1199999999', 'admin')`,
    [adminPassword],
    (err) => {
      if (err) console.error('❌ Seed admin error:', err);
      else console.log('✅ Seeded admin user');
    }
  );

  db.run(
    `INSERT OR IGNORE INTO sellers (name, email, password, phone, role) 
     VALUES ('Test Seller', 'seller@test.com', ?, '1198888888', 'seller')`,
    [sellerPassword],
    (err) => {
      if (err) console.error('❌ Seed seller error:', err);
      else {
        console.log('✅ Seeded seller user');
        console.log('\n📝 Test Credentials:');
        console.log('   Admin:  admin@test.com / admin123');
        console.log('   Seller: seller@test.com / seller123\n');
        db.close();
      }
    }
  );
}

function dirname(p) {
  return path.dirname(p);
}
