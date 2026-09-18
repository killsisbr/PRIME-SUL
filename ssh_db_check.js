const { Client } = require('ssh2');
const conn = new Client();

conn
  .on('ready', () => {
    console.log('SSH connected');
    // First, check if we can run a simple command
    conn.exec('cd /root/killsis/PRIME-SUL && node check_db.js', (err, stream) => {
      if (err) {
        console.error('Error executing command:', err);
        conn.end();
        return;
      }
      let output = '';
      stream.on('close', (code, signal) => {
        console.log(`Stream closed :: code: ${code}, signal: ${signal}`);
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
  .connect({
    host: '82.29.58.126',
    port: 22,
    username: 'root',
    password: 'Killsis19980910#'
  });