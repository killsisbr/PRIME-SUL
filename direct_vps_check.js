const { Client } = require('ssh2');
const conn = new Client();

console.log('Connecting to VPS to check database...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    // Use the exact same approach as deploy_vps_runner.js but just run a database check
    const command = `
      set -e
      if [ -d "/root/killis/PRIME-SUL" ]; then
        TARGET_DIR="/root/killis/PRIME-SUL"
      elif [ -d "/root/PRIME-SUL" ]; then
        TARGET_DIR="/root/PRIME-SUL"
      else
        echo "Project directory not found"
        exit 1
      fi
      echo "Target directory: \$TARGET_DIR"
      cd "\$TARGET_DIR"

      echo "Running database check..."
      node -e "
        const db = require('./server/database/db');
        async function check() {
          try {
            const sellers = await db.all('SELECT id, name, email, phone, role, active FROM sellers WHERE organization_id = 1');
            console.log('SELLERS COUNT:', sellers.length);
            sellers.forEach(s => {
              console.log('SELLER:', JSON.stringify(s));
            });

            const leads = await db.all('SELECT id, name, phone, city, origem, valor_desejado, renda, prioridade FROM leads WHERE organization_id = 1 ORDER BY id DESC LIMIT 10');
            console.log('LEADS COUNT:', leads.length);
            leads.forEach(l => {
              console.log('LEAD:', JSON.stringify(l));
            });
          } catch (e) {
            console.error('ERROR:', e.message);
          }
        }
        check();
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