import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import Swal from 'sweetalert2';

// Types
interface Instance {
  id: string;
  name: string;
  phone: string | null;
  profilePic: string | null;
  profileName: string | null;
  status: string;
}

interface InstanceSettings {
  rejectCalls: boolean;
  ignoreGroups: boolean;
  alwaysOnline: boolean;
  readMessages: boolean;
  syncFullHistory: boolean;
  readStatus: boolean;
}

interface ProxySettings {
  enabled: boolean;
  protocol: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

interface WebhookSettings {
  enabled: boolean;
  url: string;
  events: string[];
}

interface WebSocketSettings {
  enabled: boolean;
  events: string[];
}

interface RabbitMQSettings {
  enabled: boolean;
  uri: string;
  exchange: string;
  events: string[];
}

interface SQSSettings {
  enabled: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  queueUrl: string;
  events: string[];
}

interface TypebotSettings {
  enabled: boolean;
  apiUrl: string;
  publicName: string;
  triggerType: string;
  triggerOperator: string;
  keyword: string;
  expireMinutes: number;
  keywordFinish: string;
  delayMessage: number;
  unknownMessage: string;
  listeningFromMe: boolean;
  stopBotFromMe: boolean;
  keepOpen: boolean;
  debounceTime: number;
}

interface N8nSettings {
  enabled: boolean;
  webhookUrl: string;
  basicAuthUser: string;
  basicAuthPassword: string;
  triggerType: string;
  triggerOperator: string;
  keyword: string;
  expireMinutes: number;
  keywordFinish: string;
  delayMessage: number;
  unknownMessage: string;
  listeningFromMe: boolean;
  stopBotFromMe: boolean;
  keepOpen: boolean;
  debounceTime: number;
  splitMessages: boolean;
}

interface ChatwootSettings {
  enabled: boolean;
  url: string;
  accountId: string;
  token: string;
  signMessages: boolean;
  signDelimiter: string;
  nameInbox: string;
  organization: string;
  logo: string;
  conversationPending: boolean;
  reopenConversation: boolean;
  importContacts: boolean;
  importMessages: boolean;
  daysLimitImport: number;
  ignoreJids: string;
  autoCreate: boolean;
}

const AVAILABLE_EVENTS = [
  'APPLICATION_STARTUP', 'CALL', 'CHATS_DELETE', 'CHATS_SET', 'CHATS_UPDATE', 'CHATS_UPSERT',
  'CONNECTION_UPDATE', 'CONTACTS_SET', 'CONTACTS_UPDATE', 'CONTACTS_UPSERT',
  'GROUP_PARTICIPANTS_UPDATE', 'GROUP_UPDATE', 'GROUPS_UPSERT', 'LABELS_ASSOCIATION',
  'LABELS_EDIT', 'LOGOUT_INSTANCE', 'MESSAGES_DELETE', 'MESSAGES_SET', 'MESSAGES_UPDATE',
  'MESSAGES_UPSERT', 'PRESENCE_UPDATE', 'QRCODE_UPDATED', 'REMOVE_INSTANCE', 'SEND_MESSAGE',
  'TYPEBOT_CHANGE_STATUS', 'TYPEBOT_START',
];

// Toggle Component
const Toggle = ({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-surface-light'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

// Input Component
const Input = ({ label, value, onChange, placeholder, type = 'text', required = false, disabled = false }: any) => (
  <div>
    <label className="block text-sm font-medium text-slate-300 mb-2">
      {label}{required && <span className="text-primary ml-1">*</span>}
    </label>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-border-dark rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm disabled:opacity-50"
    />
  </div>
);

// Select Component
const Select = ({ label, value, onChange, options, disabled = false }: any) => (
  <div>
    <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full h-11 px-4 bg-[#1a1a1a] text-white border border-border-dark rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm disabled:opacity-50"
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// Events Selector Component
const EventsSelector = ({ events, selectedEvents, onChange }: { events: string[]; selectedEvents: string[]; onChange: (events: string[]) => void }) => {
  const toggleEvent = (event: string) => {
    onChange(selectedEvents.includes(event) ? selectedEvents.filter(e => e !== event) : [...selectedEvents, event]);
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-300">Events</span>
        <div className="flex gap-2">
          <button onClick={() => onChange([...events])} className="text-xs text-primary hover:text-primary-hover transition-colors">Mark All</button>
          <span className="text-slate-600">|</span>
          <button onClick={() => onChange([])} className="text-xs text-slate-400 hover:text-white transition-colors">Unmark All</button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1">
        {events.map(event => (
          <button
            key={event}
            onClick={() => toggleEvent(event)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-left truncate ${
              selectedEvents.includes(event)
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-surface-light text-slate-400 hover:text-white border border-transparent'
            }`}
            title={event}
          >
            {event}
          </button>
        ))}
      </div>
    </div>
  );
};

// Sidebar Menu Items
const menuItems = [
  { id: 'instance', label: 'Instância', icon: 'smartphone', children: [
    { id: 'behavior', label: 'Comportamento', icon: 'tune' },
    { id: 'proxy', label: 'Proxy', icon: 'vpn_key' },
  ]},
  { id: 'events', label: 'Events', icon: 'bolt', children: [
    { id: 'webhook', label: 'Webhook', icon: 'webhook' },
    { id: 'websocket', label: 'WebSocket', icon: 'sync_alt' },
    { id: 'rabbitmq', label: 'RabbitMQ', icon: 'hub' },
    { id: 'sqs', label: 'SQS', icon: 'cloud_queue' },
  ]},
  { id: 'integrations', label: 'Integrations', icon: 'extension', children: [
    { id: 'n8n', label: 'N8N', icon: 'account_tree' },
    { id: 'typebot', label: 'Typebot', icon: 'smart_toy' },
    { id: 'chatwoot', label: 'Chatwoot', icon: 'support_agent' },
  ]},
];

export default function InstanceSettingsPage() {
  const router = useRouter();
  const { instanceId } = router.query;
  
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('behavior');
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['instance', 'events', 'integrations']);

  // Settings States
  const [instanceSettings, setInstanceSettings] = useState<InstanceSettings>({
    rejectCalls: false, ignoreGroups: false, alwaysOnline: false,
    readMessages: false, syncFullHistory: false, readStatus: false,
  });

  const [proxySettings, setProxySettings] = useState<ProxySettings>({
    enabled: false, protocol: 'http', host: '', port: 0, username: '', password: '',
  });

  const [webhookSettings, setWebhookSettings] = useState<WebhookSettings>({
    enabled: false, url: '', events: [],
  });

  const [websocketSettings, setWebsocketSettings] = useState<WebSocketSettings>({
    enabled: false, events: [],
  });

  const [rabbitmqSettings, setRabbitmqSettings] = useState<RabbitMQSettings>({
    enabled: false, uri: '', exchange: '', events: [],
  });

  const [sqsSettings, setSqsSettings] = useState<SQSSettings>({
    enabled: false, accessKeyId: '', secretAccessKey: '', region: '', queueUrl: '', events: [],
  });

  const [typebotSettings, setTypebotSettings] = useState<TypebotSettings>({
    enabled: false, apiUrl: '', publicName: '', triggerType: 'keyword', triggerOperator: 'contains',
    keyword: '', expireMinutes: 0, keywordFinish: '', delayMessage: 1000, unknownMessage: '',
    listeningFromMe: false, stopBotFromMe: false, keepOpen: false, debounceTime: 10,
  });

  const [n8nSettings, setN8nSettings] = useState<N8nSettings>({
    enabled: false, webhookUrl: '', basicAuthUser: '', basicAuthPassword: '', triggerType: 'keyword',
    triggerOperator: 'contains', keyword: '', expireMinutes: 0, keywordFinish: '', delayMessage: 1000,
    unknownMessage: '', listeningFromMe: false, stopBotFromMe: false, keepOpen: false, debounceTime: 10, splitMessages: false,
  });

  const [chatwootSettings, setChatwootSettings] = useState<ChatwootSettings>({
    enabled: false, url: '', accountId: '', token: '', signMessages: false, signDelimiter: '\\n',
    nameInbox: '', organization: '', logo: '', conversationPending: false, reopenConversation: true,
    importContacts: false, importMessages: false, daysLimitImport: 3, ignoreJids: '', autoCreate: true,
  });

  useEffect(() => {
    if (!instanceId) return;
    loadData();
  }, [instanceId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [instanceRes, settingsRes] = await Promise.all([
        api.get(`/instances/${instanceId}`),
        api.get(`/instances/${instanceId}/settings`),
      ]);
      setInstance(instanceRes.data);
      const s = settingsRes.data;
      setInstanceSettings({ rejectCalls: s.rejectCalls || false, ignoreGroups: s.ignoreGroups || false, alwaysOnline: s.alwaysOnline || false, readMessages: s.readMessages || false, syncFullHistory: s.syncFullHistory || false, readStatus: s.readStatus || false });
      if (s.proxy) setProxySettings(s.proxy);
      if (s.webhook) setWebhookSettings(s.webhook);
      if (s.websocket) setWebsocketSettings(s.websocket);
      if (s.rabbitmq) setRabbitmqSettings(s.rabbitmq);
      if (s.sqs) setSqsSettings(s.sqs);
      if (s.typebot) setTypebotSettings(prev => ({ ...prev, ...s.typebot }));
      if (s.n8n) setN8nSettings(prev => ({ ...prev, ...s.n8n }));
      if (s.chatwoot) setChatwootSettings(prev => ({ ...prev, ...s.chatwoot }));
    } catch (error) {
      console.error('Error loading settings:', error);
    }
    setLoading(false);
  };

  const saveSection = async (section: string, data: any) => {
    if (!instanceId) return;
    setSaving(section);
    try {
      await api.put(`/instances/${instanceId}/settings`, data);
      Swal.fire({
        icon: 'success',
        title: 'Salvo!',
        text: 'Configurações salvas com sucesso.',
        background: '#1a1a1a',
        color: '#fff',
        confirmButtonColor: '#22c55e',
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('Error saving:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erro!',
        text: 'Não foi possível salvar as configurações.',
        background: '#1a1a1a',
        color: '#fff',
        confirmButtonColor: '#ef4444',
      });
    }
    setSaving(null);
  };

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => prev.includes(menuId) ? prev.filter(id => id !== menuId) : [...prev, menuId]);
  };

  const behaviorOptions = [
    { key: 'rejectCalls', label: 'Reject Calls', desc: 'Reject all incoming calls', icon: 'call_end' },
    { key: 'ignoreGroups', label: 'Ignore Groups', desc: 'Ignore all messages from groups', icon: 'group_off' },
    { key: 'alwaysOnline', label: 'Always Online', desc: 'Keep the whatsapp always online', icon: 'wifi' },
    { key: 'readMessages', label: 'Read Messages', desc: 'Mark all messages as read', icon: 'mark_chat_read' },
    { key: 'syncFullHistory', label: 'Sync Full History', desc: 'Sync all complete chat history on scan QR code', icon: 'history' },
    { key: 'readStatus', label: 'Read Status', desc: 'Mark all statuses as read', icon: 'visibility' },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/instances" className="p-2 rounded-xl bg-surface-dark border border-border-dark hover:border-primary/30 text-slate-400 hover:text-white transition-all">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="flex items-center gap-3">
            {instance?.profilePic ? (
              <img src={instance.profilePic} alt="Profile" className="w-12 h-12 rounded-full object-cover border-2 border-border-dark" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-surface-light flex items-center justify-center border-2 border-border-dark">
                <span className="material-symbols-outlined text-slate-500">person</span>
              </div>
            )}
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">{instance?.name || 'Configurações'}</h2>
              <p className="text-slate-400 text-sm">Configurações da Instância</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-border-dark bg-surface-dark p-4 space-y-2">
            {menuItems.map(menu => (
              <div key={menu.id}>
                <button
                  onClick={() => toggleMenu(menu.id)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-surface-light hover:text-white transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-500">{menu.icon}</span>
                    {menu.label}
                  </div>
                  <span className={`material-symbols-outlined text-slate-500 transition-transform ${expandedMenus.includes(menu.id) ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {expandedMenus.includes(menu.id) && (
                  <div className="ml-4 mt-1 space-y-1">
                    {menu.children.map(child => (
                      <button
                        key={child.id}
                        onClick={() => setActiveSection(child.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          activeSection === child.id
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'text-slate-400 hover:bg-surface-light hover:text-white'
                        }`}
                      >
                        <span className={`material-symbols-outlined text-[18px] ${activeSection === child.id ? 'text-primary' : 'text-slate-500'}`}>{child.icon}</span>
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Behavior Section */}
          {activeSection === 'behavior' && (
            <div className="rounded-2xl border border-border-dark bg-surface-dark">
              <div className="p-6 border-b border-border-dark flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-2xl">tune</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Comportamento</h3>
                    <p className="text-slate-400 text-sm">Configure o comportamento automático</p>
                  </div>
                </div>
                <button
                  onClick={() => saveSection('behavior', instanceSettings)}
                  disabled={saving === 'behavior'}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[20px]">{saving === 'behavior' ? 'sync' : 'save'}</span>
                  {saving === 'behavior' ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              <div className="p-6 space-y-2">
                {behaviorOptions.map(option => (
                  <div key={option.key} className="flex items-center justify-between p-4 hover:bg-surface-light/50 rounded-xl transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-slate-500 mt-0.5">{option.icon}</span>
                      <div>
                        <p className="text-white font-medium text-sm">{option.label}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{option.desc}</p>
                      </div>
                    </div>
                    <Toggle checked={instanceSettings[option.key as keyof InstanceSettings]} onChange={(v) => setInstanceSettings(prev => ({ ...prev, [option.key]: v }))} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proxy Section */}
          {activeSection === 'proxy' && (
            <div className="rounded-2xl border border-border-dark bg-surface-dark">
              <div className="p-6 border-b border-border-dark flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-500 text-2xl">vpn_key</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Proxy</h3>
                    <p className="text-slate-400 text-sm">Configure um proxy para a conexão</p>
                  </div>
                </div>
                <button onClick={() => saveSection('proxy', { proxy: proxySettings })} disabled={saving === 'proxy'} className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-all disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px]">{saving === 'proxy' ? 'sync' : 'save'}</span>
                  {saving === 'proxy' ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-dark">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">power_settings_new</span>
                    <span className="text-white font-semibold">Ativar Proxy</span>
                  </div>
                  <Toggle checked={proxySettings.enabled} onChange={(v) => setProxySettings(prev => ({ ...prev, enabled: v }))} />
                </div>
                <div className={`space-y-4 ${!proxySettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Select label="Protocol" value={proxySettings.protocol} onChange={(v: string) => setProxySettings(prev => ({ ...prev, protocol: v }))} options={[{ value: 'http', label: 'HTTP' }, { value: 'https', label: 'HTTPS' }, { value: 'socks4', label: 'SOCKS4' }, { value: 'socks5', label: 'SOCKS5' }]} disabled={!proxySettings.enabled} />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2"><Input label="Host" value={proxySettings.host} onChange={(v: string) => setProxySettings(prev => ({ ...prev, host: v }))} placeholder="proxy.example.com" disabled={!proxySettings.enabled} /></div>
                    <Input label="Port" type="number" value={proxySettings.port || ''} onChange={(v: string) => setProxySettings(prev => ({ ...prev, port: parseInt(v) || 0 }))} placeholder="8080" disabled={!proxySettings.enabled} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Username" value={proxySettings.username} onChange={(v: string) => setProxySettings(prev => ({ ...prev, username: v }))} placeholder="Opcional" disabled={!proxySettings.enabled} />
                    <Input label="Password" type="password" value={proxySettings.password} onChange={(v: string) => setProxySettings(prev => ({ ...prev, password: v }))} placeholder="Opcional" disabled={!proxySettings.enabled} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Webhook Section */}
          {activeSection === 'webhook' && (
            <div className="rounded-2xl border border-border-dark bg-surface-dark">
              <div className="p-6 border-b border-border-dark flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-green-500 text-2xl">webhook</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Webhook</h3>
                    <p className="text-slate-400 text-sm">Receba eventos via HTTP POST</p>
                  </div>
                </div>
                <button onClick={() => saveSection('webhook', { webhook: webhookSettings })} disabled={saving === 'webhook'} className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-all disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px]">{saving === 'webhook' ? 'sync' : 'save'}</span>
                  {saving === 'webhook' ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-dark">
                  <div><span className="text-white font-semibold">Enabled</span><p className="text-xs text-slate-500">Enable or disable the webhook</p></div>
                  <Toggle checked={webhookSettings.enabled} onChange={(v) => setWebhookSettings(prev => ({ ...prev, enabled: v }))} />
                </div>
                <div className={`space-y-4 ${!webhookSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Input label="Webhook URL" value={webhookSettings.url} onChange={(v: string) => setWebhookSettings(prev => ({ ...prev, url: v }))} placeholder="https://your-server.com/webhook" required disabled={!webhookSettings.enabled} />
                  <EventsSelector events={AVAILABLE_EVENTS} selectedEvents={webhookSettings.events} onChange={(events) => setWebhookSettings(prev => ({ ...prev, events }))} />
                </div>
              </div>
            </div>
          )}

          {/* WebSocket Section */}
          {activeSection === 'websocket' && (
            <div className="rounded-2xl border border-border-dark bg-surface-dark">
              <div className="p-6 border-b border-border-dark flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-purple-500 text-2xl">sync_alt</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">WebSocket</h3>
                    <p className="text-slate-400 text-sm">Receba eventos em tempo real via WebSocket</p>
                  </div>
                </div>
                <button onClick={() => saveSection('websocket', { websocket: websocketSettings })} disabled={saving === 'websocket'} className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-all disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px]">{saving === 'websocket' ? 'sync' : 'save'}</span>
                  {saving === 'websocket' ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-dark">
                  <div><span className="text-white font-semibold">Enabled</span><p className="text-xs text-slate-500">Enable or disable the websocket</p></div>
                  <Toggle checked={websocketSettings.enabled} onChange={(v) => setWebsocketSettings(prev => ({ ...prev, enabled: v }))} />
                </div>
                <div className={`${!websocketSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <EventsSelector events={AVAILABLE_EVENTS} selectedEvents={websocketSettings.events} onChange={(events) => setWebsocketSettings(prev => ({ ...prev, events }))} />
                </div>
              </div>
            </div>
          )}

          {/* RabbitMQ Section */}
          {activeSection === 'rabbitmq' && (
            <div className="rounded-2xl border border-border-dark bg-surface-dark">
              <div className="p-6 border-b border-border-dark flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-orange-500 text-2xl">hub</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">RabbitMQ</h3>
                    <p className="text-slate-400 text-sm">Envie eventos para filas RabbitMQ</p>
                  </div>
                </div>
                <button onClick={() => saveSection('rabbitmq', { rabbitmq: rabbitmqSettings })} disabled={saving === 'rabbitmq'} className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-all disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px]">{saving === 'rabbitmq' ? 'sync' : 'save'}</span>
                  {saving === 'rabbitmq' ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-dark">
                  <div><span className="text-white font-semibold">Enabled</span><p className="text-xs text-slate-500">Enable or disable RabbitMQ</p></div>
                  <Toggle checked={rabbitmqSettings.enabled} onChange={(v) => setRabbitmqSettings(prev => ({ ...prev, enabled: v }))} />
                </div>
                <div className={`space-y-4 ${!rabbitmqSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Input label="RabbitMQ URI" value={rabbitmqSettings.uri} onChange={(v: string) => setRabbitmqSettings(prev => ({ ...prev, uri: v }))} placeholder="amqp://user:pass@localhost:5672" required disabled={!rabbitmqSettings.enabled} />
                  <Input label="Exchange Name" value={rabbitmqSettings.exchange} onChange={(v: string) => setRabbitmqSettings(prev => ({ ...prev, exchange: v }))} placeholder="whatsapp_events" disabled={!rabbitmqSettings.enabled} />
                  <EventsSelector events={AVAILABLE_EVENTS} selectedEvents={rabbitmqSettings.events} onChange={(events) => setRabbitmqSettings(prev => ({ ...prev, events }))} />
                </div>
              </div>
            </div>
          )}

          {/* SQS Section */}
          {activeSection === 'sqs' && (
            <div className="rounded-2xl border border-border-dark bg-surface-dark">
              <div className="p-6 border-b border-border-dark flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-yellow-500 text-2xl">cloud_queue</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Amazon SQS</h3>
                    <p className="text-slate-400 text-sm">Envie eventos para filas Amazon SQS</p>
                  </div>
                </div>
                <button onClick={() => saveSection('sqs', { sqs: sqsSettings })} disabled={saving === 'sqs'} className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-all disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px]">{saving === 'sqs' ? 'sync' : 'save'}</span>
                  {saving === 'sqs' ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-dark">
                  <div><span className="text-white font-semibold">Enabled</span><p className="text-xs text-slate-500">Enable or disable SQS</p></div>
                  <Toggle checked={sqsSettings.enabled} onChange={(v) => setSqsSettings(prev => ({ ...prev, enabled: v }))} />
                </div>
                <div className={`space-y-4 ${!sqsSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Access Key ID" value={sqsSettings.accessKeyId} onChange={(v: string) => setSqsSettings(prev => ({ ...prev, accessKeyId: v }))} placeholder="AKIAIOSFODNN7EXAMPLE" required disabled={!sqsSettings.enabled} />
                    <Input label="Secret Access Key" type="password" value={sqsSettings.secretAccessKey} onChange={(v: string) => setSqsSettings(prev => ({ ...prev, secretAccessKey: v }))} placeholder="wJalrXUtnFEMI/K7MDENG..." required disabled={!sqsSettings.enabled} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Region" value={sqsSettings.region} onChange={(v: string) => setSqsSettings(prev => ({ ...prev, region: v }))} placeholder="us-east-1" required disabled={!sqsSettings.enabled} />
                    <Input label="Queue URL" value={sqsSettings.queueUrl} onChange={(v: string) => setSqsSettings(prev => ({ ...prev, queueUrl: v }))} placeholder="https://sqs.us-east-1.amazonaws.com/..." required disabled={!sqsSettings.enabled} />
                  </div>
                  <EventsSelector events={AVAILABLE_EVENTS} selectedEvents={sqsSettings.events} onChange={(events) => setSqsSettings(prev => ({ ...prev, events }))} />
                </div>
              </div>
            </div>
          )}

          {/* N8N Section */}
          {activeSection === 'n8n' && (
            <div className="rounded-2xl border border-border-dark bg-surface-dark">
              <div className="p-6 border-b border-border-dark flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-orange-500 text-2xl">account_tree</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">N8N</h3>
                    <p className="text-slate-400 text-sm">Integre com fluxos de automação</p>
                  </div>
                </div>
                <button onClick={() => saveSection('n8n', { n8n: n8nSettings })} disabled={saving === 'n8n'} className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-all disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px]">{saving === 'n8n' ? 'sync' : 'save'}</span>
                  {saving === 'n8n' ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-dark">
                  <div><span className="text-white font-semibold">Enabled</span><p className="text-xs text-slate-500">Enable or disable n8n integration</p></div>
                  <Toggle checked={n8nSettings.enabled} onChange={(v) => setN8nSettings(prev => ({ ...prev, enabled: v }))} />
                </div>
                <div className={`space-y-4 ${!n8nSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Input label="Webhook URL" value={n8nSettings.webhookUrl} onChange={(v: string) => setN8nSettings(prev => ({ ...prev, webhookUrl: v }))} placeholder="https://n8n.seudominio.com/webhook/..." required disabled={!n8nSettings.enabled} />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Basic Auth User" value={n8nSettings.basicAuthUser} onChange={(v: string) => setN8nSettings(prev => ({ ...prev, basicAuthUser: v }))} placeholder="Opcional" disabled={!n8nSettings.enabled} />
                    <Input label="Basic Auth Password" type="password" value={n8nSettings.basicAuthPassword} onChange={(v: string) => setN8nSettings(prev => ({ ...prev, basicAuthPassword: v }))} placeholder="Opcional" disabled={!n8nSettings.enabled} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Select label="Trigger Type" value={n8nSettings.triggerType} onChange={(v: string) => setN8nSettings(prev => ({ ...prev, triggerType: v }))} options={[{ value: 'keyword', label: 'Keyword' }, { value: 'all', label: 'All' }, { value: 'none', label: 'None' }]} disabled={!n8nSettings.enabled} />
                    {n8nSettings.triggerType === 'keyword' && <Input label="Keyword" value={n8nSettings.keyword} onChange={(v: string) => setN8nSettings(prev => ({ ...prev, keyword: v }))} placeholder="Palavra-chave" disabled={!n8nSettings.enabled} />}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Input label="Expire (min)" type="number" value={n8nSettings.expireMinutes} onChange={(v: string) => setN8nSettings(prev => ({ ...prev, expireMinutes: parseInt(v) || 0 }))} placeholder="0" disabled={!n8nSettings.enabled} />
                    <Input label="Delay (ms)" type="number" value={n8nSettings.delayMessage} onChange={(v: string) => setN8nSettings(prev => ({ ...prev, delayMessage: parseInt(v) || 1000 }))} placeholder="1000" disabled={!n8nSettings.enabled} />
                    <Input label="Debounce (s)" type="number" value={n8nSettings.debounceTime} onChange={(v: string) => setN8nSettings(prev => ({ ...prev, debounceTime: parseInt(v) || 10 }))} placeholder="10" disabled={!n8nSettings.enabled} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-surface-light rounded-lg flex items-center justify-between"><span className="text-xs text-slate-300">Listening from me</span><Toggle checked={n8nSettings.listeningFromMe} onChange={(v) => setN8nSettings(prev => ({ ...prev, listeningFromMe: v }))} disabled={!n8nSettings.enabled} /></div>
                    <div className="p-3 bg-surface-light rounded-lg flex items-center justify-between"><span className="text-xs text-slate-300">Stop bot from me</span><Toggle checked={n8nSettings.stopBotFromMe} onChange={(v) => setN8nSettings(prev => ({ ...prev, stopBotFromMe: v }))} disabled={!n8nSettings.enabled} /></div>
                    <div className="p-3 bg-surface-light rounded-lg flex items-center justify-between"><span className="text-xs text-slate-300">Keep open</span><Toggle checked={n8nSettings.keepOpen} onChange={(v) => setN8nSettings(prev => ({ ...prev, keepOpen: v }))} disabled={!n8nSettings.enabled} /></div>
                    <div className="p-3 bg-surface-light rounded-lg flex items-center justify-between"><span className="text-xs text-slate-300">Split Messages</span><Toggle checked={n8nSettings.splitMessages} onChange={(v) => setN8nSettings(prev => ({ ...prev, splitMessages: v }))} disabled={!n8nSettings.enabled} /></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Typebot Section */}
          {activeSection === 'typebot' && (
            <div className="rounded-2xl border border-border-dark bg-surface-dark">
              <div className="p-6 border-b border-border-dark flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-500 text-2xl">smart_toy</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Typebot</h3>
                    <p className="text-slate-400 text-sm">Conecte com chatbots do Typebot</p>
                  </div>
                </div>
                <button onClick={() => saveSection('typebot', { typebot: typebotSettings })} disabled={saving === 'typebot'} className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-all disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px]">{saving === 'typebot' ? 'sync' : 'save'}</span>
                  {saving === 'typebot' ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-dark">
                  <div><span className="text-white font-semibold">Enabled</span><p className="text-xs text-slate-500">Enable or disable Typebot</p></div>
                  <Toggle checked={typebotSettings.enabled} onChange={(v) => setTypebotSettings(prev => ({ ...prev, enabled: v }))} />
                </div>
                <div className={`space-y-4 ${!typebotSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Typebot API URL" value={typebotSettings.apiUrl} onChange={(v: string) => setTypebotSettings(prev => ({ ...prev, apiUrl: v }))} placeholder="https://typebot.io/api/v1/..." required disabled={!typebotSettings.enabled} />
                    <Input label="Public Name" value={typebotSettings.publicName} onChange={(v: string) => setTypebotSettings(prev => ({ ...prev, publicName: v }))} placeholder="Nome público" disabled={!typebotSettings.enabled} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Select label="Trigger Type" value={typebotSettings.triggerType} onChange={(v: string) => setTypebotSettings(prev => ({ ...prev, triggerType: v }))} options={[{ value: 'keyword', label: 'Keyword' }, { value: 'all', label: 'All' }, { value: 'none', label: 'None' }]} disabled={!typebotSettings.enabled} />
                    {typebotSettings.triggerType === 'keyword' && <Input label="Keyword" value={typebotSettings.keyword} onChange={(v: string) => setTypebotSettings(prev => ({ ...prev, keyword: v }))} placeholder="Palavra-chave" disabled={!typebotSettings.enabled} />}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Input label="Expire (min)" type="number" value={typebotSettings.expireMinutes} onChange={(v: string) => setTypebotSettings(prev => ({ ...prev, expireMinutes: parseInt(v) || 0 }))} placeholder="0" disabled={!typebotSettings.enabled} />
                    <Input label="Delay (ms)" type="number" value={typebotSettings.delayMessage} onChange={(v: string) => setTypebotSettings(prev => ({ ...prev, delayMessage: parseInt(v) || 1000 }))} placeholder="1000" disabled={!typebotSettings.enabled} />
                    <Input label="Debounce (s)" type="number" value={typebotSettings.debounceTime} onChange={(v: string) => setTypebotSettings(prev => ({ ...prev, debounceTime: parseInt(v) || 10 }))} placeholder="10" disabled={!typebotSettings.enabled} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-surface-light rounded-lg flex items-center justify-between"><span className="text-xs text-slate-300">Listening from me</span><Toggle checked={typebotSettings.listeningFromMe} onChange={(v) => setTypebotSettings(prev => ({ ...prev, listeningFromMe: v }))} disabled={!typebotSettings.enabled} /></div>
                    <div className="p-3 bg-surface-light rounded-lg flex items-center justify-between"><span className="text-xs text-slate-300">Stop bot from me</span><Toggle checked={typebotSettings.stopBotFromMe} onChange={(v) => setTypebotSettings(prev => ({ ...prev, stopBotFromMe: v }))} disabled={!typebotSettings.enabled} /></div>
                    <div className="p-3 bg-surface-light rounded-lg flex items-center justify-between"><span className="text-xs text-slate-300">Keep open</span><Toggle checked={typebotSettings.keepOpen} onChange={(v) => setTypebotSettings(prev => ({ ...prev, keepOpen: v }))} disabled={!typebotSettings.enabled} /></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chatwoot Section */}
          {activeSection === 'chatwoot' && (
            <div className="rounded-2xl border border-border-dark bg-surface-dark">
              <div className="p-6 border-b border-border-dark flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-purple-500 text-2xl">support_agent</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Chatwoot</h3>
                    <p className="text-slate-400 text-sm">Sincronize conversas com o Chatwoot</p>
                  </div>
                </div>
                <button onClick={() => saveSection('chatwoot', { chatwoot: chatwootSettings })} disabled={saving === 'chatwoot'} className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-all disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px]">{saving === 'chatwoot' ? 'sync' : 'save'}</span>
                  {saving === 'chatwoot' ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-dark">
                  <div><span className="text-white font-semibold">Enabled</span><p className="text-xs text-slate-500">Enable or disable Chatwoot</p></div>
                  <Toggle checked={chatwootSettings.enabled} onChange={(v) => setChatwootSettings(prev => ({ ...prev, enabled: v }))} />
                </div>
                <div className={`space-y-4 ${!chatwootSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Chatwoot URL" value={chatwootSettings.url} onChange={(v: string) => setChatwootSettings(prev => ({ ...prev, url: v }))} placeholder="https://app.chatwoot.com" required disabled={!chatwootSettings.enabled} />
                    <Input label="Account ID" value={chatwootSettings.accountId} onChange={(v: string) => setChatwootSettings(prev => ({ ...prev, accountId: v }))} placeholder="1" required disabled={!chatwootSettings.enabled} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Token" type="password" value={chatwootSettings.token} onChange={(v: string) => setChatwootSettings(prev => ({ ...prev, token: v }))} placeholder="Seu token de acesso" required disabled={!chatwootSettings.enabled} />
                    <Input label="Name Inbox" value={chatwootSettings.nameInbox} onChange={(v: string) => setChatwootSettings(prev => ({ ...prev, nameInbox: v }))} placeholder="Nome da inbox" disabled={!chatwootSettings.enabled} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Organization" value={chatwootSettings.organization} onChange={(v: string) => setChatwootSettings(prev => ({ ...prev, organization: v }))} placeholder="Nome da organização" disabled={!chatwootSettings.enabled} />
                    <Input label="Logo URL" value={chatwootSettings.logo} onChange={(v: string) => setChatwootSettings(prev => ({ ...prev, logo: v }))} placeholder="https://..." disabled={!chatwootSettings.enabled} />
                  </div>
                  <Input label="Ignore JIDs (separados por vírgula)" value={chatwootSettings.ignoreJids} onChange={(v: string) => setChatwootSettings(prev => ({ ...prev, ignoreJids: v }))} placeholder="5511999999999@s.whatsapp.net" disabled={!chatwootSettings.enabled} />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-surface-light rounded-lg flex items-center justify-between"><span className="text-xs text-slate-300">Sign Messages</span><Toggle checked={chatwootSettings.signMessages} onChange={(v) => setChatwootSettings(prev => ({ ...prev, signMessages: v }))} disabled={!chatwootSettings.enabled} /></div>
                    <div className="p-3 bg-surface-light rounded-lg flex items-center justify-between"><span className="text-xs text-slate-300">Conversation Pending</span><Toggle checked={chatwootSettings.conversationPending} onChange={(v) => setChatwootSettings(prev => ({ ...prev, conversationPending: v }))} disabled={!chatwootSettings.enabled} /></div>
                    <div className="p-3 bg-surface-light rounded-lg flex items-center justify-between"><span className="text-xs text-slate-300">Reopen Conversation</span><Toggle checked={chatwootSettings.reopenConversation} onChange={(v) => setChatwootSettings(prev => ({ ...prev, reopenConversation: v }))} disabled={!chatwootSettings.enabled} /></div>
                    <div className="p-3 bg-surface-light rounded-lg flex items-center justify-between"><span className="text-xs text-slate-300">Import Contacts</span><Toggle checked={chatwootSettings.importContacts} onChange={(v) => setChatwootSettings(prev => ({ ...prev, importContacts: v }))} disabled={!chatwootSettings.enabled} /></div>
                    <div className="p-3 bg-surface-light rounded-lg flex items-center justify-between"><span className="text-xs text-slate-300">Import Messages</span><Toggle checked={chatwootSettings.importMessages} onChange={(v) => setChatwootSettings(prev => ({ ...prev, importMessages: v }))} disabled={!chatwootSettings.enabled} /></div>
                    <div className="p-3 bg-surface-light rounded-lg flex items-center justify-between"><span className="text-xs text-slate-300">Auto Create</span><Toggle checked={chatwootSettings.autoCreate} onChange={(v) => setChatwootSettings(prev => ({ ...prev, autoCreate: v }))} disabled={!chatwootSettings.enabled} /></div>
                  </div>
                </div>
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
