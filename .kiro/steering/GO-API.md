# GO-API - Documentação de Referência

## Visão Geral
- **Nome**: GO-API
- **Organização**: OTHON RIGHETTI
- **Stack**: Node.js + TypeScript + NestJS + PostgreSQL + Redis + Next.js

## Estrutura do Projeto
```
go-api/
├── api/                      # Backend NestJS + Baileys
│   ├── src/
│   │   ├── main.ts           # Entry point
│   │   ├── app.module.ts     # Módulo principal
│   │   ├── auth/             # JWT + tokens temporários
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── dto/auth.dto.ts
│   │   ├── instances/        # Gerenciamento instâncias WhatsApp
│   │   │   ├── instances.module.ts
│   │   │   ├── instances.service.ts
│   │   │   ├── instances.controller.ts
│   │   │   ├── instances.gateway.ts (WebSocket)
│   │   │   ├── baileys.service.ts
│   │   │   └── dto/instance.dto.ts
│   │   ├── messages/         # Envio de mensagens
│   │   │   ├── messages.module.ts
│   │   │   ├── messages.service.ts
│   │   │   ├── messages.controller.ts
│   │   │   └── dto/message.dto.ts
│   │   ├── webhooks/         # Webhooks eventos
│   │   │   ├── webhooks.module.ts
│   │   │   ├── webhooks.service.ts
│   │   │   ├── webhooks.controller.ts
│   │   │   └── dto/webhook.dto.ts
│   │   ├── integrations/     # Typebot, n8n, Chatwoot
│   │   │   ├── integrations.module.ts
│   │   │   ├── integrations.service.ts
│   │   │   ├── integrations.controller.ts
│   │   │   ├── typebot.service.ts
│   │   │   ├── n8n.service.ts
│   │   │   ├── chatwoot.service.ts
│   │   │   └── dto/integration.dto.ts
│   │   └── shared/           # Serviços compartilhados
│   │       ├── shared.module.ts
│   │       ├── prisma.service.ts
│   │       └── redis.service.ts
│   ├── prisma/
│   │   └── schema.prisma     # Schema do banco
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   └── Dockerfile
├── frontend/                 # Next.js + Tailwind
│   ├── src/
│   │   ├── pages/
│   │   │   ├── _app.tsx
│   │   │   ├── index.tsx
│   │   │   ├── login.tsx
│   │   │   ├── dashboard.tsx
│   │   │   ├── instances.tsx
│   │   │   ├── messages.tsx
│   │   │   └── integrations.tsx
│   │   ├── components/
│   │   │   └── Layout.tsx
│   │   ├── lib/
│   │   │   └── api.ts
│   │   ├── store/
│   │   │   └── auth.ts
│   │   └── styles/
│   │       └── globals.css
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

## Banco de Dados (PostgreSQL)
### Tabelas Principais
- **users**: id, email, password, role (admin/user), created_at
- **instances**: id, user_id, name, status, session_data (JSON), created_at
- **messages**: id, instance_id, from, to, type, content, status, created_at
- **webhooks**: id, user_id, url, events[], active, created_at
- **integrations**: id, user_id, type (typebot/n8n/chatwoot), config (JSON), active
- **shared_tokens**: id, instance_id, token, expires_at, permissions[]

## Autenticação
- **JWT**: Login usuários (email + senha)
- **Tokens Temporários**: Compartilhar instâncias sem login
- **RBAC**: admin (tudo), user (próprias instâncias)

## Tipos de Mensagens
- Texto
- Imagem
- Áudio
- Localização
- Botões interativos (PIX)

## Webhooks - Eventos
- `message_received`
- `message_sent`
- `instance_status`
- `qr_code_updated`

## Integrações
### Typebot
- Webhook URL para receber/responder mensagens

### n8n
- API Key para enviar dados aos fluxos

### Chatwoot
- API Key + Webhook para sincronizar conversas

## Endpoints Principais
### Auth
- POST /auth/login
- POST /auth/register
- POST /auth/refresh
- POST /auth/shared-token

### Instances
- GET /instances
- POST /instances
- GET /instances/:id
- DELETE /instances/:id
- GET /instances/:id/qr
- POST /instances/:id/connect
- POST /instances/:id/disconnect

### Messages
- POST /messages/text
- POST /messages/image
- POST /messages/audio
- POST /messages/location
- POST /messages/buttons

### Webhooks
- GET /webhooks
- POST /webhooks
- PUT /webhooks/:id
- DELETE /webhooks/:id

### Integrations
- GET /integrations
- POST /integrations/typebot
- POST /integrations/n8n
- POST /integrations/chatwoot
- PUT /integrations/:id
- DELETE /integrations/:id

## Variáveis de Ambiente
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/goapi
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret
JWT_EXPIRES_IN=7d
PORT=3000
```

## Comandos
```bash
# API
cd api && npm run start:dev

# Frontend
cd frontend && npm run dev

# Docker
docker-compose up -d
```
