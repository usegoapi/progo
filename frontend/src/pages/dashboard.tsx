import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import api from '@/lib/api';

interface Instance {
  id: string;
  name: string;
  phone: string | null;
  status: string;
}

interface Stats {
  instances: number;
  connected: number;
  messages: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ instances: 0, connected: 0, messages: 0 });
  const [connectedInstances, setConnectedInstances] = useState<Instance[]>([]);
  const [apiStatus, setApiStatus] = useState<'loading' | 'online' | 'offline'>('loading');

  useEffect(() => {
    api.get('/instances')
      .then(({ data }) => {
        const instances = Array.isArray(data) ? data : [];
        const connected = instances.filter((i: Instance) => i.status === 'CONNECTED');
        setStats({
          instances: instances.length,
          connected: connected.length,
          messages: 0,
        });
        setConnectedInstances(connected);
        setApiStatus('online');
      })
      .catch(() => {
        setStats({ instances: 0, connected: 0, messages: 0 });
        setConnectedInstances([]);
        setApiStatus('offline');
      });
  }, []);

  const statCards = [
    { label: 'Total de Instâncias', value: stats.instances, icon: 'smartphone', color: 'primary' },
    { label: 'Conectadas', value: stats.connected, icon: 'wifi', color: 'success' },
    { label: 'Mensagens Hoje', value: stats.messages, icon: 'chat', color: 'blue-500' },
  ];

  return (
    <Layout>
      {/* API Status */}
      {apiStatus === 'offline' && (
        <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-yellow-500">warning</span>
            <p className="text-yellow-500 text-sm">
              API offline. Verifique se o backend está rodando corretamente.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {statCards.map((stat, i) => (
          <div
            key={i}
            className="group relative flex flex-col rounded-2xl border border-border-dark bg-surface-dark p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-card"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`h-12 w-12 rounded-xl bg-${stat.color}/10 flex items-center justify-center`}>
                <span className={`material-symbols-outlined text-${stat.color} text-2xl`}>
                  {stat.icon}
                </span>
              </div>
            </div>
            <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
            <p className="text-4xl font-black text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Connected Instances */}
      <div className="rounded-2xl border border-border-dark bg-surface-dark p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-success">wifi</span>
            </div>
            <h3 className="text-xl font-bold text-white">Instâncias Online</h3>
          </div>
          <Link
            href="/instances"
            className="text-sm text-primary hover:text-primary-hover transition-colors flex items-center gap-1"
          >
            Ver todas
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>

        {connectedInstances.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectedInstances.map((instance) => (
              <div
                key={instance.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-surface-light/50 border border-border-dark/50 hover:border-success/30 transition-colors"
              >
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-success">smartphone</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{instance.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                    </span>
                    <span className="text-success text-xs font-medium">Online</span>
                  </div>
                </div>
                <Link
                  href="/instances"
                  className="p-2 rounded-lg hover:bg-surface-light transition-colors"
                >
                  <span className="material-symbols-outlined text-slate-400 hover:text-white text-xl">
                    arrow_forward
                  </span>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="h-16 w-16 rounded-full bg-surface-light flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-slate-500 text-3xl">wifi_off</span>
            </div>
            <p className="text-slate-400 mb-4">Nenhuma instância conectada</p>
            <Link
              href="/instances"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Conectar Instância
            </Link>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 border-t border-border-dark/50 pt-6 text-center">
        <p className="text-sm text-slate-600">© 2025 GO-API todos direitos reservados.</p>
      </div>
    </Layout>
  );
}
