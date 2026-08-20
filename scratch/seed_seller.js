const { Client } = require('d:/CLINICA HOLO/node_modules/ssh2');

const script = `
const db = require('../server/database/db');
const bcrypt = require('bcryptjs');

async function run() {
  await db.init();
  const existing = await db.get("SELECT id FROM sellers WHERE email = 'vendedor@primesul.com.br'");
  if (!existing) {
    const hash = await bcrypt.hash('vendedor123456', 10);
    const res = await db.run(
      "INSERT INTO sellers (organization_id, name, email, password, phone, role, max_leads) VALUES (1, 'Vendedor Demonstracao', 'vendedor@primesul.com.br', ?, '5511988880000', 'seller', 50)",
      [hash]
    );
    await db.run(
      "INSERT INTO seller_numbers (organization_id, seller_id, number, label) VALUES (1, ?, '5511988880000', 'principal')",
      [res.lastID]
    );
    console.log('Vendedor criado com sucesso: vendedor@primesul.com.br');
  } else {
    console.log('Vendedor já existe.');
  }
  process.exit(0);
}
run();
`;

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createWriteStream('/root/killsis/PRIME-SUL/scripts/seed_seller.js');
    stream.on('close', () => {
      conn.exec('cd /root/killsis/PRIME-SUL && node scripts/seed_seller.js', (err2, stream2) => {
        let out = '';
        stream2.on('data', d => out += d).stderr.on('data', d => out += d).on('close', () => {
          console.log('SEED SELLER RESULT:\n' + out);
          conn.end();
        });
      });
    });
    stream.write(script);
    stream.end();
  });
}).connect({
  host: '82.29.58.126',
  port: 22,
  username: 'root',
  password: 'Killsis19980910#'
});
