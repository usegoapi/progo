import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';

interface Integration {
  id: string;
  type: string;
  config: any;
  active: boolean;
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [activeTab, setActiveTab] = useState('typebot');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [typebotUrl, setTypebotUrl] = useState('');
  const [n8nUrl, setN8nUrl] = useState('');
  const [n8nKey, setN8nKey] = useState('');
  const [chatwootUrl, setChatwootUrl] = useState('');
  const [chatwootKey, setChatwootKey] = useState('');
  const [chatwootAccount, setChatwootAccount] = useState('');
  const [chatwootInbox, setChatwootInbox] = useState('');

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const { data } = await api.get('/integrations');
      setIntegrations(data);

      data.forEach((int: Integration) => {
        if (int.type === 'TYPEBOT') setTypebotUrl(int.config.webhookUrl || '');
        else if (int.type === 'N8N') {
          setN8nUrl(int.config.webhookUrl || '');
          setN8nKey(int.config.apiKey || '');
        } else if (int.type === 'CHATWOOT') {
          setChatwootUrl(int.config.apiUrl || '');
          setChatwootKey(int.config.apiKey || '');
          setChatwootAccount(int.config.accountId || '');
          setChatwootInbox(int.config.inboxId || '');
        }
      });
    } catch {}
  };

  const saveIntegration = async (type: string) => {
    setLoading(true);
    setMessage('');
    try {
      let config = {};
      if (type === 'typebot') config = { webhookUrl: typebotUrl };
      else if (type === 'n8n') config = { webhookUrl: n8nUrl, apiKey: n8nKey };
      else if (type === 'chatwoot')
        config = {
          apiUrl: chatwootUrl,
          apiKey: chatwootKey,
          accountId: chatwootAccount,
          inboxId: chatwootInbox,
        };

      await api.post(`/integrations/${type}`, { config, active: true });
      setMessage('Configuração salva com sucesso!');
      loadIntegrations();
    } catch {
      setMessage('Erro ao salvar configuração');
    }
    setLoading(false);
  };

  const tabs = [
    { id: 'typebot', label: 'Typebot', icon: 'smart_toy', color: 'blue-500' },
    { id: 'n8n', label: 'n8n', icon: 'account_tree', color: 'orange-500' },
    { id: 'chatwoot', label: 'Chatwoot', icon: 'support_agent', color: 'purple-500' },
  ];

  const getIntegrationStatus = (type: string) => {
    const int = integrations.find((i) => i.type === type.toUpperCase());
    return int?.active;
  };

  return (
    <Layout>
      <div className="mb-10">
        <h2 className="text-4xl font-black tracking-tight text-white mb-2">Integrações</h2>
        <p className="text-slate-400 text-lg font-light">
          Configure suas integrações com plataformas externas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-border-dark bg-surface-dark p-4 space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMessage('');
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-slate-400 hover:bg-surface-light hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                {tab.label}
                {getIntegrationStatus(tab.id) && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-success" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Config Panel */}
        <div className="lg:col-span-3 rounded-2xl border border-border-dark bg-surface-dark p-6">
          {message && (
            <div
              className={`mb-6 p-4 rounded-lg text-sm ${
                message.includes('Erro')
                  ? 'bg-danger/10 text-danger border border-danger/20'
                  : 'bg-success/10 text-success border border-success/20'
              }`}
            >
              {message}
            </div>
          )}

          {activeTab === 'typebot' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-blue-500 text-2xl">smart_toy</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Typebot</h3>
                  <p className="text-slate-400 text-sm">
                    Conecte com chatbots do Typebot para automação
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Webhook URL</label>
                <input
                  type="text"
                  placeholder="https://typebot.io/api/v1/webhooks/..."
                  value={typebotUrl}
                  onChange={(e) => setTypebotUrl(e.target.value)}
                  className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                />
              </div>

              <button
                onClick={() => saveIntegration('typebot')}
                disabled={loading}
                className="px-6 py-3 bg-primary hover:bg-primary-hover text-black font-bold rounded-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar Configuração'}
              </button>
            </div>
          )}

          {activeTab === 'n8n' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-orange-500 text-2xl">
                    account_tree
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">n8n</h3>
                  <p className="text-slate-400 text-sm">
                    Integre com fluxos de automação do n8n
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Webhook URL</label>
                <input
                  type="text"
                  placeholder="https://n8n.seudominio.com/webhook/..."
                  value={n8nUrl}
                  onChange={(e) => setN8nUrl(e.target.value)}
                  className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  API Key (opcional)
                </label>
                <input
                  type="password"
                  placeholder="Sua API Key"
                  value={n8nKey}
                  onChange={(e) => setN8nKey(e.target.value)}
                  className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                />
              </div>

              <button
                onClick={() => saveIntegration('n8n')}
                disabled={loading}
                className="px-6 py-3 bg-primary hover:bg-primary-hover text-black font-bold rounded-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar Configuração'}
              </button>
            </div>
          )}

          {activeTab === 'chatwoot' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-purple-500 text-2xl">
                    support_agent
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Chatwoot</h3>
                  <p className="text-slate-400 text-sm">
                    Sincronize conversas com o Chatwoot
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">API URL</label>
                  <input
                    type="text"
                    placeholder="https://app.chatwoot.com"
                    value={chatwootUrl}
                    onChange={(e) => setChatwootUrl(e.target.value)}
                    className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">API Key</label>
                  <input
                    type="password"
                    placeholder="Sua API Key"
                    value={chatwootKey}
                    onChange={(e) => setChatwootKey(e.target.value)}
                    className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Account ID</label>
                  <input
                    type="text"
                    placeholder="1"
                    value={chatwootAccount}
                    onChange={(e) => setChatwootAccount(e.target.value)}
                    className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Inbox ID</label>
                  <input
                    type="text"
                    placeholder="1"
                    value={chatwootInbox}
                    onChange={(e) => setChatwootInbox(e.target.value)}
                    className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                  />
                </div>
              </div>

              <button
                onClick={() => saveIntegration('chatwoot')}
                disabled={loading}
                className="px-6 py-3 bg-primary hover:bg-primary-hover text-black font-bold rounded-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar Configuração'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 border-t border-border-dark/50 pt-6 text-center">
        <p className="text-sm text-slate-600">© 2025 GO-API todos direitos reservados.</p>
      </div>
    </Layout>
  );
}
