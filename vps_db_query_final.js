const { Client } = require('ssh2');
const conn = new Client();

console.log('Connecting to VPS to query sellers and leads...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    const command = `
      cd /root/killsis/PRIME-SUL
      node -e "
        const db = require('./server/database/db');
        async function main() {
          try {
            const sellers = await db.all('SELECT id, name, email, phone, role, active FROM sellers WHERE organization_id = 1');
            console.log('SELLERS:', JSON.stringify(sellers, null, 2));
            const leads = await db.all('SELECT id, name, phone, city, origem, valor_desejado, renda, prioridade FROM leads WHERE organization_id = 1 ORDER BY id DESC LIMIT 10');
            console.log('LEADS:', JSON.stringify(leads, null, 2));
          } catch (e) {
            console.error('ERROR:', e.message);
          }
        }
        main();
      "
    `;

    conn.exec(command, (err, stream) => {
      if (err) {
        console.error('Failed to execute command:', err);
        conn.end();
        return;
      }
      let output = '';
      stream.on('close', (code, signal) => {
        console.log(`\\nCheck completed with exit code: ${code}`);
        conn.end();
      }).on('data', (data) => {
        output += data.toString();
      }).stderr.on('data', (data) => {
        output += 'STDERR: ' + data.toString();
      });
      stream.on('end', () => {
        console.log('=== OUTPUT ===');
        console.log(output);
      });
    });
  })
  .on('error', (err) => {
    console.error('SSH connection error:', err);
  })
  .connect({
    host: '82.29.58.126',
    port: 22,
    username: 'root',
    password: 'Killsis19980910#'
  });