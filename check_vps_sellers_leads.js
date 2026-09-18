const { Client } = require('ssh2');
const fs = require('fs');

const checkDbPath = './check_db.js';
let checkDbContent;
try {
  checkDbContent = fs.readFileSync(checkDbPath, 'utf8');
} catch (err) {
  console.error(`Failed to read ${checkDbPath}:`, err);
  process.exit(1);
}

const base64Content = Buffer.from(checkDbContent).toString('base64');

const conn = new Client();

console.log('Connecting to VPS to check sellers and leads...');

conn
  .on('ready', () => {
    console.log('SSH connected');
    const remoteCommands = `
      set -e
      echo "Checking project directory..."
      if [ -d "/root/killis/PRIME-SUL" ]; then
        TARGET_DIR="/root/killis/PRIME-SUL"
      elif [ -d "/root/PRIME-SUL" ]; then
        TARGET_DIR="/root/PRIME-SUL"
      else
        echo "Project directory not found!"
        exit 1
      fi
      echo "Target directory: $TARGET_DIR"
      cd "$TARGET_DIR"

      echo "Decoding and running database check..."
      echo "$BASE64" | base64 -d > /tmp/check_db.js
      node /tmp/check_db.js
      rm /tmp/check_db.js
    `;

    // Replace the placeholder with the actual base64 content
    const finalCommands = remoteCommands.replace('$BASE64', base64Content);

    conn.exec(finalCommands, (err, stream) => {
      if (err) {
        console.error('Failed to execute command:', err);
        conn.end();
        return;
      }
      let output = '';
      stream.on('close', (code, signal) => {
        console.log(`\\nCheck completed with exit code: ${code}`);
        conn.end();
      }).on('data', (data) => {
        output += data.toString();
      }).stderr.on('data', (data) => {
        output += 'STDERR: ' + data.toString();
      });
      stream.on('end', () => {
        console.log('=== OUTPUT ===');
        console.log(output);
      });
    });
  })
  .on('error', (err) => {
    console.error('SSH connection error:', err);
  })
  .connect({
    host: '82.29.58.126',
    port: 22,
    username: 'root',
    password: 'Killsis19980910#'
  });