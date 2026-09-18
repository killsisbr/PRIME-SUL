const { Client } = require('ssh2');
const conn = new Client();

conn
  .on('ready', () => {
    console.log('SSH connected');
    // First, check if we can run a simple command
    conn.exec('uname -a', (err, stream) => {
      if (err) throw err;
      stream
        .on('close', (code, signal) => {
          console.log(`Stream closed :: code: ${code}, signal: ${signal}`);
          conn.end();
        })
        .on('data', (data) => {
          console.log('STDOUT: ' + data);
        })
        .stderr.on('data', (data) => {
          console.log('STDERR: ' + data);
        });
    });
  })
  .connect({
    host: '82.29.58.126',
    port: 22,
    username: 'root',
    // tryAgent: true,
  });