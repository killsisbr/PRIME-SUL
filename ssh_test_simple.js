const { Client } = require('ssh2');
const conn = new Client();

console.log('Testing SSH connection...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    conn.exec('pwd', (err, stream) => {
      if (err) {
        console.error('Error executing pwd:', err);
        conn.end();
        return;
      }
      let output = '';
      stream.on('close', (code, signal) => {
        console.log(`pwd exited with code: ${code}`);
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