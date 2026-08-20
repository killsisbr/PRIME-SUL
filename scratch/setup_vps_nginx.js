const { Client } = require('d:/CLINICA HOLO/node_modules/ssh2');

const nginxConfig = `server {
    listen 80;
    listen [::]:80;
    server_name primesul.killsis.com;

    location / {
        proxy_pass http://127.0.0.1:5005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connected.');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createWriteStream('/etc/nginx/sites-available/primesul.killsis.com');
    stream.on('close', () => {
      console.log('Nginx config file written to VPS with IPv4 & IPv6 support.');
      conn.exec('ln -sf /etc/nginx/sites-available/primesul.killsis.com /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx', (err2, stream2) => {
        let out = '';
        stream2.on('data', d => out += d).stderr.on('data', d => out += d).on('close', () => {
          console.log('NGINX TEST & RELOAD RESULT:\n' + out);
          console.log('Requesting SSL Certificate via Certbot...');
          conn.exec('certbot --nginx -d primesul.killsis.com --non-interactive --agree-tos -m contato@killsis.com --redirect', (err3, stream3) => {
            let certOut = '';
            stream3.on('data', d => certOut += d).stderr.on('data', d => certOut += d).on('close', () => {
              console.log('CERTBOT RESULT:\n' + certOut);
              conn.end();
            });
          });
        });
      });
    });
    stream.write(nginxConfig);
    stream.end();
  });
}).connect({
  host: '82.29.58.126',
  port: 22,
  username: 'root',
  password: 'Killsis19980910#'
});
