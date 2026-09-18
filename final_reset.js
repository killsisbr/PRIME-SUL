const { Client } = require('ssh2');
const conn = new Client();

console.log('Connecting to VPS to reset database (preserving sessions)...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    const command = `
      set -e
      echo "Checking for PRIME-SUL project in /root/killsis..."
      if [ -d "/root/killis/PRIME-SUL" ]; then
        TARGET_DIR="/root/killis/PRIME-SUL"
        echo "Found project at: $TARGET_DIR"
      elif [ -d "/root/killsis/PRIME-SUL" ]; then
        TARGET_DIR="/root/killsis/PRIME-SUL"
        echo "Found project at: $TARGET_DIR"
      else
        echo "ERROR: Project directory not found in expected locations!"
        echo "Checking what's in /root/killsis:"
        ls -la /root/killis/
        echo ""
        echo "Checking what's in /root/killsis:"
        ls -la /root/killsis/
        exit 1
      fi
      echo "Target directory: \$TARGET_DIR"
      cd "\$TARGET_DIR"

      echo "Checking current directory:"
      pwd
      echo ""
      echo "Checking if server/database/db.js exists:"
      ls -la server/database/db.js
      echo ""

      echo "Resetting database (preserving sessions table)..."
      node -e "
        const db = require('./server/database/db');
        async function resetDatabase() {
          try {
            // Get all table names
            const tables = await db.all(\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name\");
            console.log('Found user tables:', tables.map(t => t.name).join(', '));

            // Tables to exclude from data deletion (preserve these)
            const exclude = ['sessions']; // We want to keep the sessions table

            console.log('Tables to preserve (data will NOT be deleted):', exclude.join(', '));

            // Delete data from non-excluded tables
            for (const table of tables) {
              const tableName = table.name;
              if (!exclude.includes(tableName)) {
                console.log(`Clearing data from table: \${tableName}`);
                await db.run(\`DELETE FROM \${tableName}\`);
                // Reset autoincrement counter for this table
                await db.run(\`DELETE FROM sqlite_sequence WHERE name = '\${tableName}'\`);
                console.log(`  → Data cleared and auto-increment reset for \${tableName}`);
              } else {
                console.log(`  → Skipping \${tableName} (preserved as requested)`);
              }
            }

            console.log('\\\\nDatabase reset completed successfully.');
            console.log('Note: Sessions table data has been preserved as requested.');
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