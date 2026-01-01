FROM node:20-alpine

RUN apk add --no-cache curl git python3 make g++ openssl

WORKDIR /app

# =============================================
# BAILEYS - Copiar apenas arquivos pré-compilados
# =============================================
RUN mkdir -p ./baileys/lib ./baileys/WAProto

COPY baileys/engine-requirements.js ./baileys/
COPY baileys/lib/ ./baileys/lib/
COPY baileys/WAProto/ ./baileys/WAProto/

# Criar package.json limpo do Baileys SEM scripts de build
RUN cat > ./baileys/package.json << 'EOF'
{
  "name": "baileys",
  "type": "module",
  "version": "7.0.0-rc.9",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "scripts": {},
  "dependencies": {
    "@cacheable/node-cache": "^1.4.0",
    "@hapi/boom": "^9.1.3",
    "async-mutex": "^0.5.0",
    "libsignal": "git+https://github.com/whiskeysockets/libsignal-node",
    "lru-cache": "^11.1.0",
    "music-metadata": "^11.7.0",
    "node-addon-api": "^8.5.0",
    "p-queue": "^9.0.0",
    "pino": "^9.6",
    "protobufjs": "^7.2.4",
    "ws": "^8.13.0"
  },
  "peerDependencies": {
    "jimp": "^1.6.0",
    "link-preview-js": "^3.0.0",
    "sharp": "*"
  },
  "peerDependenciesMeta": {
    "jimp": { "optional": true },
    "link-preview-js": { "optional": true }
  }
}
EOF

# =============================================
# API - Instalar dependências
# =============================================
COPY api/package*.json ./

RUN sed -i 's|"baileys": "file:../baileys"|"baileys": "file:./baileys"|g' package.json

RUN npm install --legacy-peer-deps

# =============================================
# PRISMA - Gerar cliente
# =============================================
COPY api/prisma/ ./prisma/
RUN npx prisma generate

# =============================================
# BUILD - Compilar TypeScript
# =============================================
COPY api/src/ ./src/
COPY api/nest-cli.json ./
COPY api/tsconfig.json ./

# Build usando npx diretamente
RUN npx nest build

# Verificar se o build foi criado (pode estar em dist/ ou dist/src/)
RUN ls -la dist/ && (test -f dist/main.js || test -f dist/src/main.js)

EXPOSE 3001

# Usar o caminho correto do main.js - usar db push ao invés de migrate deploy
CMD ["sh", "-c", "npx prisma db push --skip-generate && if [ -f dist/main.js ]; then node dist/main.js; else node dist/src/main.js; fi"]
