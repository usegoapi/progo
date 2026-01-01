import { useState } from 'react';
import Layout from '@/components/Layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://goapi-go-api.pdjn0h.easypanel.host';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  body?: string;
}

interface Section {
  title: string;
  icon: string;
  description: string;
  endpoints: Endpoint[];
}

const sections: Section[] = [
  {
    title: 'Autenticação',
    icon: 'lock',
    description: 'Endpoints para login e gerenciamento de tokens',
    endpoints: [
      { method: 'POST', path: '/auth/login', description: 'Fazer login e obter token JWT', body: '{ "email": "string", "password": "string" }' },
      { method: 'POST', path: '/auth/register', description: 'Registrar novo usuário', body: '{ "email": "string", "password": "string", "name": "string" }' },
      { method: 'POST', path: '/auth/shared-token', description: 'Criar token compartilhado para instância', body: '{ "instanceId": "string", "expiresInHours": 24, "permissions": ["send_message"] }' },
    ],
  },
  {
    title: 'Instâncias',
    icon: 'smartphone',
    description: 'Gerenciamento de instâncias WhatsApp',
    endpoints: [
      { method: 'GET', path: '/instances', description: 'Listar todas as instâncias' },
      { method: 'POST', path: '/instances', description: 'Criar nova instância', body: '{ "name": "string" }' },
      { method: 'GET', path: '/instances/:id', description: 'Buscar instância por ID' },
      { method: 'DELETE', path: '/instances/:id', description: 'Deletar instância' },
      { method: 'GET', path: '/instances/:id/qr', description: 'Obter QR Code para conexão' },
      { method: 'POST', path: '/instances/:id/connect', description: 'Conectar instância' },
      { method: 'POST', path: '/instances/:id/disconnect', description: 'Desconectar instância' },
    ],
  },
  {
    title: 'Mensagens',
    icon: 'chat',
    description: 'Envio de mensagens via WhatsApp',
    endpoints: [
      { method: 'POST', path: '/messages/text', description: 'Enviar mensagem de texto', body: '{ "instanceId": "string", "to": "5511999999999", "text": "string" }' },
      { method: 'POST', path: '/messages/image', description: 'Enviar imagem', body: '{ "instanceId": "string", "to": "string", "imageUrl": "string", "caption": "string" }' },
      { method: 'POST', path: '/messages/audio', description: 'Enviar áudio', body: '{ "instanceId": "string", "to": "string", "audioUrl": "string", "ptt": true }' },
      { method: 'POST', path: '/messages/location', description: 'Enviar localização', body: '{ "instanceId": "string", "to": "string", "latitude": -23.5, "longitude": -46.6 }' },
      { method: 'POST', path: '/messages/buttons', description: 'Enviar mensagem com botões', body: '{ "instanceId": "string", "to": "string", "text": "string", "buttons": [{"text": "Opção 1"}] }' },
    ],
  },
  {
    title: 'Webhooks',
    icon: 'webhook',
    description: 'Configuração de webhooks para eventos',
    endpoints: [
      { method: 'GET', path: '/webhooks', description: 'Listar webhooks configurados' },
      { method: 'POST', path: '/webhooks', description: 'Criar novo webhook', body: '{ "url": "https://...", "events": ["message_received", "message_sent"] }' },
      { method: 'PUT', path: '/webhooks/:id', description: 'Atualizar webhook' },
      { method: 'DELETE', path: '/webhooks/:id', description: 'Deletar webhook' },
    ],
  },
  {
    title: 'Integrações',
    icon: 'extension',
    description: 'Integração com Typebot, n8n e Chatwoot',
    endpoints: [
      { method: 'GET', path: '/integrations', description: 'Listar integrações' },
      { method: 'POST', path: '/integrations/typebot', description: 'Configurar Typebot', body: '{ "webhookUrl": "string", "instanceId": "string" }' },
      { method: 'POST', path: '/integrations/n8n', description: 'Configurar n8n', body: '{ "apiKey": "string", "webhookUrl": "string" }' },
      { method: 'POST', path: '/integrations/chatwoot', description: 'Configurar Chatwoot', body: '{ "apiKey": "string", "accountId": "string", "inboxId": "string" }' },
      { method: 'DELETE', path: '/integrations/:id', description: 'Remover integração' },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: 'bg-green-500/20 text-green-400 border-green-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function Docs() {
  const [activeSection, setActiveSection] = useState(0);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  const copyToClipboard = (text: string, endpoint: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(endpoint);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  return (
    <Layout>
      <div className="mb-10">
        <h2 className="text-4xl font-black tracking-tight text-white mb-2">Documentação da API</h2>
        <p className="text-slate-400 text-lg font-light">
          Referência completa dos endpoints disponíveis
        </p>
      </div>

      {/* API Base URL */}
      <div className="mb-8 p-4 rounded-xl bg-surface-dark border border-border-dark">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400 mb-1">Base URL da API</p>
            <code className="text-primary font-mono">{API_URL}</code>
          </div>
          <a
            href={`${API_URL}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">open_in_new</span>
            Swagger UI
          </a>
        </div>
      </div>

      {/* Sections Navigation */}
      <div className="flex flex-wrap gap-2 mb-8">
        {sections.map((section, index) => (
          <button
            key={section.title}
            onClick={() => setActiveSection(index)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeSection === index
                ? 'bg-primary text-black'
                : 'bg-surface-dark text-slate-400 hover:text-white border border-border-dark'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{section.icon}</span>
            {section.title}
          </button>
        ))}
      </div>

      {/* Active Section Content */}
      <div className="rounded-2xl border border-border-dark bg-surface-dark overflow-hidden">
        <div className="p-6 border-b border-border-dark">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">
                {sections[activeSection].icon}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{sections[activeSection].title}</h3>
              <p className="text-slate-400 text-sm">{sections[activeSection].description}</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-border-dark">
          {sections[activeSection].endpoints.map((endpoint, index) => (
            <div key={index} className="p-6 hover:bg-surface-light/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold border ${methodColors[endpoint.method]}`}>
                      {endpoint.method}
                    </span>
                    <code className="text-white font-mono text-sm">{endpoint.path}</code>
                  </div>
                  <p className="text-slate-400 text-sm">{endpoint.description}</p>
                  
                  {endpoint.body && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-500 mb-1">Body:</p>
                      <pre className="bg-[#0d0d0d] p-3 rounded-lg text-xs text-slate-300 overflow-x-auto">
                        {endpoint.body}
                      </pre>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => copyToClipboard(`${API_URL}${endpoint.path}`, endpoint.path)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-surface-light rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">
                    {copiedEndpoint === endpoint.path ? 'check' : 'content_copy'}
                  </span>
                  {copiedEndpoint === endpoint.path ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook Events */}
      <div className="mt-8 rounded-2xl border border-border-dark bg-surface-dark p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">notifications</span>
          Eventos de Webhook
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { event: 'message_received', desc: 'Quando uma mensagem é recebida' },
            { event: 'message_sent', desc: 'Quando uma mensagem é enviada' },
            { event: 'instance_status', desc: 'Mudança de status da instância' },
            { event: 'qr_code_updated', desc: 'Quando o QR Code é atualizado' },
          ].map((item) => (
            <div key={item.event} className="flex items-center gap-3 p-3 bg-surface-light/50 rounded-lg">
              <code className="text-primary text-sm font-mono">{item.event}</code>
              <span className="text-slate-400 text-sm">- {item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 border-t border-border-dark/50 pt-6 text-center">
        <p className="text-sm text-slate-600">© 2025 GO-API todos direitos reservados.</p>
      </div>
    </Layout>
  );
}
