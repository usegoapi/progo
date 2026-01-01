FROM node:20-alpine

RUN apk add --no-cache curl git python3 make g++ openssl

WORKDIR /app

# =============================================
# BAILEYS - Copiar apenas arquivos essenciais
# =============================================
# Criar estrutura do baileys
RUN mkdir -p ./baileys/lib ./baileys/WAProto

# Copiar apenas o necessário do Baileys (sem node_modules, src, examples, etc)
COPY baileys/package.json ./baileys/
COPY baileys/engine-requirements.js ./baileys/
COPY baileys/lib/ ./baileys/lib/
COPY baileys/WAProto/ ./baileys/WAProto/

# =============================================
# API - Configuração
# =============================================
COPY api/package*.json ./

# Fix baileys path for Docker context
RUN sed -i 's|"baileys": "file:../baileys"|"baileys": "file:./baileys"|g' package.json

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy prisma schema and generate client
COPY api/prisma/ ./prisma/
RUN npx prisma generate

# Copy API source code
COPY api/src/ ./src/
COPY api/nest-cli.json ./
COPY api/tsconfig.json ./

# Build the application
RUN npm run build

EXPOSE 3001

# Run migrations and start
CMD sh -c "npx prisma migrate deploy && npm run start:prod"
