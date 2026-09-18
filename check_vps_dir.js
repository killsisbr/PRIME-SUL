const { Client } = require('ssh2');
const conn = new Client();

conn
  .on('ready', () => {
    console.log('SSH connected');
    conn.exec('ls -la /root/', (err, stream) => {
      if (err) {
        console.error('Error executing ls:', err);
        conn.end();
        return;
      }
      let output = '';
      stream.on('close', (code, signal) => {
        console.log(`LS completed with code: ${code}`);
        conn.end();
      }).on('data', (data) => {
        output += data.toString();
      }).stderr.on('data', (data) => {
        output += 'STDERR: ' + data.toString();
      });
      stream.on('end', () => {
        console.log('=== /root/ listing ===');
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