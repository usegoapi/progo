FROM node:20-alpine

RUN apk add --no-cache curl git python3 make g++ openssl

WORKDIR /app

# =============================================
# BAILEYS - Copiar apenas arquivos essenciais
# =============================================
RUN mkdir -p ./baileys/lib ./baileys/WAProto

# Copiar arquivos do Baileys
COPY baileys/package.json ./baileys/
COPY baileys/engine-requirements.js ./baileys/
COPY baileys/lib/ ./baileys/lib/
COPY baileys/WAProto/ ./baileys/WAProto/

# Remover scripts de build do package.json do Baileys para evitar rebuild
RUN sed -i 's/"prepare": "npm run build",//' ./baileys/package.json && \
    sed -i 's/"prepack": "npm run build",//' ./baileys/package.json && \
    sed -i 's/"build": "tsc -P tsconfig.build.json && tsc-esm-fix --tsconfig=tsconfig.build.json --ext=.js",/"build": "echo skipped",/' ./baileys/package.json

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
