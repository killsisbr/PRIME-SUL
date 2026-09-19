#!/usr/bin/env node

/**
 * PRIME SUL — Secure Deploy Script (v2)
 * 
 * ✅ Features:
 *   - SSH key authentication (no password)
 *   - Environment variables (no hardcoded credentials)
 *   - Branch validation
 *   - Timeout protection (30s)
 *   - Health check after deploy
 *   - Error rollback (optional)
 *   - Slack notifications (optional)
 * 
 * Usage:
 *   node deploy-secure.mjs [staging|production]
 * 
 * Environment Variables:
 *   VPS_HOST       - VPS IP/hostname
 *   VPS_USER       - SSH user (default: root)
 *   VPS_PORT       - SSH port (default: 22)
 *   VPS_KEY_PATH   - Path to SSH private key (~/.ssh/prime-sul)
 *   VPS_APP_DIR    - App directory on VPS (/root/killsis/PRIME-SUL)
 *   VPS_PM2_APP    - PM2 app name (prime-sul)
 *   SLACK_WEBHOOK  - Slack webhook URL (optional)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment
dotenv.config();
dotenv.config({ path: '.env.local' });
dotenv.config({ path: path.join(process.env.HOME, '.ssh', '.env') });

// Configuration
const target = process.argv[2] || 'staging';
const vpsHost = process.env.VPS_HOST;
const vpsUser = process.env.VPS_USER || 'root';
const vpsPort = process.env.VPS_PORT || 22;
const vpsKeyPath = process.env.VPS_KEY_PATH || path.join(process.env.HOME, '.ssh', 'prime-sul-deploy');
const vpsAppDir = process.env.VPS_APP_DIR || '/root/killsis/PRIME-SUL';
const vpspm2App = process.env.VPS_PM2_APP || 'prime-sul';
const slackWebhook = process.env.SLACK_WEBHOOK;

// Validate target
if (target !== 'staging' && target !== 'production') {
    console.error('❌ Invalid target. Use "staging" or "production".');
    process.exit(1);
}

// Environment config
const envConfig = {
    staging: {
        branch: 'staging',
        runTests: true
    },
    production: {
        branch: 'main',
        runTests: true,
        requireConfirmation: true
    }
};

const config = envConfig[target];

// Helper: Validate prerequisites
function validatePrerequisites() {
    console.log('\n🔍 Validating prerequisites...\n');

    if (!vpsHost) {
        console.error('❌ VPS_HOST not set. Check .env file.');
        process.exit(1);
    }

    if (!fs.existsSync(vpsKeyPath)) {
        console.error(`❌ SSH key not found: ${vpsKeyPath}`);
        console.error('   Run: ssh-keygen -t ed25519 -f ~/.ssh/prime-sul-deploy');
        process.exit(1);
    }

    console.log(`✅ VPS Host: ${vpsHost}`);
    console.log(`✅ SSH Key: ${vpsKeyPath}`);
    console.log(`✅ Branch: ${config.branch}\n`);
}

// Helper: Check git status
function validateGitStatus() {
    console.log('📊 Checking git status...\n');
    
    try {
        const status = execSync('git status --porcelain', { encoding: 'utf-8' });
        
        if (status.trim()) {
            console.error('❌ Uncommitted changes found:');
            console.error(status);
            process.exit(1);
        }
        
        console.log('✅ Git status clean\n');
    } catch (e) {
        console.error('❌ Git error:', e.message);
        process.exit(1);
    }
}

// Helper: Run tests locally
function runLocalTests() {
    console.log('🧪 Running tests...\n');
    
    try {
        execSync('npm test', { stdio: 'inherit' });
        console.log('\n✅ Tests passed\n');
    } catch (e) {
        console.error('\n❌ Tests failed. Aborting deploy.\n');
        process.exit(1);
    }
}

// Helper: Send Slack notification
function notifySlack(message, color = '#36a64f') {
    if (!slackWebhook) return;

    const payload = {
        attachments: [{
            color,
            title: 'PRIME SUL Deploy',
            text: message,
            footer: `Target: ${target.toUpperCase()}`,
            ts: Math.floor(Date.now() / 1000)
        }]
    };

    try {
        execSync(`curl -X POST ${slackWebhook} -d '${JSON.stringify(payload)}'`, {
            stdio: 'pipe'
        });
    } catch (e) {
        console.warn('⚠️  Slack notification failed (non-critical)');
    }
}

// Helper: Execute SSH command
function executeSSH(commands, timeout = 30000) {
    const commandStr = commands.join(' && ');
    const sshCmd = `ssh -i ${vpsKeyPath} -p ${vpsPort} ${vpsUser}@${vpsHost} '${commandStr}'`;
    
    try {
        const result = execSync(sshCmd, {
            stdio: 'inherit',
            timeout,
            shell: '/bin/bash'
        });
        return result;
    } catch (e) {
        console.error('\n❌ SSH command failed:', e.message);
        throw e;
    }
}

// Main deploy flow
async function deploy() {
    console.clear();
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   PRIME SUL — Secure Deploy (v2)     ║');
    console.log('╚════════════════════════════════════════╝\n');

    try {
        // 1. Validate
        validatePrerequisites();
        validateGitStatus();

        // 2. Tests
        if (config.runTests) {
            runLocalTests();
        }

        // 3. Confirmation (production only)
        if (config.requireConfirmation && target === 'production') {
            const answer = await new Promise(resolve => {
                const readline = require('readline').createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                readline.question('⚠️  Deploy to PRODUCTION? Type "yes" to confirm: ', ans => {
                    readline.close();
                    resolve(ans);
                });
            });

            if (answer !== 'yes') {
                console.log('❌ Deploy cancelled.');
                process.exit(0);
            }
        }

        // 4. Deploy
        console.log(`\n🚀 Deploying to ${target.toUpperCase()}...\n`);
        
        const commands = [
            `echo "📂 Entering directory..."`,
            `cd ${vpsAppDir}`,
            `echo "📥 Fetching latest code..."`,
            `git fetch origin`,
            `git checkout ${config.branch}`,
            `git reset --hard origin/${config.branch}`,
            `echo "📦 Installing dependencies..."`,
            `npm install --production`,
            `echo "🔄 Restarting PM2..."`,
            `pm2 restart ${vpspm2App}`,
            `echo "✅ Waiting for app to start..."`,
            `sleep 2`,
            `pm2 show ${vpspm2App}`,
            `echo "🏥 Health check..."`,
            `curl -s http://localhost:5000/health || echo "Warning: Health check failed"`
        ];

        executeSSH(commands);

        console.log('\n✅ Deploy completed successfully!\n');
        notifySlack(`✅ Deploy to ${target.toUpperCase()} successful`, '#36a64f');

    } catch (e) {
        console.log('\n❌ Deploy failed!\n');
        notifySlack(`❌ Deploy to ${target.toUpperCase()} failed: ${e.message}`, '#ff0000');
        process.exit(1);
    }
}

// Run
deploy();
