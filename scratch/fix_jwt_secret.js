const { Client } = require('d:/CLINICA HOLO/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  const secretKey = 'primesul_jwt_sec_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + '998877665544332211';
  conn.exec(`sed -i 's/JWT_SECRET=.*/JWT_SECRET=${secretKey}/g' /root/killsis/PRIME-SUL/.env && pm2 restart prime-sul`, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d).stderr.on('data', d => out += d).on('close', () => {
      console.log('JWT_SECRET UPDATED & RESTARTED:\n' + out);
      conn.end();
    });
  });
}).connect({
  host: '82.29.58.126',
  port: 22,
  username: 'root',
  password: 'Killsis19980910#'
});
