const { Client } = require('ssh2');
const conn = new Client();

console.log('Connecting to VPS to reset database (delete all data except sessions)...');

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

      echo "Resetting database..."
      node -e "
        const db = require('./server/database/db');
        async function resetDatabase() {
          try {
            // Get all table names
            const tables = await db.all(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\");
            console.log('Found tables:', tables.map(t => t.name).join(', '));

            // Tables to exclude from deletion (keep sessions if exists, and sqlite_sequence)
            const exclude = ['sqlite_sequence'];
            // Check if sessions table exists and add to exclude if user wants to keep sessions
            const sessionsTable = tables.find(t => t.name === 'sessions' || t.name === 'session');
            if (sessionsTable) {
              exclude.push(sessionsTable.name);
              console.log('Sessions table found, will be preserved:', sessionsTable.name);
            } else {
              console.log('No sessions table found.');
            }

            // Delete data from non-excluded tables
            for (const table of tables) {
              if (!exclude.includes(table.name)) {
                console.log(`Clearing table: \${table.name}`);
                await db.run(\`DELETE FROM \${table.name}\`);
                // For SQLite, reset autoincrement counter
                await db.run(\`DELETE FROM sqlite_sequence WHERE name = '\${table.name}'\`);
              }
            }

            console.log('Database reset completed successfully.');
          } catch (e) {
            console.error('Error during database reset:', e.message);
            process.exit(1);
          }
        }
        resetDatabase();
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