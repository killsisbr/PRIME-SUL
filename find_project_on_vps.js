const { Client } = require('ssh2');
const conn = new Client();

console.log('Connecting to VPS to find project directory...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    const command = `
      set -e
      echo "Listing /root directory:"
      ls -la /root/
      echo ""
      echo "Looking for any directory with prime in the name (case insensitive):"
      find /root -type d -iname "*prime*" 2>/dev/null
      echo ""
      echo "Looking for any directory with sul in the name (case insensitive):"
      find /root -type d -iname "*sul*" 2>/dev/null
      echo ""
      echo "Looking for any directory with killsis in the name (case insensitive):"
      find /root -type d -iname "*killsis*" 2>/dev/null
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