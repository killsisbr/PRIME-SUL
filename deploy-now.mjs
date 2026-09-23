#!/usr/bin/env node
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações da VPS
const VPS_HOST = process.env.VPS_HOST || '82.29.58.126';
const VPS_USER = process.env.VPS_USER || 'root';
const VPS_PORT = process.env.VPS_PORT || '22';
const VPS_APP_DIR = process.env.VPS_APP_DIR || '/root/killsis/PRIME-SUL';
const VPS_PM2_APP = process.env.VPS_PM2_APP || 'prime-sul';

function log(message, type = 'info') {
    const colors = {
        info: '\x1b[36m',    // Cyan
        success: '\x1b[32m', // Green
        error: '\x1b[31m',   // Red
        warning: '\x1b[33m', // Yellow
        reset: '\x1b[0m'
    };
    const color = colors[type] || colors.info;
    console.log(`${color}${message}${colors.reset}`);
}

function exec(cmd, options = {}) {
    try {
        log(`\n⚙️  ${cmd}`, 'info');
        const result = execSync(cmd, {
            stdio: 'inherit',
            cwd: __dirname,
            ...options
        });
        return result;
    } catch (e) {
        log(`\n❌ Erro ao executar: ${cmd}`, 'error');
        process.exit(1);
    }
}

async function main() {
    console.clear();
    log('╔════════════════════════════════════╗', 'info');
    log('║  PRIME SUL — Deploy Agora         ║', 'info');
    log('╚════════════════════════════════════╝', 'info');
    
    log(`\n📍 Host: ${VPS_HOST}`, 'info');
    log(`👤 User: ${VPS_USER}`, 'info');
    log(`📂 App Dir: ${VPS_APP_DIR}`, 'info');
    log(`⚙️  PM2 App: ${VPS_PM2_APP}`, 'info');
    
    log('\n🚀 Iniciando Deploy...', 'info');
    
    // Construir comando SSH único
    const sshCmd = [
        `cd ${VPS_APP_DIR}`,
        `git pull origin staging`,
        `npm install --omit=dev`,
        `pm2 restart ${VPS_PM2_APP} || pm2 start server/server.js --name ${VPS_PM2_APP}`,
        `pm2 save`,
        `pm2 status ${VPS_PM2_APP}`
    ].join(' && ');
    
    const fullCmd = `ssh -p ${VPS_PORT} ${VPS_USER}@${VPS_HOST} "${sshCmd}"`;
    
    log('\n📂 Conectando na VPS...', 'info');
    
    try {
        exec(fullCmd);
        
        log('\n✅ Deploy completado com sucesso!', 'success');
        log('\n📊 Verificando status...', 'info');
        
        const statusCmd = `ssh -p ${VPS_PORT} ${VPS_USER}@${VPS_HOST} "pm2 status ${VPS_PM2_APP}"`;
        exec(statusCmd);
        
        log('\n🎉 Aplicação atualizada na VPS!', 'success');
        log('\n📝 Mudanças commitadas e deployadas com sucesso.', 'success');
        
    } catch (e) {
        log(`\n❌ Erro durante deploy: ${e.message}`, 'error');
        process.exit(1);
    }
}

main();
