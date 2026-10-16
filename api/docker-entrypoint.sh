#!/bin/sh
set -e

echo "🔄 Sincronizando schema do banco (prisma db push)..."
# Sem --accept-data-loss: alterações destrutivas abortam em vez de apagar dados.
npx prisma db push --skip-generate

echo "🚀 Iniciando GO-API..."
exec node dist/main.js
