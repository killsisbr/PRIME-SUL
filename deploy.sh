#!/bin/bash

# Deploy Script para PRIME SUL na VPS
# Uso: ./deploy.sh ou bash deploy.sh

VPS_HOST="82.29.58.126"
VPS_USER="root"
VPS_APP_DIR="/root/killsis/PRIME-SUL"
VPS_PM2_APP="prime-sul"

echo "╔════════════════════════════════════╗"
echo "║  PRIME SUL — Deploy Script        ║"
echo "╚════════════════════════════════════╝"
echo ""
echo "📍 Host: $VPS_HOST"
echo "👤 User: $VPS_USER"
echo "📂 App Dir: $VPS_APP_DIR"
echo "⚙️  PM2 App: $VPS_PM2_APP"
echo ""
echo "🚀 Iniciando Deploy..."
echo ""

# Conectar via SSH e executar comandos
ssh -v $VPS_USER@$VPS_HOST << 'EOF'

echo "📂 Entrando no diretório da aplicação..."
cd /root/killsis/PRIME-SUL

echo "📡 Fazendo pull das mudanças..."
git pull origin staging

echo "📦 Instalando dependências..."
npm install --omit=dev

echo "🔄 Reiniciando aplicação com PM2..."
pm2 restart prime-sul || pm2 start server/server.js --name prime-sul

echo "💾 Salvando configuração PM2..."
pm2 save

echo "📊 Verificando status..."
pm2 status prime-sul

echo "✅ Deploy concluído!"

EOF

EXIT_CODE=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Deploy finalizado com sucesso!"
    echo ""
    echo "📝 Próximos passos:"
    echo "  1. Verifique logs: pm2 logs prime-sul"
    echo "  2. Teste OCR: POST /api/leads/ocr com imagem > 8MB"
    echo "  3. Monitore por 24h"
else
    echo "⚠️  Deploy finalizado com código: $EXIT_CODE"
    echo ""
    echo "💡 Se SSH pediu senha, o deploy pode estar funcionando."
    echo "   Verifique logs na VPS: ssh $VPS_USER@$VPS_HOST 'pm2 logs $VPS_PM2_APP'"
fi

echo ""
