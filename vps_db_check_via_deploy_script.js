// Modified version of deploy_vps_runner.js that just checks DB instead of deploying
const { Client } = require('ssh2');
const conn = new Client();

console.log('Iniciando conexão SSH com VPS 82.29.58.126 para verificar banco de dados...');

conn.on('ready', () => {
  console.log('Conexão SSH estabelecida com sucesso.');

  // Script shell para rodar na VPS - apenas verificar banco de dados
  const remoteCommands = `
    set -e
    echo "=== 1. VERIFICANDO DIRETÓRIO DO PROJETO ==="
    if [ -d "/root/killsis/PRIME-SUL" ]; then
      TARGET_DIR="/root/killsis/PRIME-SUL"
    elif [ -d "/root/PRIME-SUL" ]; then
      TARGET_DIR="/root/PRIME-SUL"
    else
      echo "ERRO: Diretório do projeto não encontrado!"
      exit 1
    fi

    echo "Diretório alvo: $TARGET_DIR"
    cd "$TARGET_DIR"

    echo "=== 2. VERIFICANDO BANCO DE DADOS ==="
    node -e "
      const db = require('./server/database/db');
      async function check() {
        try {
          const sellers = await db.all('SELECT id, name, email, phone, role, active FROM sellers WHERE organization_id = 1');
          console.log('\\\\n=== SELLERS (vendedores) ===');
          if (sellers.length === 0) {
            console.log('Nenhum vendedor encontrado.');
          } else {
            sellers.forEach(s => {
              console.log(\`ID: \${s.id} | Nome: \${s.name} | E-mail: \${s.email} | Telefone: \${s.phone} | Função: \${s.role} | Ativo: \${s.active}\`);
            });
          }
          console.log(\`\\\\nTotal de vendedores: \${sellers.length}\`);

          const leads = await db.all('SELECT id, name, phone, city, origem, valor_desejado, renda, prioridade FROM leads WHERE organization_id = 1 ORDER BY id DESC LIMIT 10');
          console.log('\\\\n=== LEADS (clientes) - últimos 10 ===');
          if (leads.length === 0) {
            console.log('Nenhum lead encontrado.');
          } else {
            leads.forEach(l => {
              console.log(\`ID: \${l.id} | Nome: \${l.name} | Telefone: \${l.phone} | Cidade: \${l.city || 'N/A'} | Origem: \${l.origem} | Valor desejado: \${l.valor_desejado || 'N/A'} | Renda: \${l.renda || 'N/A'} | Prioridade: \${l.prioridade || 'N/A'}\`);
            });
          }
          console.log(\`\\\\nTotal de leads exibidos: \${leads.length}\`);
        } catch (e) {
          console.error('Erro ao acessar o banco de dados:', e.message);
        }
      }
      check();
    "
  `;

  conn.exec(remoteCommands, (err, stream) => {
    if (err) {
      console.error('Erro ao executar comandos remotos:', err);
      conn.end();
      return;
    }

    stream.on('close', (code, signal) => {
      console.log(`\\nScript de verificação concluído com código: ${code}`);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).on('error', (err) => {
  console.error('Erro na conexão SSH:', err);
}).connect({
  host: '82.29.58.126',
  port: 22,
  username: 'root',
  password: 'Killsis19980910#'
});