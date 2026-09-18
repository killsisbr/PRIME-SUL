const { Client } = require('ssh2');
const conn = new Client();

console.log('Connecting to VPS to check possible paths...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    const command = `
      set -e
      echo "Checking /root/killis/PRIME-SUL:"
      ls -la /root/killis/PRIME-SUL 2>/dev/null || echo "Not found"
      echo ""
      echo "Checking /root/killsis/PRIME-SUL:"
      ls -la /root/killsis/PRIME-SUL 2>/dev/null || echo "Not found"
      echo ""
      echo "Checking /root/killsis/ for any PRIME*"
      ls -la /root/killsis/ 2>/dev/null | grep -i prime || echo "No prime dir in killsis"
      echo ""
      echo "Checking /root/killis/ for any PRIME*"
      ls -la /root/killis/ 2>/dev/null | grep -i prime || echo "No prime dir in killis"
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