const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

console.log('Connecting to VPS to check database via SFTP...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    conn.sftp((err, sftp) => {
      if (err) {
        console.error('SFTP error:', err);
        conn.end();
        return;
      }
      const localPath = './check_db.js';
      const remotePath = '/tmp/check_db.js';
      sftp.fastPut(localPath, remotePath, (err) => {
        if (err) {
          console.error('Fast put error:', err);
          sftp.end();
          conn.end();
          return;
        }
        console.log('File uploaded to /tmp/check_db.js');
        sftp.end();
        // Now run the command
        conn.exec('node /tmp/check_db.js', (err, stream) => {
          if (err) {
            console.error('Error executing node command:', err);
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