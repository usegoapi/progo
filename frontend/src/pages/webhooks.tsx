import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
}

const availableEvents = [
  { id: 'message_received', label: 'Mensagem Recebida', icon: 'inbox' },
  { id: 'message_sent', label: 'Mensagem Enviada', icon: 'send' },
  { id: 'instance_status', label: 'Status da Instância', icon: 'wifi' },
  { id: 'qr_code_updated', label: 'QR Code Atualizado', icon: 'qr_code_2' },
];

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ url: '', events: [] as string[], secret: '' });

  const loadWebhooks = async () => {
    try {
      const { data } = await api.get('/webhooks');
      setWebhooks(data);
    } catch {}
  };

  useEffect(() => {
    loadWebhooks();
  }, []);

  const createWebhook = async () => {
    if (!newWebhook.url || newWebhook.events.length === 0) return;
    setLoading(true);
    try {
      await api.post('/webhooks', newWebhook);
      setNewWebhook({ url: '', events: [], secret: '' });
      setShowCreate(false);
      loadWebhooks();
    } catch {}
    setLoading(false);
  };

  const toggleEvent = (eventId: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId],
    }));
  };

  const toggleActive = async (id: string, active: boolean) => {
    try {
      await api.put(`/webhooks/${id}`, { active: !active });
      loadWebhooks();
    } catch {}
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm('Deletar este webhook?')) return;
    try {
      await api.delete(`/webhooks/${id}`);
      loadWebhooks();
    } catch {}
  };

  return (
    <Layout>
      <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white mb-2">Webhooks</h2>
          <p className="text-slate-400 text-lg font-light">
            Configure URLs para receber eventos em tempo real.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-all"
        >
          <span className="material-symbols-outlined">add</span>
          Novo Webhook
        </button>
      </div>

      {/* Webhooks List */}
      <div className="space-y-4">
        {webhooks.map((webhook) => (
          <div
            key={webhook.id}
            className="rounded-2xl border border-border-dark bg-surface-dark p-6 transition-all hover:border-primary/30"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">webhook</span>
                  </div>
                  <div>
                    <p className="text-white font-mono text-sm break-all">{webhook.url}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {webhook.events.map((event) => (
                        <span
                          key={event}
                          className="px-2 py-1 bg-surface-light rounded text-xs text-slate-400"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleActive(webhook.id, webhook.active)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    webhook.active
                      ? 'bg-success/10 text-success border border-success/20'
                      : 'bg-surface-light text-slate-400'
                  }`}
                >
                  {webhook.active ? 'Ativo' : 'Inativo'}
                </button>
                <button
                  onClick={() => deleteWebhook(webhook.id)}
                  className="p-2 rounded-lg bg-surface-light text-danger hover:bg-danger/10 transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}

        {webhooks.length === 0 && (
          <div className="text-center py-16 rounded-2xl border border-dashed border-border-dark">
            <div className="h-16 w-16 rounded-full bg-surface-light flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-slate-500 text-3xl">webhook</span>
            </div>
            <p className="text-slate-400">Nenhum webhook configurado</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 text-primary hover:text-primary-hover font-medium"
            >
              Criar primeiro webhook
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-dark border border-border-dark p-8 rounded-2xl w-full max-w-lg">
            <h3 className="text-xl font-bold text-white mb-6">Novo Webhook</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">URL</label>
                <input
                  type="text"
                  placeholder="https://seusite.com/webhook"
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                  className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Secret (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Chave secreta para validação"
                  value={newWebhook.secret}
                  onChange={(e) => setNewWebhook({ ...newWebhook, secret: e.target.value })}
                  className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Eventos</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => toggleEvent(event.id)}
                      className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-all ${
                        newWebhook.events.includes(event.id)
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'bg-surface-light text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{event.icon}</span>
                      {event.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-3 rounded-lg border border-border-dark text-slate-400 hover:text-white hover:bg-surface-light transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={createWebhook}
                disabled={loading || !newWebhook.url || newWebhook.events.length === 0}
                className="flex-1 py-3 rounded-lg bg-primary text-black font-bold hover:bg-primary-hover transition-all disabled:opacity-50"
              >
                {loading ? 'Criando...' : 'Criar Webhook'}
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
