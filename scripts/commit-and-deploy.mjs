#!/usr/bin/env node

/**
 * PRIME SUL — Commit + Push + Deploy em um comando
 * Uso: node commit-and-deploy.mjs "mensagem do commit" [staging|production]
 */

import { execSync } from 'child_process';
import readline from 'readline';

const args = process.argv.slice(2);
let message = args[0];
let target = args[1] || 'staging';

if (!message) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('💬 Mensagem de commit: ', (msg) => {
        rl.close();
        runDeploy(msg, target);
    });
} else {
    runDeploy(message, target);
}

function runDeploy(commitMsg, deployTarget) {
    try {
        console.log('\n🚀 PRIME SUL — Ciclo Completo de Deploy\n');

        // 1. Verificar status
        console.log('📊 Verificando status do git...');
        const status = execSync('git status --porcelain', { encoding: 'utf-8' });

        if (!status.trim()) {
            console.log('✅ Nenhuma mudança pendente.\n');
            process.exit(0);
        }

        console.log(`📝 Mudanças encontradas:\n${status}`);

        // 2. Commit
        console.log('📦 Commitando mudanças...');
        execSync('git add -A', { stdio: 'inherit' });
        execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
        console.log('✅ Commit feito.\n');

        // 3. Push
        console.log(`📤 Fazendo push para ${deployTarget}...`);
        const branch = deployTarget === 'production' ? 'main' : 'staging';
        execSync(`git push origin ${branch}`, { stdio: 'inherit' });
        console.log('✅ Push concluído.\n');

        // 4. Deploy
        console.log(`🌐 Deployando na VPS [${deployTarget.toUpperCase()}]...\n`);
        execSync(`node scripts/git-deploy.mjs ${deployTarget}`, { stdio: 'inherit' });

        console.log('\n🎉 Ciclo completo concluído com sucesso!\n');
    } catch (e) {
        console.error(`\n❌ Erro: ${e.message}\n`);
        process.exit(1);
    }
}
