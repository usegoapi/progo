# syntax=docker/dockerfile:1
# =============================================================
# GO-API · Backend (NestJS + Baileys)
# Contexto de build: raiz do repositório
# =============================================================

# ---------- Build ----------
FROM node:22-alpine AS build
RUN apk add --no-cache git python3 make g++ openssl
WORKDIR /app

# Baileys vendorizada (somente os arquivos pré-compilados)
COPY baileys/package.json baileys/engine-requirements.js baileys/LICENSE ./baileys/
COPY baileys/lib ./baileys/lib
COPY baileys/WAProto ./baileys/WAProto

# Dependências da API (install-links=true instala a Baileys como pacote normal)
WORKDIR /app/api
COPY api/package.json api/.npmrc ./
RUN npm install --no-audit --no-fund

COPY api/prisma ./prisma
RUN npx prisma generate

COPY api/tsconfig.json api/nest-cli.json ./
COPY api/src ./src
RUN npx nest build && npm prune --omit=dev

# ---------- Runtime ----------
FROM node:22-alpine AS runtime
RUN apk add --no-cache ffmpeg openssl tini curl
ENV NODE_ENV=production \
    PORT=3001 \
    SESSIONS_DIR=/app/sessions \
    FFMPEG_PATH=/usr/bin/ffmpeg

WORKDIR /app
COPY --from=build --chown=node:node /app/api/node_modules ./node_modules
COPY --from=build --chown=node:node /app/api/dist ./dist
COPY --from=build --chown=node:node /app/api/prisma ./prisma
COPY --from=build --chown=node:node /app/api/package.json ./package.json
COPY --chown=node:node api/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh && mkdir -p /app/sessions && chown -R node:node /app/sessions
USER node

EXPOSE 3001
VOLUME ["/app/sessions"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./docker-entrypoint.sh"]
