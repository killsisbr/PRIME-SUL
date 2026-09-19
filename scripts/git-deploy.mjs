#!/usr/bin/env node

/**
 * PRIME SUL — Deploy via Git Pull + PM2 Restart
 * Uso: node git-deploy.mjs [staging|production]
 *
 * Conecta via SSH, faz git pull da branch, e reinicia PM2
 */

import { Client } from 'ssh2';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: 'd:/JARVIS/.env' });

const host = process.env.VPS_HOST || '82.29.58.126';
const password = process.env.VPS_PASSWORD || 'Killsis19980910#';

const target = process.argv[2] || 'staging';

if (target !== 'staging' && target !== 'production') {
    console.error('❌ ERRO: Alvo inválido. Use "staging" ou "production".');
    process.exit(1);
}

const env = {
    staging: {
        dir: '/root/killsis/PRIME-SUL',
        branch: 'staging',
        pm2: 'prime-sul'
    },
    production: {
        dir: '/root/killsis/PRIME-SUL',
        branch: 'main',
        pm2: 'prime-sul'
    }
}[target];

const commands = [
    `echo "🚀 Atualizando [${target.toUpperCase()}] no VPS..."`,
    `cd ${env.dir}`,
    `git fetch origin`,
    `git switch ${env.branch}`,
    `git pull --ff-only origin ${env.branch}`,
    `echo "📦 Instalando dependências..."`,
    `npm install --production`,
    `echo "🔄 Reiniciando PM2 ${env.pm2}..."`,
    `pm2 restart ${env.pm2}`,
    `echo "✅ Deploy concluído com sucesso!"`
];

const fullScript = commands.join(' && ');

console.log(`\n🚀 PRIME SUL — Git Deploy [${target.toUpperCase()}]`);
console.log(`📍 Host: ${host}`);
console.log(`📂 Diretório: ${env.dir}`);
console.log(`🌿 Branch: ${env.branch}`);
console.log(`⚙️  PM2 App: ${env.pm2}\n`);

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Conexão SSH estabelecida.\n');
    conn.exec(fullScript, (err, stream) => {
        if (err) {
            console.error('❌ Erro na execução remota:', err);
            conn.end();
            process.exit(1);
        }
        stream.on('close', (code) => {
            conn.end();
            process.exit(code);
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).on('error', (err) => {
    console.error('❌ Erro de conexão SSH:', err.message);
    process.exit(1);
}).connect({
    host,
    port: 22,
    username: 'root',
    password
});
