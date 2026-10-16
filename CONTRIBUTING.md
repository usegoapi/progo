# Contribuindo com o GO-API

Obrigado pelo interesse! Este guia explica como preparar o ambiente e enviar sua contribuição.

## Antes de começar

- Procure nas [issues](../../issues) se o assunto já está sendo tratado.
- Para mudanças grandes (nova integração, mudança de arquitetura), abra uma issue antes para alinharmos a abordagem.
- **Nunca** inclua credenciais, tokens, números de telefone reais ou arquivos `.env` em commits, issues ou logs.

## Ambiente

Requisitos: Node.js 22+, PostgreSQL 14+ (ou Docker).

```bash
git clone https://github.com/usegoapi/progo.git
cd progo

# API
cd api && cp .env.example .env && npm install && npx prisma db push && npm run start:dev

# Painel (outro terminal)
cd frontend && cp .env.example .env && npm install && npm run dev
```

## Padrões de código

- TypeScript em todo o projeto. Antes do PR, rode `npm run typecheck` (API) e `npx tsc --noEmit` (painel).
- Siga o estilo do código ao redor: nomes claros e comentários só onde o "porquê" não é óbvio.
- Mensagens para o usuário em **português**. Erros da API devem ser úteis e nunca expor detalhes internos.
- Todo envio de mensagem deve passar pelo `MessageSenderService` (fila anti-ban). Não chame `socket.sendMessage` direto.
- Logs nunca devem conter telefones completos, conteúdo de mensagens ou segredos. Use `maskJid`/`safeUrl`.

## Pull Requests

1. Crie uma branch a partir da `main`: `git checkout -b feat/minha-feature`.
2. Commits pequenos e descritivos (ex: `feat: botão de copiar código`, `fix: reconexão após 515`).
3. Descreva no PR **o que** mudou, **por que** e **como testar**.
4. O CI precisa passar (build da API e do painel).

## Estrutura

```
api/src/
  auth/          Login, JWT, API key e guards de acesso
  instances/     Conexões WhatsApp (Baileys) e fila de envio
  messages/      Rotas de envio (painel e API pública)
  events/        Webhook, WebSocket, RabbitMQ e SQS
  integrations/  Typebot, n8n e Chatwoot
  shared/        Prisma, barramento de eventos e configurações
frontend/src/    Painel Next.js (whitelabel em lib/branding.tsx)
baileys/         Biblioteca de WhatsApp pré-compilada
```
