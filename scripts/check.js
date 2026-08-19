const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? walk(p) : (e.name.endsWith('.js') ? [p] : []);
    });
}

const files = [...walk(path.join(__dirname, '..', 'server')), ...walk(path.join(__dirname, '..', 'public'))];
let failed = false;
for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) { failed = true; process.stderr.write(result.stderr || result.stdout); }
}
if (failed) process.exit(1);
console.log(`${files.length} arquivos JavaScript válidos.`);
