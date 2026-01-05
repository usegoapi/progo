import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import Swal from 'sweetalert2';

interface Instance { id: string; name: string; status: string; }
interface Group { id: string; name: string; participants: number; }
interface Participant { id: string; phone: string; admin: string | null; name?: string; }

export default function Contacts() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/instances').then(({ data }) => {
      const arr = Array.isArray(data) ? data : [];
      setInstances(arr);
      const conn = arr.filter((i: Instance) => i.status === 'CONNECTED');
      if (conn.length > 0) setSelectedInstance(conn[0].id);
      else if (arr.length > 0) setSelectedInstance(arr[0].id);
    }).catch(() => setInstances([]));
  }, []);

  useEffect(() => {
    if (!selectedInstance) return;
    setLoading(true);
    setGroups([]);
    setSelectedGroup('');
    setParticipants([]);
    api.get(`/instances/${selectedInstance}/contacts/groups`)
      .then(({ data }) => setGroups(data.groups || []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [selectedInstance]);

  useEffect(() => {
    if (!selectedInstance || !selectedGroup) {
      setParticipants([]);
      setGroupName('');
      setGroupId('');
      return;
    }
    setLoading(true);
    api.get(`/instances/${selectedInstance}/contacts/groups/${encodeURIComponent(selectedGroup)}/participants`)
      .then(({ data }) => {
        setParticipants(data.participants || []);
        setGroupName(data.groupName || '');
        setGroupId(data.groupId || '');
      })
      .catch(() => setParticipants([]))
      .finally(() => setLoading(false));
  }, [selectedGroup, selectedInstance]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    Swal.fire({ icon: 'success', title: 'Copiado!', background: '#1a1a1a', color: '#fff', timer: 1500, showConfirmButton: false });
  };

  const exportCSV = () => {
    if (participants.length === 0) return;
    const headers = ['Nome', 'Telefone'];
    const rows = filteredParticipants.map(p => [p.name || '-', p.phone]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contatos_${groupName || 'grupo'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredParticipants = participants.filter(p =>
    p.phone.includes(searchTerm) || (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalContacts = groups.reduce((acc, g) => acc + g.participants, 0);

  return (
    <Layout>
      <div className="mb-8">
        <h2 className="text-4xl font-black tracking-tight text-white mb-2">Contatos</h2>
        <p className="text-slate-400 text-lg font-light">Gerencie contatos e grupos das suas instâncias.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-border-dark bg-surface-dark p-5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-2xl">groups</span>
            </div>
            <div>
              <p className="text-sm text-slate-400">Total de Grupos</p>
              <p className="text-2xl font-bold text-white">{groups.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border-dark bg-surface-dark p-5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-2xl">person</span>
            </div>
            <div>
              <p className="text-sm text-slate-400">Contatos Únicos</p>
              <p className="text-2xl font-bold text-white">{totalContacts}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border-dark bg-surface-dark p-5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-2xl">wifi</span>
            </div>
            <div>
              <p className="text-sm text-slate-400">Status</p>
              <p className="text-2xl font-bold text-white">{instances.find(i => i.id === selectedInstance)?.status === 'CONNECTED' ? '🟢 Online' : '🔴 Offline'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border-dark bg-surface-dark p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Instância</label>
            <select value={selectedInstance} onChange={(e) => setSelectedInstance(e.target.value)} className="w-full h-12 px-4 bg-[#2a2a2a] text-white border border-[#444] rounded-xl focus:outline-none focus:border-primary">
              {instances.length === 0 && <option value="">Nenhuma instância</option>}
              {instances.map((i) => (<option key={i.id} value={i.id}>{i.name} {i.status === 'CONNECTED' ? '🟢' : '🔴'}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Filtrar Grupos</label>
            <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} className="w-full h-12 px-4 bg-[#2a2a2a] text-white border border-[#444] rounded-xl focus:outline-none focus:border-primary" disabled={groups.length === 0}>
              <option value="">Selecione um grupo</option>
              {groups.map((g) => (<option key={g.id} value={g.id}>{g.name} ({g.participants})</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* Group Info & Contacts */}
      {selectedGroup && (
        <div className="rounded-2xl border border-border-dark bg-surface-dark p-6">
          {/* Group ID */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20">
            <div>
              <p className="text-sm text-slate-400 mb-1">ID do Grupo</p>
              <p className="text-lg font-mono text-white break-all">{groupId}</p>
            </div>
            <button onClick={() => copyToClipboard(groupId)} className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded-lg transition-all">
              <span className="material-symbols-outlined text-lg">content_copy</span>
              Copiar ID
            </button>
          </div>

          {/* Search & Export */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">search</span>
                <input type="text" placeholder="Pesquisar contatos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full h-12 pl-12 pr-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-xl focus:outline-none focus:border-primary" />
              </div>
            </div>
            <button onClick={exportCSV} disabled={filteredParticipants.length === 0} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <span className="material-symbols-outlined">download</span>
              Exportar CSV
            </button>
          </div>

          {/* Contacts Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-dark">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Nome</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Telefone</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Função</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="py-8 text-center text-slate-500">Carregando...</td></tr>
                ) : filteredParticipants.length === 0 ? (
                  <tr><td colSpan={3} className="py-8 text-center text-slate-500">Nenhum contato encontrado</td></tr>
                ) : (
                  filteredParticipants.map((p, i) => (
                    <tr key={i} className="border-b border-border-dark/50 hover:bg-surface-light/50 transition-colors">
                      <td className="py-3 px-4 text-white">{p.name || '-'}</td>
                      <td className="py-3 px-4 text-slate-300 font-mono">{p.phone}</td>
                      <td className="py-3 px-4">
                        {p.admin === 'admin' && <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-lg">Admin</span>}
                        {p.admin === 'superadmin' && <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-lg">Super Admin</span>}
                        {!p.admin && <span className="px-2 py-1 text-xs bg-slate-500/20 text-slate-400 rounded-lg">Membro</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-sm text-slate-500 text-right">{filteredParticipants.length} contato(s)</div>
        </div>
      )}

      {!selectedGroup && selectedInstance && (
        <div className="rounded-2xl border border-border-dark bg-surface-dark p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">group</span>
          <p className="text-slate-400">Selecione um grupo para ver os contatos</p>
        </div>
      )}

      <div className="mt-12 border-t border-border-dark/50 pt-6 text-center">
        <p className="text-sm text-slate-600">© 2025 GO-API todos direitos reservados.</p>
      </div>
    </Layout>
  );
}
