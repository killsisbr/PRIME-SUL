const { Client } = require('ssh2');
const conn = new Client();

console.log('Connecting to VPS to query sellers and leads...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    const command = `
      set -e
      echo "Checking for PRIME-SUL project..."
      if [ -d "/root/killis/PRIME-SUL" ]; then
        TARGET_DIR="/root/killis/PRIME-SUL"
      elif [ -d "/root/PRIME-SUL" ]; then
        TARGET_DIR="/root/PRIME-SUL"
      else
        echo "Project directory not found!"
        exit 1
      fi
      echo "Target directory: \$TARGET_DIR"
      cd "\$TARGET_DIR"

      echo "Running database query..."
      node -e "
        const db = require('./server/database/db');
        async function main() {
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
        main();
      "
    `;

    conn.exec(command, (err, stream) => {
      if (err) {
        console.error('Failed to execute command:', err);
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