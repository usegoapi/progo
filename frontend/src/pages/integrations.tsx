import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import Swal from 'sweetalert2';

interface Integration {
  id: string;
  type: string;
  config: any;
  active: boolean;
}

// Toggle Component
const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) => (
  <div className="flex items-center justify-between">
    {label && <span className="text-sm text-slate-300">{label}</span>}
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-surface-light'}`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  </div>
);

// Input Component
const Input = ({ label, value, onChange, placeholder, type = 'text', required = false }: any) => (
  <div>
    <label className="block text-sm font-medium text-slate-300 mb-2">
      {label}{required && <span className="text-primary">*</span>}
    </label>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-11 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
    />
  </div>
);

// Select Component
const Select = ({ label, value, onChange, options }: any) => (
  <div>
    <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-11 px-4 bg-[#2a2a2a] text-white border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [activeTab, setActiveTab] = useState('typebot');
  const [loading, setLoading] = useState(false);

  // Typebot State
  const [typebot, setTypebot] = useState({
    enabled: false,
    description: '',
    apiUrl: '',
    publicName: '',
    triggerType: 'keyword',
    triggerOperator: 'contains',
    keyword: '',
    expireMinutes: 0,
    keywordFinish: '',
    delayMessage: 1000,
    unknownMessage: '',
    listeningFromMe: false,
    stopBotFromMe: false,
    keepOpen: false,
    debounceTime: 10,
  });

  // n8n State
  const [n8n, setN8n] = useState({
    enabled: false,
    description: '',
    webhookUrl: '',
    basicAuthUser: '',
    basicAuthPassword: '',
    triggerType: 'keyword',
    triggerOperator: 'contains',
    keyword: '',
    expireMinutes: 0,
    keywordFinish: '',
    delayMessage: 1000,
    unknownMessage: '',
    listeningFromMe: false,
    stopBotFromMe: false,
    keepOpen: false,
    debounceTime: 10,
    splitMessages: false,
  });

  // Chatwoot State
  const [chatwoot, setChatwoot] = useState({
    enabled: false,
    sqs: false,
    url: '',
    accountId: '',
    token: '',
    signMessages: false,
    signDelimiter: '\\n',
    nameInbox: '',
    organization: '',
    logo: '',
    conversationPending: false,
    reopenConversation: true,
    importContacts: false,
    importMessages: false,
    daysLimitImport: 3,
    ignoreJids: '',
    autoCreate: true,
  });

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const { data } = await api.get('/integrations');
      const arr = Array.isArray(data) ? data : [];
      setIntegrations(arr);

      arr.forEach((int: Integration) => {
        if (int.type === 'TYPEBOT' || int.type === 'typebot') {
          setTypebot(prev => ({ ...prev, ...int.config, enabled: int.active }));
        } else if (int.type === 'N8N' || int.type === 'n8n') {
          setN8n(prev => ({ ...prev, ...int.config, enabled: int.active }));
        } else if (int.type === 'CHATWOOT' || int.type === 'chatwoot') {
          setChatwoot(prev => ({ ...prev, ...int.config, enabled: int.active }));
        }
      });
    } catch {
      setIntegrations([]);
    }
  };

  const saveIntegration = async (type: string) => {
    setLoading(true);
    
    try {
      let payload = {};

      if (type === 'typebot') {
        payload = { ...typebot };
      } else if (type === 'n8n') {
        payload = { ...n8n };
      } else if (type === 'chatwoot') {
        payload = { ...chatwoot };
      }

      const { data } = await api.post(`/integrations/${type}`, payload);
      
      await Swal.fire({
        icon: 'success',
        title: 'Sucesso!',
        text: data.message || 'Configuração salva com sucesso!',
        confirmButtonText: 'OK',
        confirmButtonColor: '#d4a843',
        background: '#1a1a1a',
        color: '#fff',
        iconColor: '#22c55e',
        customClass: {
          popup: 'rounded-xl border border-[#2a2a2a]',
          confirmButton: 'rounded-lg font-semibold',
        },
      });
      
      loadIntegrations();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erro ao salvar configuração';
      
      await Swal.fire({
        icon: 'error',
        title: 'Erro na Configuração',
        text: errorMessage,
        confirmButtonText: 'Entendi',
        confirmButtonColor: '#d4a843',
        background: '#1a1a1a',
        color: '#fff',
        iconColor: '#ef4444',
        customClass: {
          popup: 'rounded-xl border border-[#2a2a2a]',
          confirmButton: 'rounded-lg font-semibold',
        },
      });
    }
    setLoading(false);
  };

  const testChatwootConnection = async () => {
    if (!chatwoot.url || !chatwoot.accountId || !chatwoot.token) {
      await Swal.fire({
        icon: 'warning',
        title: 'Campos Obrigatórios',
        text: 'Preencha URL, Account ID e Token para testar a conexão',
        confirmButtonText: 'OK',
        confirmButtonColor: '#d4a843',
        background: '#1a1a1a',
        color: '#fff',
        iconColor: '#f59e0b',
        customClass: {
          popup: 'rounded-xl border border-[#2a2a2a]',
          confirmButton: 'rounded-lg font-semibold',
        },
      });
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/integrations/chatwoot/test', chatwoot);
      
      await Swal.fire({
        icon: 'success',
        title: 'Conexão OK!',
        html: `
          <p class="mb-2">${data.message}</p>
          ${data.inboxes?.length > 0 ? `
            <div class="text-left mt-4 p-3 bg-[#2a2a2a] rounded-lg">
              <p class="text-sm text-gray-400 mb-2">Inboxes encontradas:</p>
              <ul class="text-sm">
                ${data.inboxes.map((i: any) => `<li class="text-white">• ${i.name} (ID: ${i.id})</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        `,
        confirmButtonText: 'OK',
        confirmButtonColor: '#d4a843',
        background: '#1a1a1a',
        color: '#fff',
        iconColor: '#22c55e',
        customClass: {
          popup: 'rounded-xl border border-[#2a2a2a]',
          confirmButton: 'rounded-lg font-semibold',
          htmlContainer: 'text-gray-300',
        },
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erro ao testar conexão';
      
      await Swal.fire({
        icon: 'error',
        title: 'Falha na Conexão',
        text: errorMessage,
        confirmButtonText: 'Entendi',
        confirmButtonColor: '#d4a843',
        background: '#1a1a1a',
        color: '#fff',
        iconColor: '#ef4444',
        customClass: {
          popup: 'rounded-xl border border-[#2a2a2a]',
          confirmButton: 'rounded-lg font-semibold',
        },
      });
    }
    setLoading(false);
  };

  const testTypebotConnection = async () => {
    if (!typebot.apiUrl || !typebot.publicName) {
      await Swal.fire({
        icon: 'warning',
        title: 'Campos Obrigatórios',
        text: 'Preencha API URL e Public Name para testar a conexão',
        confirmButtonText: 'OK',
        confirmButtonColor: '#d4a843',
        background: '#1a1a1a',
        color: '#fff',
        iconColor: '#f59e0b',
        customClass: {
          popup: 'rounded-xl border border-[#2a2a2a]',
          confirmButton: 'rounded-lg font-semibold',
        },
      });
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/integrations/typebot/test', typebot);
      
      await Swal.fire({
        icon: 'success',
        title: 'Conexão OK!',
        html: `
          <p class="mb-2">${data.message}</p>
          ${data.typebot ? `
            <div class="text-left mt-4 p-3 bg-[#2a2a2a] rounded-lg">
              <p class="text-sm text-gray-400 mb-2">Detalhes do Bot:</p>
              <ul class="text-sm">
                <li class="text-white">• Nome: ${data.typebot.name || 'N/A'}</li>
                <li class="text-white">• Public ID: ${data.typebot.publicId || 'N/A'}</li>
              </ul>
            </div>
          ` : ''}
        `,
        confirmButtonText: 'OK',
        confirmButtonColor: '#d4a843',
        background: '#1a1a1a',
        color: '#fff',
        iconColor: '#22c55e',
        customClass: {
          popup: 'rounded-xl border border-[#2a2a2a]',
          confirmButton: 'rounded-lg font-semibold',
          htmlContainer: 'text-gray-300',
        },
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erro ao testar conexão';
      
      await Swal.fire({
        icon: 'error',
        title: 'Falha na Conexão',
        text: errorMessage,
        confirmButtonText: 'Entendi',
        confirmButtonColor: '#d4a843',
        background: '#1a1a1a',
        color: '#fff',
        iconColor: '#ef4444',
        customClass: {
          popup: 'rounded-xl border border-[#2a2a2a]',
          confirmButton: 'rounded-lg font-semibold',
        },
      });
    }
    setLoading(false);
  };

  const testN8nConnection = async () => {
    if (!n8n.webhookUrl) {
      await Swal.fire({
        icon: 'warning',
        title: 'Campo Obrigatório',
        text: 'Preencha a Webhook URL para testar a conexão',
        confirmButtonText: 'OK',
        confirmButtonColor: '#d4a843',
        background: '#1a1a1a',
        color: '#fff',
        iconColor: '#f59e0b',
        customClass: {
          popup: 'rounded-xl border border-[#2a2a2a]',
          confirmButton: 'rounded-lg font-semibold',
        },
      });
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/integrations/n8n/test', n8n);
      
      await Swal.fire({
        icon: 'success',
        title: 'Conexão OK!',
        html: `
          <p class="mb-2">${data.message}</p>
          ${data.response ? `
            <div class="text-left mt-4 p-3 bg-[#2a2a2a] rounded-lg">
              <p class="text-sm text-gray-400 mb-2">Resposta do Webhook:</p>
              <p class="text-sm text-white">Status: ${data.response.status}</p>
              ${data.response.data ? `<p class="text-xs text-gray-400 mt-2 break-all">${JSON.stringify(data.response.data).substring(0, 200)}...</p>` : ''}
            </div>
          ` : ''}
        `,
        confirmButtonText: 'OK',
        confirmButtonColor: '#d4a843',
        background: '#1a1a1a',
        color: '#fff',
        iconColor: '#22c55e',
        customClass: {
          popup: 'rounded-xl border border-[#2a2a2a]',
          confirmButton: 'rounded-lg font-semibold',
          htmlContainer: 'text-gray-300',
        },
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erro ao testar conexão';
      
      await Swal.fire({
        icon: 'error',
        title: 'Falha na Conexão',
        text: errorMessage,
        confirmButtonText: 'Entendi',
        confirmButtonColor: '#d4a843',
        background: '#1a1a1a',
        color: '#fff',
        iconColor: '#ef4444',
        customClass: {
          popup: 'rounded-xl border border-[#2a2a2a]',
          confirmButton: 'rounded-lg font-semibold',
        },
      });
    }
    setLoading(false);
  };

  const tabs = [
    { id: 'typebot', label: 'Typebot', icon: 'smart_toy', color: 'blue-500' },
    { id: 'n8n', label: 'n8n', icon: 'account_tree', color: 'orange-500' },
    { id: 'chatwoot', label: 'Chatwoot', icon: 'support_agent', color: 'purple-500' },
  ];

  const getIntegrationStatus = (type: string) => {
    const int = integrations.find((i) => i.type.toLowerCase() === type.toLowerCase());
    return int?.active;
  };

  return (
    <Layout>
      <div className="mb-10">
        <h2 className="text-4xl font-black tracking-tight text-white mb-2">Integrações</h2>
        <p className="text-slate-400 text-lg font-light">Configure suas integrações com plataformas externas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-border-dark bg-surface-dark p-4 space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id ? 'bg-primary/10 text-primary border border-primary/20' : 'text-slate-400 hover:bg-surface-light hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                {tab.label}
                {getIntegrationStatus(tab.id) && <span className="ml-auto h-2 w-2 rounded-full bg-success" />}
              </button>
            ))}
          </div>
        </div>

        {/* Config Panel */}
        <div className="lg:col-span-3 rounded-2xl border border-border-dark bg-surface-dark p-6">

          {/* TYPEBOT */}
          {activeTab === 'typebot' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-500 text-2xl">smart_toy</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Typebot</h3>
                    <p className="text-slate-400 text-sm">Conecte com chatbots do Typebot</p>
                  </div>
                </div>
                <Toggle checked={typebot.enabled} onChange={(v) => setTypebot({ ...typebot, enabled: v })} />
              </div>

              <div className="space-y-4">
                <Input label="Description" value={typebot.description} onChange={(v: string) => setTypebot({ ...typebot, description: v })} placeholder="Descrição da integração" />
                
                <div className="border-t border-border-dark pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Typebot Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Typebot API URL" value={typebot.apiUrl} onChange={(v: string) => setTypebot({ ...typebot, apiUrl: v })} placeholder="https://typebot.io/api/v1/..." required />
                    <Input label="Typebot Public Name" value={typebot.publicName} onChange={(v: string) => setTypebot({ ...typebot, publicName: v })} placeholder="Nome público" />
                  </div>
                </div>

                <div className="border-t border-border-dark pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Trigger Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select 
                      label="Trigger Type" 
                      value={typebot.triggerType} 
                      onChange={(v: string) => setTypebot({ ...typebot, triggerType: v })}
                      options={[
                        { value: 'keyword', label: 'Keyword' },
                        { value: 'all', label: 'All' },
                        { value: 'advanced', label: 'Advanced' },
                        { value: 'none', label: 'None' },
                      ]}
                    />
                    {typebot.triggerType === 'keyword' && (
                      <>
                        <Select 
                          label="Trigger Operator" 
                          value={typebot.triggerOperator} 
                          onChange={(v: string) => setTypebot({ ...typebot, triggerOperator: v })}
                          options={[
                            { value: 'contains', label: 'Contains' },
                            { value: 'equals', label: 'Equals' },
                            { value: 'startsWith', label: 'Starts With' },
                            { value: 'endsWith', label: 'Ends With' },
                            { value: 'regex', label: 'Regex' },
                          ]}
                        />
                        <Input label="Keyword/Trigger" value={typebot.keyword} onChange={(v: string) => setTypebot({ ...typebot, keyword: v })} placeholder="Palavra-chave" />
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t border-border-dark pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">General Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Expire in minutes" type="number" value={typebot.expireMinutes} onChange={(v: string) => setTypebot({ ...typebot, expireMinutes: parseInt(v) || 0 })} placeholder="0" />
                    <Input label="Keyword Finish" value={typebot.keywordFinish} onChange={(v: string) => setTypebot({ ...typebot, keywordFinish: v })} placeholder="#sair" />
                    <Input label="Default Delay Message (ms)" type="number" value={typebot.delayMessage} onChange={(v: string) => setTypebot({ ...typebot, delayMessage: parseInt(v) || 1000 })} placeholder="1000" />
                    <Input label="Unknown Message" value={typebot.unknownMessage} onChange={(v: string) => setTypebot({ ...typebot, unknownMessage: v })} placeholder="Mensagem para comando desconhecido" />
                    <Input label="Debounce Time (s)" type="number" value={typebot.debounceTime} onChange={(v: string) => setTypebot({ ...typebot, debounceTime: parseInt(v) || 10 })} placeholder="10" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="p-4 bg-surface-light rounded-lg">
                      <Toggle checked={typebot.listeningFromMe} onChange={(v) => setTypebot({ ...typebot, listeningFromMe: v })} label="Listening from me" />
                    </div>
                    <div className="p-4 bg-surface-light rounded-lg">
                      <Toggle checked={typebot.stopBotFromMe} onChange={(v) => setTypebot({ ...typebot, stopBotFromMe: v })} label="Stop bot from me" />
                    </div>
                    <div className="p-4 bg-surface-light rounded-lg">
                      <Toggle checked={typebot.keepOpen} onChange={(v) => setTypebot({ ...typebot, keepOpen: v })} label="Keep open" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => saveIntegration('typebot')} disabled={loading} className="px-6 py-3 bg-primary hover:bg-primary-hover text-black font-bold rounded-lg transition-all disabled:opacity-50">
                  {loading ? 'Salvando...' : 'Salvar Configuração'}
                </button>
                <button onClick={testTypebotConnection} disabled={loading} className="px-6 py-3 bg-surface-light hover:bg-[#3a3a3a] text-white font-bold rounded-lg transition-all disabled:opacity-50 border border-border-dark">
                  {loading ? 'Testando...' : 'Testar Conexão'}
                </button>
              </div>
            </div>
          )}

          {/* N8N */}
          {activeTab === 'n8n' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-orange-500 text-2xl">account_tree</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">n8n</h3>
                    <p className="text-slate-400 text-sm">Integre com fluxos de automação do n8n</p>
                  </div>
                </div>
                <Toggle checked={n8n.enabled} onChange={(v) => setN8n({ ...n8n, enabled: v })} />
              </div>

              <div className="space-y-4">
                <Input label="Description" value={n8n.description} onChange={(v: string) => setN8n({ ...n8n, description: v })} placeholder="Descrição da integração" />

                <div className="border-t border-border-dark pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">n8n Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Input label="Webhook URL" value={n8n.webhookUrl} onChange={(v: string) => setN8n({ ...n8n, webhookUrl: v })} placeholder="https://n8n.seudominio.com/webhook/..." required />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border-dark pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Basic Auth (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Basic Auth User" value={n8n.basicAuthUser} onChange={(v: string) => setN8n({ ...n8n, basicAuthUser: v })} placeholder="Usuário" />
                    <Input label="Basic Auth Password" type="password" value={n8n.basicAuthPassword} onChange={(v: string) => setN8n({ ...n8n, basicAuthPassword: v })} placeholder="Senha" />
                  </div>
                </div>

                <div className="border-t border-border-dark pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Trigger Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select 
                      label="Trigger Type" 
                      value={n8n.triggerType} 
                      onChange={(v: string) => setN8n({ ...n8n, triggerType: v })}
                      options={[
                        { value: 'keyword', label: 'Keyword' },
                        { value: 'all', label: 'All' },
                        { value: 'advanced', label: 'Advanced' },
                        { value: 'none', label: 'None' },
                      ]}
                    />
                    {n8n.triggerType === 'keyword' && (
                      <>
                        <Select 
                          label="Trigger Operator" 
                          value={n8n.triggerOperator} 
                          onChange={(v: string) => setN8n({ ...n8n, triggerOperator: v })}
                          options={[
                            { value: 'contains', label: 'Contains' },
                            { value: 'equals', label: 'Equals' },
                            { value: 'startsWith', label: 'Starts With' },
                            { value: 'endsWith', label: 'Ends With' },
                            { value: 'regex', label: 'Regex' },
                          ]}
                        />
                        <Input label="Keyword/Trigger" value={n8n.keyword} onChange={(v: string) => setN8n({ ...n8n, keyword: v })} placeholder="Palavra-chave" />
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t border-border-dark pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">General Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Expire in minutes" type="number" value={n8n.expireMinutes} onChange={(v: string) => setN8n({ ...n8n, expireMinutes: parseInt(v) || 0 })} placeholder="0" />
                    <Input label="Keyword Finish" value={n8n.keywordFinish} onChange={(v: string) => setN8n({ ...n8n, keywordFinish: v })} placeholder="#sair" />
                    <Input label="Default Delay Message (ms)" type="number" value={n8n.delayMessage} onChange={(v: string) => setN8n({ ...n8n, delayMessage: parseInt(v) || 1000 })} placeholder="1000" />
                    <Input label="Unknown Message" value={n8n.unknownMessage} onChange={(v: string) => setN8n({ ...n8n, unknownMessage: v })} placeholder="Mensagem para comando desconhecido" />
                    <Input label="Debounce Time (s)" type="number" value={n8n.debounceTime} onChange={(v: string) => setN8n({ ...n8n, debounceTime: parseInt(v) || 10 })} placeholder="10" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    <div className="p-4 bg-surface-light rounded-lg">
                      <Toggle checked={n8n.listeningFromMe} onChange={(v) => setN8n({ ...n8n, listeningFromMe: v })} label="Listening from me" />
                    </div>
                    <div className="p-4 bg-surface-light rounded-lg">
                      <Toggle checked={n8n.stopBotFromMe} onChange={(v) => setN8n({ ...n8n, stopBotFromMe: v })} label="Stop bot from me" />
                    </div>
                    <div className="p-4 bg-surface-light rounded-lg">
                      <Toggle checked={n8n.keepOpen} onChange={(v) => setN8n({ ...n8n, keepOpen: v })} label="Keep open" />
                    </div>
                    <div className="p-4 bg-surface-light rounded-lg">
                      <Toggle checked={n8n.splitMessages} onChange={(v) => setN8n({ ...n8n, splitMessages: v })} label="Split Messages" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => saveIntegration('n8n')} disabled={loading} className="px-6 py-3 bg-primary hover:bg-primary-hover text-black font-bold rounded-lg transition-all disabled:opacity-50">
                  {loading ? 'Salvando...' : 'Salvar Configuração'}
                </button>
                <button onClick={testN8nConnection} disabled={loading} className="px-6 py-3 bg-surface-light hover:bg-[#3a3a3a] text-white font-bold rounded-lg transition-all disabled:opacity-50 border border-border-dark">
                  {loading ? 'Testando...' : 'Testar Conexão'}
                </button>
              </div>
            </div>
          )}

          {/* CHATWOOT */}
          {activeTab === 'chatwoot' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-purple-500 text-2xl">support_agent</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Chatwoot</h3>
                    <p className="text-slate-400 text-sm">Sincronize conversas com o Chatwoot</p>
                  </div>
                </div>
                <Toggle checked={chatwoot.enabled} onChange={(v) => setChatwoot({ ...chatwoot, enabled: v })} />
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-surface-light rounded-lg mb-4">
                  <Toggle checked={chatwoot.sqs} onChange={(v) => setChatwoot({ ...chatwoot, sqs: v })} label="SQS" />
                  <p className="text-xs text-slate-500 mt-1">Usar Amazon SQS para filas</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Chatwoot URL" value={chatwoot.url} onChange={(v: string) => setChatwoot({ ...chatwoot, url: v })} placeholder="https://app.chatwoot.com" required />
                  <Input label="Account ID" value={chatwoot.accountId} onChange={(v: string) => setChatwoot({ ...chatwoot, accountId: v })} placeholder="1" required />
                  <Input label="Token" type="password" value={chatwoot.token} onChange={(v: string) => setChatwoot({ ...chatwoot, token: v })} placeholder="Seu token de acesso" required />
                  <Input label="Name Inbox" value={chatwoot.nameInbox} onChange={(v: string) => setChatwoot({ ...chatwoot, nameInbox: v })} placeholder="Nome da inbox" />
                  <Input label="Organization" value={chatwoot.organization} onChange={(v: string) => setChatwoot({ ...chatwoot, organization: v })} placeholder="Nome da organização" />
                  <Input label="Logo URL" value={chatwoot.logo} onChange={(v: string) => setChatwoot({ ...chatwoot, logo: v })} placeholder="https://..." />
                  <Input label="Sign Delimiter" value={chatwoot.signDelimiter} onChange={(v: string) => setChatwoot({ ...chatwoot, signDelimiter: v })} placeholder="\n" />
                  <Input label="Days Limit Import Messages" type="number" value={chatwoot.daysLimitImport} onChange={(v: string) => setChatwoot({ ...chatwoot, daysLimitImport: parseInt(v) || 3 })} placeholder="3" />
                  <div className="md:col-span-2">
                    <Input label="Ignore JIDs (separados por vírgula)" value={chatwoot.ignoreJids} onChange={(v: string) => setChatwoot({ ...chatwoot, ignoreJids: v })} placeholder="5511999999999@s.whatsapp.net" />
                  </div>
                </div>

                <div className="border-t border-border-dark pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Opções</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 bg-surface-light rounded-lg">
                      <Toggle checked={chatwoot.signMessages} onChange={(v) => setChatwoot({ ...chatwoot, signMessages: v })} label="Sign Messages" />
                      <p className="text-xs text-slate-500 mt-1">Assinar mensagem com usuário</p>
                    </div>
                    <div className="p-4 bg-surface-light rounded-lg">
                      <Toggle checked={chatwoot.conversationPending} onChange={(v) => setChatwoot({ ...chatwoot, conversationPending: v })} label="Conversation Pending" />
                      <p className="text-xs text-slate-500 mt-1">Conversas iniciam como pendentes</p>
                    </div>
                    <div className="p-4 bg-surface-light rounded-lg">
                      <Toggle checked={chatwoot.reopenConversation} onChange={(v) => setChatwoot({ ...chatwoot, reopenConversation: v })} label="Reopen Conversation" />
                      <p className="text-xs text-slate-500 mt-1">Reabrir ao receber mensagem</p>
                    </div>
                    <div className="p-4 bg-surface-light rounded-lg">
                      <Toggle checked={chatwoot.importContacts} onChange={(v) => setChatwoot({ ...chatwoot, importContacts: v })} label="Import Contacts" />
                      <p className="text-xs text-slate-500 mt-1">Importar contatos do WhatsApp</p>
                    </div>
                    <div className="p-4 bg-surface-light rounded-lg">
                      <Toggle checked={chatwoot.importMessages} onChange={(v) => setChatwoot({ ...chatwoot, importMessages: v })} label="Import Messages" />
                      <p className="text-xs text-slate-500 mt-1">Importar mensagens do WhatsApp</p>
                    </div>
                    <div className="p-4 bg-surface-light rounded-lg">
                      <Toggle checked={chatwoot.autoCreate} onChange={(v) => setChatwoot({ ...chatwoot, autoCreate: v })} label="Auto Create" />
                      <p className="text-xs text-slate-500 mt-1">Criar integração automaticamente</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => saveIntegration('chatwoot')} disabled={loading} className="px-6 py-3 bg-primary hover:bg-primary-hover text-black font-bold rounded-lg transition-all disabled:opacity-50">
                  {loading ? 'Salvando...' : 'Salvar Configuração'}
                </button>
                <button onClick={testChatwootConnection} disabled={loading} className="px-6 py-3 bg-surface-light hover:bg-[#3a3a3a] text-white font-bold rounded-lg transition-all disabled:opacity-50 border border-border-dark">
                  {loading ? 'Testando...' : 'Testar Conexão'}
                </button>
              </div>
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
