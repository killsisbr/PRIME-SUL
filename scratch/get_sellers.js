const { Client } = require('d:/CLINICA HOLO/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('cd /root/killsis/PRIME-SUL && node -e "const db = require(\'./server/database/db\'); db.init().then(async () => { console.log(JSON.stringify(await db.all(\'SELECT id, name, email, phone, role FROM sellers\'), null, 2)); process.exit(0); });"', (err, stream) => {
    let out = '';
    stream.on('data', d => out += d).stderr.on('data', d => out += d).on('close', () => {
      console.log('SELLERS IN DB:\n' + out);
      conn.end();
    });
  });
}).connect({
  host: '82.29.58.126',
  port: 22,
  username: 'root',
  password: 'Killsis19980910#'
});
