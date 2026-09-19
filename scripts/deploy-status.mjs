#!/usr/bin/env node

/**
 * PRIME SUL — Verificar Status do Deploy
 * Mostra informações sobre os processos PM2 no VPS
 */

import { Client } from 'ssh2';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: 'd:/JARVIS/.env' });

const host = process.env.VPS_HOST || '82.29.58.126';
const password = process.env.VPS_PASSWORD || 'Killsis19980910#';

console.log('\n📊 PRIME SUL — Status do Deploy\n');

const commands = [
    'echo "🔍 Verificando PM2..."',
    'pm2 status',
    'echo ""',
    'echo "📝 Último commit:"',
    'cd /root/killsis/PRIME-SUL && git log --oneline -5',
    'echo ""',
    'echo "🌿 Branch atual:"',
    'git branch -a',
    'echo ""',
    'echo "📦 Versão do Node e npm:"',
    'node --version && npm --version'
];

const fullScript = commands.join(' && ');

const conn = new Client();

conn.on('ready', () => {
    conn.exec(fullScript, (err, stream) => {
        if (err) {
            console.error('❌ Erro:', err);
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
    console.error('❌ Erro de conexão:', err.message);
    process.exit(1);
}).connect({
    host,
    port: 22,
    username: 'root',
    password
});
