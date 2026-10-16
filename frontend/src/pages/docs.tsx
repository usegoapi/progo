import { useState } from 'react';
import Layout from '@/components/Layout';
import { Copyright, useBrand, usePublicConfig } from '@/lib/branding';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  body?: string;
}

interface Section {
  title: string;
  icon: string;
  auth: 'apikey' | 'jwt' | 'public';
  description: string;
  endpoints: Endpoint[];
}

const sections: Section[] = [
  {
    title: 'Envio (API Key)',
    icon: 'send',
    auth: 'apikey',
    description: 'Rotas para sistemas externos. A instância é identificada pela API key (header x-api-key).',
    endpoints: [
      { method: 'GET', path: '/api/instance', description: 'Status da instância autenticada e tamanho da fila de envio' },
      { method: 'POST', path: '/api/check-numbers', description: 'Verifica se números possuem WhatsApp (até 50)', body: '{ "numbers": ["5511999999999"] }' },
      { method: 'POST', path: '/api/send/text', description: 'Texto. "delay" (ms) mostra "digitando..." antes do envio', body: '{ "to": "5511999999999", "text": "Olá!", "delay": 1200 }' },
      { method: 'POST', path: '/api/send/image', description: 'Imagem por URL pública ou data URI base64', body: '{ "to": "5511999999999", "imageUrl": "https://...", "caption": "Legenda" }' },
      { method: 'POST', path: '/api/send/audio', description: 'Áudio; ptt=true (padrão) converte para nota de voz', body: '{ "to": "5511999999999", "audioUrl": "https://...", "ptt": true }' },
      { method: 'POST', path: '/api/send/video', description: 'Vídeo', body: '{ "to": "5511999999999", "videoUrl": "https://...", "caption": "Legenda" }' },
      { method: 'POST', path: '/api/send/document', description: 'Documento', body: '{ "to": "5511999999999", "documentUrl": "https://...", "filename": "contrato.pdf" }' },
      { method: 'POST', path: '/api/send/contact', description: 'Cartão de contato (vCard)', body: '{ "to": "5511999999999", "contactName": "Maria", "contactPhone": "5511988887777" }' },
      { method: 'POST', path: '/api/send/location', description: 'Localização', body: '{ "to": "5511999999999", "latitude": -23.55, "longitude": -46.63, "name": "Escritório" }' },
      { method: 'POST', path: '/api/send/poll', description: 'Enquete', body: '{ "to": "5511999999999", "question": "Qual horário?", "options": ["Manhã", "Tarde"], "selectableCount": 1 }' },
      {
        method: 'POST',
        path: '/api/send/buttons',
        description: 'Botões interativos (até 10): reply (resposta rápida), url, call e copy. O toque em "reply" chega no webhook com buttonId.',
        body: '{ "to": "5511999999999", "text": "Como podemos ajudar?", "title": "Atendimento", "footer": "Escolha uma opção", "imageUrl": "https://... (opcional)", "buttons": [\n  { "type": "reply", "text": "Falar com vendas", "id": "vendas" },\n  { "type": "url", "text": "Acessar site", "url": "https://suaempresa.com" },\n  { "type": "call", "text": "Ligar", "phoneNumber": "5511999999999" },\n  { "type": "copy", "text": "Copiar cupom", "copyCode": "CUPOM10" }\n] }',
      },
      { method: 'GET', path: '/api/catalog', description: 'Produtos do catálogo (WhatsApp Business). Atenção: o WhatsApp pode não responder essa consulta para aparelhos conectados; nesse caso retorna 504 em até 15s.' },
      { method: 'POST', path: '/api/send/catalog', description: 'Cartão com botão "Ver catálogo" (abre o catálogo no WhatsApp do contato). Requer conta Business.', body: '{ "to": "5511999999999", "text": "Confira nossas novidades", "buttonText": "Ver catálogo", "imageUrl": "https://... (opcional)" }' },
      { method: 'POST', path: '/api/send/product', description: 'Produto do catálogo (foto, preço e botão "Ver"). productId é o número do link wa.me/p/ID/telefone. Informe title, price e imageUrl.', body: '{ "to": "5511999999999", "productId": "1234567890", "title": "Camiseta", "price": 59.9, "currency": "BRL", "imageUrl": "https://...", "text": "Esse é o modelo que você pediu" }' },
    ],
  },
  {
    title: 'Autenticação',
    icon: 'lock',
    auth: 'public',
    description: 'Login do painel (JWT). Tokens são invalidados ao trocar a senha.',
    endpoints: [
      { method: 'POST', path: '/auth/login', description: 'Login e obtenção do token JWT', body: '{ "email": "admin@empresa.com", "password": "********" }' },
      { method: 'GET', path: '/auth/me', description: 'Dados do usuário autenticado (JWT)' },
      { method: 'POST', path: '/auth/change-password', description: 'Troca a senha e encerra outras sessões (JWT)', body: '{ "currentPassword": "...", "newPassword": "..." }' },
      { method: 'POST', path: '/auth/register', description: 'Cadastro (somente com ALLOW_REGISTRATION=true ou feito por um admin)', body: '{ "email": "...", "password": "...", "name": "..." }' },
    ],
  },
  {
    title: 'Instâncias',
    icon: 'smartphone',
    auth: 'jwt',
    description: 'Gerenciamento das conexões WhatsApp',
    endpoints: [
      { method: 'GET', path: '/instances', description: 'Listar instâncias' },
      { method: 'POST', path: '/instances', description: 'Criar instância (gera a API key)', body: '{ "name": "Atendimento" }' },
      { method: 'GET', path: '/instances/:id', description: 'Detalhes e status' },
      { method: 'PUT', path: '/instances/:id', description: 'Renomear', body: '{ "name": "Vendas" }' },
      { method: 'DELETE', path: '/instances/:id', description: 'Remover instância e sessão' },
      { method: 'POST', path: '/instances/:id/connect', description: 'Conectar (retorna QR Code em base64)' },
      { method: 'GET', path: '/instances/:id/qr', description: 'QR Code atual' },
      { method: 'POST', path: '/instances/:id/restart', description: 'Reiniciar mantendo a sessão' },
      { method: 'POST', path: '/instances/:id/disconnect', description: 'Desconectar (logout no aparelho)' },
      { method: 'POST', path: '/instances/:id/rotate-key', description: 'Gerar nova API key (a anterior deixa de funcionar)' },
      { method: 'GET', path: '/instances/:id/settings', description: 'Configurações (comportamento, proxy, eventos e integrações)' },
      { method: 'PUT', path: '/instances/:id/settings', description: 'Atualizar configurações (parcial)', body: '{ "rejectCalls": true, "webhook": { "enabled": true, "url": "https://...", "events": ["MESSAGES_UPSERT"] } }' },
    ],
  },
  {
    title: 'Webhooks',
    icon: 'webhook',
    auth: 'jwt',
    description: 'Webhooks globais do usuário (todas ou uma instância específica)',
    endpoints: [
      { method: 'GET', path: '/webhooks', description: 'Listar webhooks' },
      { method: 'GET', path: '/webhooks/events', description: 'Eventos disponíveis' },
      { method: 'POST', path: '/webhooks', description: 'Criar webhook', body: '{ "url": "https://...", "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE"], "secret": "opcional" }' },
      { method: 'POST', path: '/webhooks/:id/test', description: 'Enviar evento de teste' },
      { method: 'PUT', path: '/webhooks/:id', description: 'Atualizar', body: '{ "active": false }' },
      { method: 'DELETE', path: '/webhooks/:id', description: 'Remover' },
    ],
  },
  {
    title: 'Integrações',
    icon: 'extension',
    auth: 'jwt',
    description: 'Configuração padrão (global) de Typebot, n8n e Chatwoot. A configuração da instância tem prioridade.',
    endpoints: [
      { method: 'GET', path: '/integrations', description: 'Listar integrações' },
      { method: 'POST', path: '/integrations/typebot', description: 'Salvar Typebot', body: '{ "enabled": true, "apiUrl": "https://typebot.io", "publicName": "meu-bot", "triggerType": "keyword", "keyword": "oi" }' },
      { method: 'POST', path: '/integrations/n8n', description: 'Salvar n8n', body: '{ "enabled": true, "webhookUrl": "https://n8n.../webhook/...", "triggerType": "all" }' },
      { method: 'POST', path: '/integrations/chatwoot', description: 'Salvar Chatwoot (bidirecional)', body: '{ "enabled": true, "url": "https://app.chatwoot.com", "accountId": "1", "token": "...", "nameInbox": "WhatsApp" }' },
      { method: 'POST', path: '/integrations/:tipo/test', description: 'Testar conexão (typebot, n8n ou chatwoot)' },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: 'bg-green-500/20 text-green-400 border-green-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const authBadge = {
  apikey: { label: 'Header x-api-key', className: 'bg-primary/10 text-primary border-primary/30' },
  jwt: { label: 'Authorization: Bearer <JWT>', className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  public: { label: 'Pública / JWT', className: 'bg-slate-500/10 text-slate-300 border-slate-500/30' },
};

export default function Docs() {
  const { apiUrl } = usePublicConfig();
  const brand = useBrand();
  const baseUrl = apiUrl || (typeof window !== 'undefined' ? window.location.origin.replace(/:\d+$/, ':4000') : '');
  const [activeSection, setActiveSection] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const section = sections[activeSection];
  const curl = `curl -X POST ${baseUrl}/api/send/text \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: SUA_API_KEY" \\\n  -d '{"to":"5511999999999","text":"Olá do ${brand.name}!"}'`;

  return (
    <Layout>
      <div className="mb-10">
        <h2 className="text-4xl font-black tracking-tight text-white mb-2">Documentação da API</h2>
        <p className="text-slate-400 text-lg font-light">Referência dos endpoints do {brand.name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="p-5 rounded-xl bg-surface-dark border border-border-dark">
          <p className="text-sm text-slate-400 mb-1">Base URL da API</p>
          <div className="flex items-center justify-between gap-3">
            <code className="text-primary font-mono break-all">{baseUrl}</code>
            <button onClick={() => copy(baseUrl, 'base')} className="text-slate-400 hover:text-white">
              <span className="material-symbols-outlined text-lg">{copied === 'base' ? 'check' : 'content_copy'}</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            A API key de cada instância fica no card da instância. Envie-a no header <code className="text-slate-300">x-api-key</code>.
          </p>
        </div>
        <div className="p-5 rounded-xl bg-surface-dark border border-border-dark">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-400">Exemplo rápido</p>
            <button onClick={() => copy(curl, 'curl')} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">{copied === 'curl' ? 'check' : 'content_copy'}</span>
              {copied === 'curl' ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <pre className="bg-[#0d0d0d] p-3 rounded-lg text-xs text-slate-300 overflow-x-auto">{curl}</pre>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {sections.map((s, index) => (
          <button
            key={s.title}
            onClick={() => setActiveSection(index)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeSection === index ? 'bg-primary text-on-primary' : 'bg-surface-dark text-slate-400 hover:text-white border border-border-dark'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{s.icon}</span>
            {s.title}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border-dark bg-surface-dark overflow-hidden">
        <div className="p-6 border-b border-border-dark flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">{section.icon}</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{section.title}</h3>
              <p className="text-slate-400 text-sm">{section.description}</p>
            </div>
          </div>
          <span className={`self-start sm:self-auto px-3 py-1 rounded-lg text-xs font-mono border ${authBadge[section.auth].className}`}>
            {authBadge[section.auth].label}
          </span>
        </div>

        <div className="divide-y divide-border-dark">
          {section.endpoints.map((endpoint) => {
            const id = `${endpoint.method} ${endpoint.path}`;
            return (
              <div key={id} className="p-6 hover:bg-surface-light/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${methodColors[endpoint.method]}`}>{endpoint.method}</span>
                      <code className="text-white font-mono text-sm break-all">{endpoint.path}</code>
                    </div>
                    <p className="text-slate-400 text-sm">{endpoint.description}</p>
                    {endpoint.body && (
                      <pre className="mt-3 bg-[#0d0d0d] p-3 rounded-lg text-xs text-slate-300 overflow-x-auto">{endpoint.body}</pre>
                    )}
                  </div>
                  <button
                    onClick={() => copy(`${baseUrl}${endpoint.path}`, id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-surface-light rounded-lg transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-sm">{copied === id ? 'check' : 'content_copy'}</span>
                    {copied === id ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border-dark bg-surface-dark p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">notifications</span>
            Principais eventos
          </h3>
          <div className="space-y-2">
            {[
              ['MESSAGES_UPSERT', 'Mensagem recebida (ou enviada pelo celular)'],
              ['SEND_MESSAGE', 'Mensagem enviada pela API, painel ou bots'],
              ['MESSAGES_UPDATE', 'Entregue / lida'],
              ['CONNECTION_UPDATE', 'Mudança de status da conexão'],
              ['QRCODE_UPDATED', 'Novo QR Code (inclui base64)'],
              ['CALL', 'Chamada recebida'],
            ].map(([event, desc]) => (
              <div key={event} className="flex items-center gap-3 p-3 bg-surface-light/50 rounded-lg">
                <code className="text-primary text-xs font-mono whitespace-nowrap">{event}</code>
                <span className="text-slate-400 text-sm">{desc}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border-dark bg-surface-dark p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">verified_user</span>
            Assinatura dos webhooks
          </h3>
          <p className="text-slate-400 text-sm mb-3">
            Com um segredo configurado, cada entrega traz <code className="text-slate-300">X-Timestamp</code> e{' '}
            <code className="text-slate-300">X-Signature: sha256=…</code> (HMAC-SHA256 de <code className="text-slate-300">timestamp.corpo</code>).
          </p>
          <pre className="bg-[#0d0d0d] p-3 rounded-lg text-xs text-slate-300 overflow-x-auto">{`const expected = crypto
  .createHmac('sha256', SEGREDO)
  .update(\`\${req.headers['x-timestamp']}.\${rawBody}\`)
  .digest('hex');
const ok = req.headers['x-signature'] === \`sha256=\${expected}\`;`}</pre>
          <p className="text-slate-500 text-xs mt-3">Falhas (5xx/timeout) são reenviadas até 3 vezes (2s, 10s, 30s).</p>
        </div>
      </div>

      <div className="mt-12 border-t border-border-dark/50 pt-6 text-center">
        <Copyright />
      </div>
    </Layout>
  );
}
