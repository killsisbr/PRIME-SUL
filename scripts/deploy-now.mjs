#!/usr/bin/env node

/**
 * PRIME SUL — Deploy Agora (via sshpass)
 * 
 * Usa sshpass para autenticação por senha
 * Simples, rápido, sem depender de SSH keys
 * 
 * Usage:
 *   node deploy-now.mjs
 * 
 * Requer:
 *   - sshpass instalado (choco install sshpass)
 *   - VPS_HOST, VPS_USER, VPS_PASSWORD em .env
 */

import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

const VPS_HOST = process.env.VPS_HOST || '82.29.58.126';
const VPS_USER = process.env.VPS_USER || 'root';
const VPS_PASSWORD = process.env.VPS_PASSWORD;
const VPS_APP_DIR = process.env.VPS_APP_DIR || '/root/killsis/PRIME-SUL';
const VPS_PM2_APP = process.env.VPS_PM2_APP || 'prime-sul';

console.log('');
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║                                                                ║');
console.log('║           🚀 DEPLOY AGORA (via sshpass) 🚀                    ║');
console.log('║                                                                ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('');

// Validate
if (!VPS_PASSWORD) {
  console.error('❌ VPS_PASSWORD não está definida em .env');
  console.error('   Adicione: VPS_PASSWORD=sua_senha');
  process.exit(1);
}

console.log(`📍 VPS: ${VPS_HOST}`);
console.log(`👤 User: ${VPS_USER}`);
console.log(`📂 App Dir: ${VPS_APP_DIR}`);
console.log(`🔄 PM2 App: ${VPS_PM2_APP}`);
console.log('');

// Deploy commands
const commands = [
  'cd ' + VPS_APP_DIR,
  'echo "📥 Atualizando código..."',
  'git fetch origin',
  'git checkout staging',
  'git pull --ff-only origin staging',
  'echo "✅ Código atualizado!"',
  'echo ""',
  'echo "📦 Instalando dependências..."',
  'npm install --production 2>&1 | tail -20',
  'echo "✅ Dependências instaladas!"',
  'echo ""',
  'echo "🔄 Reiniciando PM2..."',
  'pm2 restart ' + VPS_PM2_APP + ' || pm2 start server/server.js --name ' + VPS_PM2_APP,
  'sleep 2',
  'echo "✅ App reiniciado!"',
  'echo ""',
  'echo "📊 Status do PM2:"',
  'pm2 status',
  'echo ""',
  'echo "🌐 URL:"',
  'echo "https://82.29.58.126"',
  'echo ""',
  'echo "✅ DEPLOY COMPLETO!"'
];

const fullCommand = commands.join(' && ');

// Execute SSH
console.log('🔐 Executando deploy via SSH...');
console.log('');

try {
  // Usar sshpass se disponível
  try {
    execSync('sshpass -V', { stdio: 'ignore' });
  } catch {
    console.warn('⚠️  sshpass não instalado. Tentando SSH direto...');
  }

  const sshCmd = `sshpass -p "${VPS_PASSWORD}" ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "${fullCommand}"`;
  
  execSync(sshCmd, { 
    stdio: 'inherit',
    timeout: 120000 // 2 minutos
  });

  console.log('');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('✅ DEPLOY CONCLUÍDO COM SUCESSO!');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('📊 Verifique em: https://82.29.58.126');
  console.log('');

} catch (error) {
  console.log('');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('❌ ERRO NO DEPLOY');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Possíveis causas:');
  console.log('  1. VPS offline ou firewall bloqueando');
  console.log('  2. Senha incorreta (VPS_PASSWORD em .env)');
  console.log('  3. Timeout na conexão');
  console.log('  4. Git pull falhou (merge conflict?)');
  console.log('  5. npm install teve erro');
  console.log('');
  console.log('Próximo passo:');
  console.log('  SSH manualmente: ssh root@82.29.58.126');
  console.log('  Depois: cd /root/killsis/PRIME-SUL && git status');
  console.log('');
  
  process.exit(1);
}
