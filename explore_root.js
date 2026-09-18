const { Client } = require('ssh2');
const conn = new Client();

console.log('Connecting to VPS to explore root directory...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    const command = `
      set -e
      echo "=== Listing /root ==="
      ls -la /root/
      echo ""
      echo "=== Listing /root/killsis if exists ==="
      if [ -d "/root/killis" ]; then
        ls -la /root/killis/
      else
        echo "/root/killis does not exist"
      fi
      echo ""
      echo "=== Listing /root/killsis if exists (note: killsis vs killsis) ==="
      if [ -d "/root/killsis" ]; then
        ls -la /root/killsis/
      else
        echo "/root/killsis does not exist"
      fi
      echo ""
      echo "=== Looking for any directory with prime in name ==="
      find /root -type d -iname "*prime*" 2>/dev/null
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