const { Client } = require('d:/CLINICA HOLO/node_modules/ssh2');
const fs = require('fs');

const localScript = fs.readFileSync('d:/PRIME SUL/scripts/seed_mock_data.js', 'utf8');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connected to VPS.');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createWriteStream('/root/killsis/PRIME-SUL/scripts/seed_mock_data.js');
    stream.on('close', () => {
      console.log('Script seed_mock_data.js uploaded to VPS.');
      conn.exec('cd /root/killsis/PRIME-SUL && node scripts/seed_mock_data.js', (err2, stream2) => {
        let out = '';
        stream2.on('data', d => out += d).stderr.on('data', d => out += d).on('close', (code) => {
          console.log('SEED MOCK OUTPUT:\n' + out);
          conn.end();
        });
      });
    });
    stream.write(localScript);
    stream.end();
  });
}).connect({
  host: '82.29.58.126',
  port: 22,
  username: 'root',
  password: 'Killsis19980910#'
});
