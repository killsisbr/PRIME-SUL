#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function exec(cmd, options = {}) {
    try {
        return execSync(cmd, {
            stdio: 'inherit',
            cwd: 'D:\\PRIME SUL',
            shell: 'powershell.exe',
            ...options
        });
    } catch (e) {
        console.error(`❌ Erro ao executar: ${cmd}`);
        process.exit(1);
    }
}

async function main() {
    console.log('\n🚀 DEPLOY AUTOMÁTICO - PRIME SUL\n');

    // 1. Verificar status do git
    console.log('📊 Verificando status do git...');
    try {
        const status = execSync('git status --porcelain', {
            cwd: 'D:\\PRIME SUL',
            encoding: 'utf-8'
        }).trim();

        if (!status) {
            console.log('✅ Nenhuma mudança pendente');
            return;
        }

        console.log('\n📝 Mudanças encontradas:\n' + status + '\n');
    } catch (e) {
        console.error('❌ Erro ao verificar git status');
        process.exit(1);
    }

    // 2. Pedir mensagem de commit
    await new Promise(resolve => {
        rl.question('💬 Mensagem de commit: ', (msg) => {
            if (!msg.trim()) {
                console.log('❌ Mensagem vazia, abortando');
                process.exit(1);
            }

            // 3. Fazer commit
            console.log('\n📦 Commitando mudanças...');
            exec(`git add -A`);
            exec(`git commit -m "${msg}"`);

            // 4. Push
            console.log('\n📤 Fazendo push para staging...');
            exec('git push origin staging');

            // 5. Deploy
            console.log('\n🌐 Deployando na VPS...\n');
            exec('node deploy.js');

            console.log('\n🎉 Deploy completo!\n');
            rl.close();
            resolve();
        });
    });
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
