# Política de segurança

## Reportando uma vulnerabilidade

**Não abra uma issue pública** para relatar falhas de segurança.

Use o reporte privado do GitHub: aba **Security › Report a vulnerability** deste repositório. Inclua:

- descrição do problema e do impacto;
- passos para reproduzir (versão, configuração relevante, requisições);
- se possível, uma sugestão de correção.

Retornaremos o quanto antes. Depois de corrigida, a vulnerabilidade será divulgada com os devidos créditos, se você quiser.

## Boas práticas para quem hospeda

- Defina `JWT_SECRET`, `APP_SECRET` e `POSTGRES_PASSWORD` com valores aleatórios (`openssl rand -hex 32`).
- Use HTTPS (proxy reverso) e restrinja `CORS_ORIGINS` ao domínio do painel.
- Mantenha `ALLOW_REGISTRATION=false`, a menos que precise de cadastro público.
- Ative `BLOCK_PRIVATE_NETWORK=true` se outras pessoas tiverem acesso ao painel.
- Faça backup dos volumes `pgdata` e `sessions` (as sessões contêm as credenciais do WhatsApp).
- Mantenha o projeto atualizado (`git pull && docker compose up -d --build`).
