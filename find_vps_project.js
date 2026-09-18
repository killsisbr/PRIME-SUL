const { Client } = require('ssh2');
const conn = new Client();

console.log('Connecting to VPS to find project directory...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    const command = `
      set -e
      echo "Checking /root directory..."
      ls -la /root/
      echo ""
      echo "Checking for PRIME-SUL in /root/killsis..."
      if [ -d "/root/killis/PRIME-SUL" ]; then
        echo "Found /root/killsis/PRIME-SUL"
        ls -la /root/killis/PRIME-SUL
      else
        echo "/root/killis/PRIME-SUL not found"
      fi
      echo ""
      echo "Checking for PRIME-SUL in /root..."
      if [ -d "/root/PRIME-SUL" ]; then
        echo "Found /root/PRIME-SUL"
        ls -la /root/PRIME-SUL
      else
        echo "/root/PRIME-SUL not found"
      fi
      echo ""
      echo "Checking for any directory with PRIME-SUL in the name..."
      find /root -type d -name "*PRIME-SUL*" 2>/dev/null
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