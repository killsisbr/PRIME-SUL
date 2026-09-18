const { Client } = require('ssh2');
const conn = new Client();

console.log('Connecting to VPS to reset database (preserving sessions)...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    const command = `
      set -e
      echo "Checking for PRIME-SUL project..."
      if [ -d "/root/killis/PRIME-SUL" ]; then
        TARGET_DIR="/root/killis/PRIME-SUL"
      else
        echo "Project directory not found!"
        exit 1
      fi
      echo "Target directory: \$TARGET_DIR"
      cd "\$TARGET_DIR"

      echo "Creating temporary reset script..."
      cat > /tmp/reset_db.js << 'EOF'
      const db = require('./server/database/db');
      (async () => {
        try {
          const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
          console.log('Tables found:', tables.map(t => t.name));
          const exclude = ['sessions'];
          for (const table of tables) {
            const tableName = table.name;
            if (!exclude.includes(tableName)) {
              console.log(`Clearing table: \${tableName}`);
              await db.run(\`DELETE FROM \${tableName}\`);
              await db.run(\`DELETE FROM sqlite_sequence WHERE name = '\${tableName}'\`);
            } else {
              console.log(`Skipping \${tableName} (preserved)`);
            }
          }
          console.log('Database reset completed successfully.');
        } catch (e) {
          console.error('Error during database reset:', e.message);
          process.exit(1);
        }
      })();
      EOF

      echo "Running reset script..."
      node /tmp/reset_db.js
      EXIT_CODE=$?
      echo "Cleaning up..."
      rm /tmp/reset_db.js
      exit \$EXIT_CODE
    `;

    conn.exec(command, (err, stream) => {
      if (err) {
        console.error('Failed to execute command:', err);
        conn.end();
        return;
      }
      let output = '';
      stream.on('close', (code, signal) => {
        console.log(`\\nReset completed with exit code: ${code}`);
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