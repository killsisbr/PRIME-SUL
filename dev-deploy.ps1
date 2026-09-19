# Script de Deploy Automático - PRIME SUL
# Uso: .\dev-deploy.ps1

Write-Host "`n🚀 DEPLOY AUTOMÁTICO - PRIME SUL`n" -ForegroundColor Green

# Verificar status git
Write-Host "📊 Verificando status do git..." -ForegroundColor Cyan
$status = git status --porcelain

if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "✅ Nenhuma mudança pendente" -ForegroundColor Green
    exit 0
}

Write-Host "`n📝 Mudanças encontradas:`n$status`n" -ForegroundColor Yellow

# Pedir mensagem de commit
$message = Read-Host "💬 Mensagem de commit"

if ([string]::IsNullOrWhiteSpace($message)) {
    Write-Host "❌ Mensagem vazia, abortando" -ForegroundColor Red
    exit 1
}

# Fazer commit
Write-Host "`n📦 Commitando mudanças..." -ForegroundColor Cyan
git add -A
git commit -m "$message"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao fazer commit" -ForegroundColor Red
    exit 1
}

# Push
Write-Host "`n📤 Fazendo push para staging..." -ForegroundColor Cyan
git push origin staging

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao fazer push" -ForegroundColor Red
    exit 1
}

# Deploy
Write-Host "`n🌐 Deployando na VPS...`n" -ForegroundColor Cyan
node deploy.js

Write-Host "`n🎉 Deploy completo!`n" -ForegroundColor Green
