const { Client } = require('ssh2');
const conn = new Client();

console.log('Connecting to VPS to reset database (preserving sessions)...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    // First, find the project directory
    const findCommand = `
      set -e
      echo "Searching for PRIME-SUL directory..."
      # Look for a directory named PRIME-SUL under /root
      TARGET_DIR=$(find /root -type d -name "PRIME-SUL" 2>/dev/null | head -1)
      if [ -z "\$TARGET_DIR" ]; then
        echo "ERROR: Could not find any directory named PRIME-SUL under /root"
        exit 1
      fi
      echo "Found PRIME-SUL at: \$TARGET_DIR"
      # Also check for the database file
      if [ ! -f "\$TARGET_DIR/server/database/db.js" ]; then
        echo "ERROR: server/database/db.js not found in \$TARGET_DIR"
        exit 1
      fi
      echo "Project directory verified."
      # Now change to that directory and run the reset
      cd "\$TARGET_DIR"
      echo "Current directory: \$(pwd)"
      echo "Running database reset..."
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

    conn.exec(findCommand, (err, stream) => {
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