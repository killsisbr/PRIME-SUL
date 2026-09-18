const { Client } = require('ssh2');
const conn = new Client();

console.log('Connecting to VPS to explore...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    const command = `
      set -e
      echo "=== Exploring /root ==="
      ls -la /root/
      echo ""
      echo "=== Looking for any git repositories ==="
      find /root -type d -name ".git" 2>/dev/null | head -5
      echo ""
      echo "=== Looking for PRIME-SUL in directory names ==="
      find /root -type d -name "*PRIME-SUL*" 2>/dev/null
      echo ""
      echo "=== Checking for any node projects ==="
      find /root -type f -name "package.json" 2>/dev/null | head -5
      echo ""
      echo "=== Checking for server.js ==="
      find /root -type f -name "server.js" 2>/dev/null | head -5
    `;

    conn.exec(command, (err, stream) => {
      if (err) {
        console.error('Failed to execute command:', err);
        conn.end();
        return;
      }
      let output = '';
      stream.on('close', (code, signal) => {
        console.log(`\\nExplore completed with exit code: ${code}`);
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