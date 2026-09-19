#!/usr/bin/env node

/**
 * PRIME SUL — Deploy Now (SSH password authentication)
 * 
 * Usage:
 *   node scripts/deploy-now.mjs
 * 
 * Requirements:
 *   - VPS_HOST environment variable
 *   - VPS_PASSWORD environment variable (ou usar .env)
 * 
 * This is a temporary script until SSH key auth is configured.
 * After configuring SSH key, use: scripts/deploy-secure.mjs
 */

import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const host = process.env.VPS_HOST || '82.29.58.126';
const user = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
const appDir = process.env.VPS_APP_DIR || '/root/killsis/PRIME-SUL';
const pm2App = process.env.VPS_PM2_APP || 'prime-sul';

if (!password) {
    console.error('\n❌ VPS_PASSWORD not set in .env\n');
    process.exit(1);
}

const commands = [
    `echo "📂 Entering directory..."`,
    `cd ${appDir}`,
    `echo "📥 Fetching latest code..."`,
    `git fetch origin`,
    `git switch staging`,
    `git pull --ff-only origin staging`,
    `echo "📦 Installing dependencies..."`,
    `npm install --production`,
    `echo "🔄 Restarting PM2..."`,
    `pm2 restart ${pm2App} || pm2 start server/server.js --name ${pm2App}`,
    `echo "✅ Waiting for app to start..."`,
    `sleep 2`,
    `pm2 show ${pm2App}`,
    `echo "✅ Deploy completed successfully!"`
];

const fullCommand = commands.join(' && ');

console.log('\n╔════════════════════════════════════════╗');
console.log('║   PRIME SUL — Deploy Now              ║');
console.log('╚════════════════════════════════════════╝\n');

console.log(`📍 Host: ${host}`);
console.log(`👤 User: ${user}`);
console.log(`📂 App Dir: ${appDir}`);
console.log(`⚙️  PM2 App: ${pm2App}\n`);

console.log('🚀 Deploying...\n');

try {
    // Using sshpass to provide password
    const sshCommand = `sshpass -p "${password}" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${user}@${host} '${fullCommand}'`;
    
    execSync(sshCommand, {
        stdio: 'inherit',
        timeout: 60000
    });

    console.log('\n✅ Deploy completed successfully!\n');
    
} catch (err) {
    console.error('\n❌ Deploy failed!\n');
    console.error('Error:', err.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check VPS_PASSWORD is correct in .env');
    console.error('2. Check VPS_HOST is correct');
    console.error('3. Check sshpass is installed: apt-get install sshpass\n');
    process.exit(1);
}
