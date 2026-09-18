const { Client } = require('ssh2');
const conn = new Client();

console.log('Iniciando conexão SSH com VPS 82.29.58.126 para reset do banco de dados...');

conn
  .on('ready', () => {
    console.log('Conexão SSH estabelecida com sucesso.');

    // Script shell para rodar na VPS - apenas reset do banco de dados
    const remoteCommands = `
      set -e
      echo "=== 1. VERIFICANDO DIRETÓRIO DO PROJETO ==="
      if [ -d "/root/killis/PRIME-SUL" ]; then
        TARGET_DIR="/root/killis/PRIME-SUL"
      elif [ -d "/root/PRIME-SUL" ]; then
        TARGET_DIR="/root/PRIME-SUL"
      else
        echo "ERRO: Diretório do projeto não encontrado!"
        exit 1
      fi

      echo "Diretório alvo: $TARGET_DIR"
      cd "$TARGET_DIR"

      echo "=== 2. RESETANDO BANCO DE DADOS (preservando sessions) ==="
      node -e "
        const db = require('./server/database/db');
        async function resetDatabase() {
          try {
            // Get all table names
            const tables = await db.all(\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name\");
            console.log('Tabelas encontradas:', tables.map(t => t.name).join(', '));

            // Tabelas para excluir da exclusão de dados (preservar essas)
            const exclude = ['sessions']; // Vamos manter a tabela de sessions

            console.log('Tabelas a preservar (dados NÃO serão deletados):', exclude.join(', '));

            // Excluir dados das tabelas não-excluídas
            for (const table of tables) {
              const tableName = table.name;
              if (!exclude.includes(tableName)) {
                console.log(`Limpando tabela: \${tableName}`);
                await db.run(\`DELETE FROM \${tableName}\`);
                // Reset autoincrement counter for this table
                await db.run(\`DELETE FROM sqlite_sequence WHERE name = '\${tableName}'\`);
                console.log(`  → Dados limpos e auto-increment resetado para \${tableName}`);
              } else {
                console.log(`  → Pulando \${tableName} (preservado conforme solicitado)`);
              }
            }

            console.log('\\\\nReset do banco de dados concluído com sucesso.');
            console.log('Nota: Os dados da tabela de sessions foram preservados conforme solicitado.');
          } catch (e) {
            console.error('Erro durante o reset do banco de dados:', e.message);
            process.exit(1);
          }
        }
        resetDatabase();
      "
    `;

    conn.exec(remoteCommands, (err, stream) => {
      if (err) {
        console.error('Erro ao executar comandos remotos:', err);
        conn.end();
        return;
      }

      stream.on('close', (code, signal) => {
        console.log(`\\nProcesso encerrado com código: ${code}`);
        conn.end();
      }).on('data', (data) => {
        process.stdout.write(data);
      }).stderr.on('data', (data) => {
        process.stderr.write(data);
      });
    });
  })
  .on('error', (err) => {
    console.error('Erro na conexão SSH:', err);
  })
  .connect({
    host: '82.29.58.126',
    port: 22,
    username: 'root',
    password: 'Killsis19980910#'
  });