import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';

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

export default function Instances() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [qrModal, setQrModal] = useState<{ id: string; name: string; qr: string | null; connected: boolean; connecting: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState<Instance | null>(null);
  const [showEdit, setShowEdit] = useState<Instance | null>(null);
  const [editName, setEditName] = useState('');
  const [settings, setSettings] = useState<InstanceSettings>({
    rejectCalls: false,
    ignoreGroups: false,
    alwaysOnline: false,
    readMessages: false,
    syncFullHistory: false,
    readStatus: false,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<Instance | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedCard, setCopiedCard] = useState<string | null>(null);

  const loadInstances = async () => {
    try {
      const { data } = await api.get('/instances');
      setInstances(Array.isArray(data) ? data : []);
    } catch {
      setInstances([]);
    }
  };

  useEffect(() => {
    loadInstances();
    const interval = setInterval(loadInstances, 5000);
    return () => clearInterval(interval);
  }, []);

  const [apiError, setApiError] = useState<string | null>(null);

  const createInstance = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await api.post('/instances', { name: newName });
      setNewName('');
      setShowCreate(false);
      await loadInstances();
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || !error.response) {
        setApiError('API Offline');
        setShowCreate(false);
      }
    }
    setLoading(false);
  };

  const generateQrCode = async (id: string, name: string) => {
    setQrModal({ id, name, qr: null, connected: false, connecting: false });
    setShareLink('');
    
    try {
      await api.post(`/instances/${id}/connect`);
    } catch {}
    
    pollQrCode(id, name);
  };

  const pollQrCode = async (id: string, name: string) => {
    const poll = async () => {
      try {
        const { data } = await api.get(`/instances/${id}/qr`);
        
        if (data.qrCode) {
          setQrModal({ id, name, qr: data.qrCode, connected: false, connecting: false });
          generateShareLink(id);
        }
        
        if (data.status === 'CONNECTED') {
          // Mostrar animação de conectando
          setQrModal({ id, name, qr: null, connected: false, connecting: true });
          
          // Após 1.5s mostrar sucesso
          setTimeout(() => {
            setQrModal({ id, name, qr: null, connected: true, connecting: false });
            loadInstances();
            
            // Fechar após 2.5s
            setTimeout(() => setQrModal(null), 2500);
          }, 1500);
          return;
        }
        
        setTimeout(poll, 2000);
      } catch {
        setTimeout(poll, 2000);
      }
    };
    poll();
  };

  const generateShareLink = async (instanceId: string) => {
    try {
      const { data } = await api.post('/auth/shared-token', {
        instanceId,
        expiresInHours: 24,
        permissions: ['view_qr'],
      });
      const baseUrl = window.location.origin;
      setShareLink(`${baseUrl}/qr/${data.token}`);
    } catch {
      setShareLink('');
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyShareLinkFromCard = async (instanceId: string) => {
    try {
      const { data } = await api.post('/auth/shared-token', {
        instanceId,
        expiresInHours: 24,
        permissions: ['view_qr'],
      });
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/qr/${data.token}`;
      navigator.clipboard.writeText(link);
      setCopiedCard(instanceId);
      setTimeout(() => setCopiedCard(null), 2000);
    } catch {}
  };

  const stopInstance = async (id: string) => {
    try {
      await api.post(`/instances/${id}/disconnect`);
      loadInstances();
    } catch {}
  };

  const reconnectInstance = async (id: string, name: string) => {
    setQrModal({ id, name, qr: null, connected: false, connecting: false });
    try {
      await api.post(`/instances/${id}/reconnect`);
    } catch {}
    pollQrCode(id, name);
  };

  const confirmDelete = (instance: Instance) => {
    setDeleteConfirm(instance);
  };

  const deleteInstance = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/instances/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      loadInstances();
    } catch {}
  };

  const openSettings = async (instance: Instance) => {
    setShowSettings(instance);
    try {
      const { data } = await api.get(`/instances/${instance.id}/settings`);
      setSettings(data);
    } catch {
      setSettings({
        rejectCalls: false,
        ignoreGroups: false,
        alwaysOnline: false,
        readMessages: false,
        syncFullHistory: false,
        readStatus: false,
      });
    }
  };

  const openEdit = (instance: Instance) => {
    setShowEdit(instance);
    setEditName(instance.name);
  };

  const saveEditName = async () => {
    if (!showEdit || !editName.trim()) return;
    setLoading(true);
    try {
      await api.put(`/instances/${showEdit.id}`, { name: editName });
      setShowEdit(null);
      setEditName('');
      await loadInstances();
    } catch {}
    setLoading(false);
  };

  const saveSettings = async () => {
    if (!showSettings) return;
    try {
      await api.put(`/instances/${showSettings.id}/settings`, settings);
      setShowSettings(null);
    } catch {}
  };

  const toggleSetting = (key: keyof InstanceSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredInstances = instances.filter((i) => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const settingsOptions = [
    { key: 'rejectCalls', label: 'Rejeitar Chamadas', desc: 'Rejeitar todas as chamadas recebidas automaticamente', icon: 'call_end' },
    { key: 'ignoreGroups', label: 'Ignorar Grupos', desc: 'Ignorar todas as mensagens de grupos', icon: 'group_off' },
    { key: 'alwaysOnline', label: 'Sempre Online', desc: 'Manter o WhatsApp sempre online', icon: 'wifi' },
    { key: 'readMessages', label: 'Ler Mensagens', desc: 'Marcar todas as mensagens como lidas automaticamente', icon: 'mark_chat_read' },
    { key: 'syncFullHistory', label: 'Sincronizar Histórico', desc: 'Sincronizar histórico completo ao escanear QR Code', icon: 'history' },
    { key: 'readStatus', label: 'Ler Status', desc: 'Marcar todos os status como visualizados', icon: 'visibility' },
  ];


  return (
    <Layout>
      {/* Header */}
      <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white mb-2">
            Gerenciamento de Instâncias
          </h2>
          <p className="text-slate-400 max-w-2xl text-lg font-light">
            Controle e monitore suas conexões WhatsApp.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="mb-10 rounded-2xl border border-border-dark bg-surface-dark/80 p-2 shadow-lg backdrop-blur-sm flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <span className="material-symbols-outlined text-slate-500">search</span>
          </div>
          <input
            type="text"
            placeholder="Buscar instância..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-xl border-0 bg-transparent py-3 pl-12 pr-4 text-white placeholder:text-slate-600 focus:ring-0 sm:text-sm transition-colors hover:bg-white/5"
          />
        </div>
        <div className="h-auto w-px bg-border-dark hidden sm:block mx-1 my-2" />
        <div className="flex-none w-full sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-xl border-0 bg-transparent py-3 pl-4 pr-10 text-slate-300 focus:ring-0 sm:text-sm cursor-pointer hover:bg-white/5 transition-colors"
          >
            <option value="all">Todos os Status</option>
            <option value="CONNECTED">Online</option>
            <option value="DISCONNECTED">Offline</option>
          </select>
        </div>
      </div>

      {/* API Offline Modal */}
      {apiError && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-dark border border-border-dark p-6 rounded-2xl w-full max-w-sm text-center">
            <div className="h-16 w-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-danger text-4xl">cloud_off</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">API Offline</h3>
            <p className="text-slate-400 text-sm mb-6">
              Não foi possível conectar com a API. Verifique se o servidor está rodando e tente novamente.
            </p>
            <div className="bg-surface-light rounded-lg p-3 mb-6">
              <p className="text-xs text-slate-500 mb-1">Possíveis causas:</p>
              <ul className="text-xs text-slate-400 text-left space-y-1">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">arrow_right</span>
                  Servidor da API não está rodando
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">arrow_right</span>
                  Problema de conexão com a rede
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">arrow_right</span>
                  URL da API incorreta
                </li>
              </ul>
            </div>
            <button
              onClick={() => setApiError(null)}
              className="w-full py-2.5 rounded-lg bg-primary text-black font-bold hover:bg-primary-hover transition-all text-sm"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-dark border border-border-dark p-6 rounded-2xl w-full max-w-sm text-center">
            <div className="h-16 w-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-danger text-4xl">warning</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Excluir Instância?</h3>
            <p className="text-slate-400 text-sm mb-6">
              Tem certeza que deseja excluir a instância <span className="text-primary font-semibold">{deleteConfirm.name}</span>? 
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-lg border border-border-dark text-slate-400 hover:text-white hover:bg-surface-light transition-all text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={deleteInstance}
                className="flex-1 py-2.5 rounded-lg bg-danger text-white font-bold hover:bg-red-600 transition-all text-sm"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-dark border border-border-dark p-6 rounded-2xl text-center w-full max-w-sm relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
            
            <div className="relative z-10">
              {/* Estado: Conectando (após escanear) */}
              {qrModal.connecting ? (
                <>
                  <div className="relative mx-auto w-20 h-20 mb-6">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <div className="relative h-full w-full rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-4xl animate-pulse">sync</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Conectando...</h3>
                  <p className="text-slate-400 text-sm mb-4">
                    QR Code escaneado! Aguarde...
                  </p>
                  <div className="flex items-center justify-center gap-2 text-primary text-sm">
                    <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </>
              ) : qrModal.connected ? (
                <>
                  <div className="relative mx-auto w-20 h-20 mb-6">
                    <div className="absolute inset-0 rounded-full bg-success/20 animate-pulse" />
                    <div className="relative h-full w-full rounded-full bg-gradient-to-br from-success to-green-600 flex items-center justify-center shadow-lg shadow-success/30">
                      <span className="material-symbols-outlined text-white text-4xl">check</span>
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2">Conectado!</h3>
                  <p className="text-slate-400 text-sm mb-6">
                    A instância <span className="text-primary font-semibold">{qrModal.name}</span> está online.
                  </p>
                  <div className="inline-flex items-center gap-2 bg-success/10 text-success px-4 py-2 rounded-full border border-success/20 mb-6">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-success" />
                    </span>
                    <span className="font-bold text-sm">Online</span>
                  </div>
                  <button
                    onClick={() => setQrModal(null)}
                    className="w-full py-2.5 rounded-lg bg-primary text-black font-bold hover:bg-primary-hover transition-all text-sm"
                  >
                    Fechar
                  </button>
                </>
              ) : (
                <>
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 ring-1 ring-primary/20">
                    <span className="material-symbols-outlined text-primary text-3xl">qr_code_2</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {qrModal.qr ? 'Escaneie o QR Code' : 'Gerando QR Code...'}
                  </h3>
                  <p className="text-slate-400 text-sm mb-4">
                    Instância: <span className="text-primary font-semibold">{qrModal.name}</span>
                  </p>
                  
                  {qrModal.qr ? (
                    <>
                      <div className="relative inline-block mb-4">
                        <div className="absolute -inset-2 bg-primary/10 blur-xl rounded-full" />
                        <div className="relative bg-white p-4 rounded-2xl shadow-lg ring-1 ring-white/20">
                          <img src={qrModal.qr} alt="QR Code" className="w-52 h-52" />
                        </div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-surface-dark px-3 py-1.5 rounded-full border border-border-dark">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                          </span>
                          <span className="text-xs text-slate-400">Aguardando...</span>
                        </div>
                      </div>
                      <p className="text-slate-500 text-xs mb-4">
                        WhatsApp → Menu → Aparelhos conectados → Conectar
                      </p>
                    </>
                  ) : (
                    <div className="py-8 mb-4">
                      <div className="relative mx-auto w-14 h-14 mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
                      </div>
                      <p className="text-slate-500 text-sm">Aguarde, gerando QR Code...</p>
                    </div>
                  )}
                  
                  {shareLink && qrModal.qr && (
                    <div className="mb-4 p-3 bg-surface-light rounded-xl">
                      <p className="text-xs text-slate-400 mb-2">Compartilhar QR Code</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={shareLink}
                          readOnly
                          className="flex-1 text-xs bg-[#1a1a1a] text-slate-300 px-3 py-2 rounded-lg border border-border-dark truncate"
                        />
                        <button
                          onClick={copyShareLink}
                          className="px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {copied ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Link válido por 24 horas</p>
                    </div>
                  )}

                  <button
                    onClick={() => setQrModal(null)}
                    className="w-full py-2.5 rounded-lg border border-border-dark text-slate-400 hover:text-white hover:bg-surface-light transition-all text-sm"
                  >
                    Fechar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-dark border border-border-dark rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-border-dark">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">settings</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Configurações</h3>
                  <p className="text-sm text-slate-400">{showSettings.name}</p>
                </div>
              </div>
            </div>

            <div className="p-4 max-h-[400px] overflow-y-auto">
              {settingsOptions.map((option) => (
                <div
                  key={option.key}
                  className="flex items-center justify-between p-4 hover:bg-surface-light/50 rounded-xl transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-slate-500 mt-0.5">{option.icon}</span>
                    <div>
                      <p className="text-white font-medium text-sm">{option.label}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{option.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSetting(option.key as keyof InstanceSettings)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings[option.key as keyof InstanceSettings]
                        ? 'bg-primary'
                        : 'bg-surface-light'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        settings[option.key as keyof InstanceSettings]
                          ? 'translate-x-7'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border-dark flex gap-3">
              <button
                onClick={() => setShowSettings(null)}
                className="flex-1 py-2.5 rounded-lg border border-border-dark text-slate-400 hover:text-white hover:bg-surface-light transition-all text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={saveSettings}
                className="flex-1 py-2.5 rounded-lg bg-primary text-black font-bold hover:bg-primary-hover transition-all text-sm"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instances Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredInstances.map((instance) => (
          <div
            key={instance.id}
            className={`group relative flex flex-col justify-between rounded-2xl border bg-surface-dark p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-card ${
              instance.status === 'CONNECTED'
                ? 'border-border-dark hover:border-primary/40'
                : 'border-border-dark hover:border-danger/40'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Profile Picture */}
                <div className="relative">
                  {instance.profilePic ? (
                    <img
                      src={instance.profilePic}
                      alt="Profile"
                      className="w-12 h-12 rounded-full object-cover border-2 border-border-dark"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-surface-light flex items-center justify-center border-2 border-border-dark">
                      <span className="material-symbols-outlined text-slate-500">person</span>
                    </div>
                  )}
                  {instance.status === 'CONNECTED' && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success rounded-full border-2 border-surface-dark" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors truncate">
                      {instance.name}
                    </h3>
                    <button
                      onClick={() => openEdit(instance)}
                      className="p-1 rounded-lg hover:bg-surface-light text-slate-500 hover:text-primary transition-all flex-shrink-0"
                      title="Editar nome"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">ID: {instance.id.slice(0, 8)}</p>
                  {instance.phone && (
                    <p className="text-xs text-primary font-medium mt-0.5">
                      +{instance.phone}
                    </p>
                  )}
                </div>
              </div>
              
              <div
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${
                  instance.status === 'CONNECTED'
                    ? 'bg-success/10 border-success/20'
                    : 'bg-danger/10 border-danger/20'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  {instance.status === 'CONNECTED' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      instance.status === 'CONNECTED' ? 'bg-success' : 'bg-danger'
                    }`}
                  />
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    instance.status === 'CONNECTED' ? 'text-success' : 'text-danger'
                  }`}
                >
                  {instance.status === 'CONNECTED' ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            <div className="mt-auto space-y-3">
              {/* Main Action Button */}
              {instance.status === 'CONNECTED' ? (
                <button
                  onClick={() => stopInstance(instance.id)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-bold text-danger hover:bg-danger hover:text-white hover:border-transparent transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[20px]">stop_circle</span>
                  Parar Instância
                </button>
              ) : (
                <button
                  onClick={() => generateQrCode(instance.id, instance.name)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-bold text-primary hover:bg-primary hover:text-black hover:border-transparent transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
                  Gerar QR Code
                </button>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 border-t border-border-dark/50">
                <button
                  onClick={() => openSettings(instance)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-surface-light py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#252525] transition-all"
                  title="Configurações"
                >
                  <span className="material-symbols-outlined text-[18px]">settings</span>
                </button>
                <button
                  onClick={() => copyShareLinkFromCard(instance.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-surface-light py-2 text-xs font-semibold text-slate-400 hover:text-primary hover:bg-primary/10 transition-all"
                  title="Compartilhar QR Code"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {copiedCard === instance.id ? 'check' : 'share'}
                  </span>
                </button>
                <button
                  onClick={() => confirmDelete(instance)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-surface-light py-2 text-xs font-semibold text-danger hover:text-red-400 hover:bg-danger/10 transition-all"
                  title="Excluir"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add New Instance Card */}
        <button
          onClick={() => setShowCreate(true)}
          className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border-dark bg-surface-dark/30 p-6 transition-all duration-300 hover:border-primary hover:bg-surface-dark hover:shadow-glow min-h-[280px]"
        >
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-surface-light shadow-lg ring-1 ring-border-dark transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-black group-hover:ring-primary/50">
            <span className="material-symbols-outlined text-4xl text-slate-500 group-hover:text-black transition-colors">
              add
            </span>
          </div>
          <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">
            Adicionar Instância
          </h3>
          <p className="mt-2 text-center text-sm font-medium text-slate-500 group-hover:text-slate-400 max-w-[200px]">
            Crie uma nova conexão para começar.
          </p>
        </button>
      </div>


      {/* Edit Name Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-dark border border-border-dark p-6 rounded-2xl w-full max-w-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">edit</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Editar Instância</h3>
                <p className="text-xs text-slate-400">Altere o nome da instância</p>
              </div>
            </div>
            <input
              type="text"
              placeholder="Nome da instância"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowEdit(null)}
                className="flex-1 py-2.5 rounded-lg border border-border-dark text-slate-400 hover:text-white hover:bg-surface-light transition-all text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={saveEditName}
                disabled={loading || !editName.trim()}
                className="flex-1 py-2.5 rounded-lg bg-primary text-black font-bold hover:bg-primary-hover transition-all text-sm disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-dark border border-border-dark p-8 rounded-2xl w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-6">Nova Instância</h3>
            <input
              type="text"
              placeholder="Nome da instância"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-3 rounded-lg border border-border-dark text-slate-400 hover:text-white hover:bg-surface-light transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={createInstance}
                disabled={loading || !newName.trim()}
                className="flex-1 py-3 rounded-lg bg-primary text-black font-bold hover:bg-primary-hover transition-all disabled:opacity-50"
              >
                {loading ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 border-t border-border-dark/50 pt-6 text-center">
        <p className="text-sm text-slate-600">© 2025 GO-API todos direitos reservados.</p>
      </div>
    </Layout>
  );
}
