# Script de Deploy para VPS
# Comandos SSH diretos para atualizar o código e reiniciar o serviço

$VPS_HOST = "82.29.58.126"
$VPS_USER = "root"
$VPS_PASSWORD = "Killsis19980910#"
$VPS_APP_DIR = "/root/killsis/PRIME-SUL"
$VPS_PM2_APP = "prime-sul"

Write-Host "🚀 Iniciando deploy na VPS..." -ForegroundColor Cyan
Write-Host "📍 Host: $VPS_HOST" -ForegroundColor Gray
Write-Host "👤 User: $VPS_USER" -ForegroundColor Gray
Write-Host "📂 App Dir: $VPS_APP_DIR" -ForegroundColor Gray
Write-Host ""

# Comandos a executar na VPS
$COMMANDS = @(
    "echo 'Entrando no diretório da aplicação...'",
    "cd $VPS_APP_DIR",
    "echo 'Fazendo pull das mudanças...'",
    "git pull origin staging",
    "echo 'Instalando dependências...'",
    "npm install",
    "echo 'Reiniciando aplicação com PM2...'",
    "pm2 restart $VPS_PM2_APP || pm2 start server/server.js --name $VPS_PM2_APP",
    "pm2 save",
    "echo 'Verificando status...'",
    "pm2 status $VPS_PM2_APP"
)

$SSH_COMMAND = $COMMANDS -join " && "

Write-Host "⚙️  Conectando à VPS e executando comandos..." -ForegroundColor Yellow
Write-Host ""

# Usando sshpass para autenticação com password
$env:SSHPASS = $VPS_PASSWORD

try {
    # Tentar com sshpass se disponível
    & sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$VPS_USER@$VPS_HOST" "$SSH_COMMAND" 2>&1
    $deploySuccess = $?
} catch {
    Write-Host "⚠️  sshpass não disponível, tentando abordagem alternativa..." -ForegroundColor Yellow
    Write-Host "⚠️  Você será pedida a senha interativamente" -ForegroundColor Yellow
    & ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "$SSH_COMMAND" 2>&1
    $deploySuccess = $?
}

if ($deploySuccess) {
    Write-Host ""
    Write-Host "✅ Deploy completado com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Status da Aplicação:" -ForegroundColor Cyan
    & ssh "$VPS_USER@$VPS_HOST" "pm2 status $VPS_PM2_APP"
} else {
    Write-Host ""
    Write-Host "❌ Erro durante o deploy" -ForegroundColor Red
    exit 1
}
