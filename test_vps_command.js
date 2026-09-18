const { Client } = require('ssh2');
const conn = new Client();

console.log('Connecting to VPS to test a simple command...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    const command = `
      set -e
      if [ -d "/root/killis/PRIME-SUL" ]; then
        echo "Project directory found"
        cd /root/killis/PRIME-SUL
        pwd
      else
        echo "Project directory not found"
        exit 1
      fi
    `;

    conn.exec(command, (err, stream) => {
      if (err) {
        console.error('Failed to execute command:', err);
        conn.end();
        return;
      }
      let output = '';
      stream.on('close', (code, signal) => {
        console.log(`Command completed with exit code: ${code}`);
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