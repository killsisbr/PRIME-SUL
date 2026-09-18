const { Client } = require('ssh2');
const conn = new Client();

console.log('🚀 Iniciando deploy no VPS...\n');

conn
  .on('ready', () => {
    console.log('✅ SSH conectado com sucesso');

    const deployCommands = `
      set -e
      echo "📁 Encontrando diretório do projeto..."
      if [ -d "/root/killsis/PRIME-SUL" ]; then
        cd /root/killsis/PRIME-SUL
        echo "✅ Usando /root/killsis/PRIME-SUL"
      elif [ -d "/root/PRIME-SUL" ]; then
        cd /root/PRIME-SUL
        echo "✅ Usando /root/PRIME-SUL"
      else
        echo "❌ Diretório do projeto não encontrado!"
        exit 1
      fi

      echo ""
      echo "📥 Fazendo git pull..."
      git pull origin main || git pull origin master || git pull origin staging

      echo ""
      echo "📦 Instalando dependências..."
      npm install --production

      echo ""
      echo "🔄 Reiniciando servidor PM2..."
      pm2 restart all || pm2 start server/server.js --name prime-sul

      echo ""
      echo "✅ Deploy concluído com sucesso!"
      pm2 status
    `;

    conn.exec(deployCommands, (err, stream) => {
      if (err) {
        console.error('❌ Erro ao executar comando:', err);
        conn.end();
        process.exit(1);
      }

      let output = '';

      stream.on('close', (code, signal) => {
        if (code === 0) {
          console.log('\n🎉 Deploy finalizado com sucesso!');
        } else {
          console.error(`\n❌ Deploy falhou com código: ${code}`);
          process.exit(1);
        }
        conn.end();
      }).on('data', (data) => {
        output += data.toString();
        process.stdout.write(data.toString());
      }).stderr.on('data', (data) => {
        output += 'STDERR: ' + data.toString();
        process.stderr.write(data.toString());
      });
    });
  })
  .on('error', (err) => {
    console.error('❌ Erro de conexão SSH:', err.message);
    process.exit(1);
  })
  .connect({
    host: '82.29.58.126',
    port: 22,
    username: 'root',
    password: 'Killsis19980910#'
  });
