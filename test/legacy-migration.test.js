const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const testDb = path.join(os.tmpdir(), `prime-sul-legacy-${process.pid}.db`);
process.env.DB_PATH = testDb;

function execLegacy(sql) {
    return new Promise((resolve, reject) => {
        const raw = new sqlite3.Database(testDb);
        raw.exec(sql, err => raw.close(closeErr => err || closeErr ? reject(err || closeErr) : resolve()));
    });
}

test('migra banco legado sem perder vendedor e telefone', async () => {
    await execLegacy(`
        CREATE TABLE sellers(id INTEGER PRIMARY KEY, name TEXT, email TEXT, password TEXT, phone TEXT, role TEXT DEFAULT 'seller', active INTEGER DEFAULT 1, max_leads INTEGER DEFAULT 0, created_at TEXT);
        CREATE TABLE leads(id INTEGER PRIMARY KEY, seller_id INTEGER, name TEXT, phone TEXT UNIQUE, city TEXT, origem TEXT, limite_est TEXT, status TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE bot_numbers(id INTEGER PRIMARY KEY, number TEXT UNIQUE, label TEXT, status TEXT DEFAULT 'ativo', messages_sent INTEGER DEFAULT 0, created_at TEXT);
        CREATE TABLE campaigns(id INTEGER PRIMARY KEY, seller_id INTEGER, number_id INTEGER, name TEXT, message TEXT, status TEXT DEFAULT 'draft', total_target INTEGER DEFAULT 0, total_sent INTEGER DEFAULT 0, total_yes INTEGER DEFAULT 0, created_at TEXT);
        CREATE TABLE sends(id INTEGER PRIMARY KEY, campaign_id INTEGER NOT NULL, lead_id INTEGER NOT NULL, number_id INTEGER NOT NULL, status TEXT, wa_message TEXT, sent_at TEXT, replied_at TEXT, created_at TEXT);
        INSERT INTO sellers VALUES(1,'Legado','legado@test','x','5511999990000','seller',1,0,datetime('now'));
    `);
    const db = require('../server/database/db');
    await db.init();
    await db.migrate();
    const seller = await db.get('SELECT organization_id FROM sellers WHERE id=1');
    const number = await db.get('SELECT seller_id,number FROM seller_numbers WHERE seller_id=1');
    assert.equal(seller.organization_id, 1);
    assert.equal(number.number, '5511999990000');
    await new Promise(resolve => db.db.close(resolve));
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(testDb + suffix, { force: true });
});
