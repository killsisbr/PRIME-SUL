const { Client } = require('d:/CLINICA HOLO/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `node -e "
    const http = require('http');
    function post(payload) {
      return new Promise((resolve) => {
        const req = http.request('http://127.0.0.1:5005/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.write(JSON.stringify(payload));
        req.end();
      });
    }
    async function test() {
      console.log('ADMIN LOGIN:', await post({ email: 'admin@primesul.com.br', password: 'defina-uma-senha-forte' }));
      console.log('SELLER LOGIN:', await post({ email: 'vendedor@primesul.com.br', password: 'vendedor123456' }));
    }
    test();
  "`;
  conn.exec(cmd, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d).stderr.on('data', d => out += d).on('close', () => {
      console.log('LOGIN TEST RESULT:\n' + out);
      conn.end();
    });
  });
}).connect({
  host: '82.29.58.126',
  port: 22,
  username: 'root',
  password: 'Killsis19980910#'
});
