const { Client } = require('ssh2');
const conn = new Client();

console.log('Connecting to VPS to find PRIME-SUL project directory...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    const command = `
      set -e
      echo "Searching for PRIME-SUL directory under /root..."
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
    `;

    conn.exec(command, (err, stream) => {
      if (err) {
        console.error('Failed to execute command:', err);
        conn.end();
        return;
      }
      let output = '';
      stream.on('close', (code, signal) => {
        console.log(`\\nFind completed with exit code: ${code}`);
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