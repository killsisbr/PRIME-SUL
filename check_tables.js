const { Client } = require('ssh2');
const conn = new Client();

console.log('Connecting to VPS to check database tables...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    const command = `
      set -e
      if [ -d "/root/killis/PRIME-SUL" ]; then
        TARGET_DIR="/root/killis/PRIME-SUL"
      else
        echo "Project directory not found!"
        exit 1
      fi
      echo "Target directory: \$TARGET_DIR"
      cd "\$TARGET_DIR"

      echo "Checking database tables..."
      node -e "
        const db = require('./server/database/db');
        async function checkTables() {
          try {
            const tables = await db.all(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\");
            console.log('Tables found:');
            tables.forEach(t => {
              console.log('  - ' + t.name);
            });
          } catch (e) {
            console.error('Error checking tables:', e.message);
          }
        }
        checkTables();
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