#!/bin/bash

# 🚀 PRIME SUL — Deploy Automático Completo
# Uso: ./deploy-full.sh [mensagem de commit]

set -e

PROJECT_DIR="D:\PRIME SUL"
BRANCH="staging"
VPS_HOST="82.29.58.126"
VPS_USER="root"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 PRIME SUL — Deploy Automático${NC}\n"

# 1️⃣ Verificar status git
echo -e "${BLUE}📊 Verificando status do repositório...${NC}"
cd "$PROJECT_DIR"

STATUS=$(git status --porcelain)
if [ -z "$STATUS" ]; then
    echo -e "${GREEN}✅ Nenhuma mudança pendente${NC}"
    exit 0
fi

echo -e "${YELLOW}📝 Mudanças encontradas:${NC}\n$STATUS\n"

# 2️⃣ Pegar mensagem de commit
COMMIT_MSG="${1:?Erro: Forneça uma mensagem de commit}"

# 3️⃣ Adicionar e fazer commit
echo -e "${BLUE}📦 Commitando mudanças...${NC}"
git add -A
git commit -m "$COMMIT_MSG"

# 4️⃣ Push
echo -e "${BLUE}📤 Fazendo push para $BRANCH...${NC}"
git push origin $BRANCH

# 5️⃣ Deploy via SSH
echo -e "${BLUE}🌐 Deployando na VPS ($VPS_HOST)...${NC}\n"
node deploy.js

echo -e "\n${GREEN}🎉 Deploy completo com sucesso!${NC}\n"
