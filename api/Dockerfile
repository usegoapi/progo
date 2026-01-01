FROM node:20-alpine

RUN apk add --no-cache curl git python3 make g++ openssl

WORKDIR /app

# =============================================
# BAILEYS - Copiar apenas arquivos essenciais
# =============================================
RUN mkdir -p ./baileys/lib ./baileys/WAProto

# Copiar arquivos do Baileys
COPY baileys/engine-requirements.js ./baileys/
COPY baileys/lib/ ./baileys/lib/
COPY baileys/WAProto/ ./baileys/WAProto/

# Criar package.json limpo do Baileys SEM scripts de build
RUN cat > ./baileys/package.json << 'EOF'
{
  "name": "baileys",
  "type": "module",
  "version": "7.0.0-rc.9",
  "description": "A WebSockets library for interacting with WhatsApp Web",
  "license": "MIT",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "files": ["lib/**/*", "WAProto/**/*", "engine-requirements.js"],
  "scripts": {
    "preinstall": "node ./engine-requirements.js"
  },
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
    "audio-decode": "^2.1.3",
    "jimp": "^1.6.0",
    "link-preview-js": "^3.0.0",
    "sharp": "*"
  },
  "peerDependenciesMeta": {
    "audio-decode": { "optional": true },
    "jimp": { "optional": true },
    "link-preview-js": { "optional": true }
  },
  "engines": { "node": ">=20.0.0" }
}
EOF

# =============================================
# API - Configuração
# =============================================
COPY api/package*.json ./

# Fix baileys path for Docker context
RUN sed -i 's|"baileys": "file:../baileys"|"baileys": "file:./baileys"|g' package.json

# Install dependencies
RUN npm install --legacy-peer-deps

# Install NestJS CLI globally for build
RUN npm install -g @nestjs/cli

# Copy prisma schema and generate client
COPY api/prisma/ ./prisma/
RUN npx prisma generate

# Copy API source code
COPY api/src/ ./src/
COPY api/nest-cli.json ./
COPY api/tsconfig.json ./

# Build the application
RUN npm run build && ls -la dist/

EXPOSE 3001

# Run migrations and start
CMD sh -c "npx prisma migrate deploy && npm run start:prod"
