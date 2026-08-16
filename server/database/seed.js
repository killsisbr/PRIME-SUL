require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@primesul.com.br';
const ADMIN_PASS = process.env.SEED_ADMIN_PASS || 'admin123';
const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE || '5511999990000';

async function seed() {
    await db.init();
    const exists = await db.get('SELECT id FROM sellers WHERE email = ?', [ADMIN_EMAIL]);
    if (!exists) {
        const hash = await bcrypt.hash(ADMIN_PASS, 10);
        await db.run(
            'INSERT INTO sellers (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
            ['Admin Prime Sul', ADMIN_EMAIL, hash, ADMIN_PHONE, 'admin']
        );
        console.log('Admin criado:', ADMIN_EMAIL);
    } else {
        console.log('Admin já existe.');
    }
    process.exit(0);
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});