import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import Swal from 'sweetalert2';
import api, { apiErrorMessage } from '@/lib/api';
import { BrandLogo, brandColor, useBrand } from '@/lib/branding';
import { useAuth } from '@/store/auth';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  external?: boolean;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/instances', label: 'Instâncias', icon: 'smartphone' },
  { href: '/contacts', label: 'Contatos', icon: 'contacts' },
  { href: '/messages', label: 'Testar API', icon: 'api' },
  { href: '/webhooks', label: 'Webhooks', icon: 'webhook' },
  { href: '/integrations', label: 'Integrações', icon: 'extension' },
];

const swalTheme = () => ({
  background: '#1a1a1a',
  color: '#fff',
  confirmButtonColor: brandColor(),
  customClass: { popup: 'rounded-xl border border-[#2a2a2a]' },
});

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const brand = useBrand();
  const { user, logout, setUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const systemItems: NavItem[] = [
    { href: '/docs', label: 'Documentação', icon: 'description' },
    ...(brand.supportUrl ? [{ href: brand.supportUrl, label: 'Suporte', icon: 'support_agent', external: true }] : []),
  ];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const changePassword = async () => {
    const { value } = await Swal.fire({
      ...swalTheme(),
      title: 'Alterar senha',
      html: `
        <input id="cp-current" type="password" class="swal2-input" placeholder="Senha atual" autocomplete="current-password">
        <input id="cp-new" type="password" class="swal2-input" placeholder="Nova senha (mín. 8 caracteres)" autocomplete="new-password">`,
      showCancelButton: true,
      confirmButtonText: 'Salvar',
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      preConfirm: () => {
        const currentPassword = (document.getElementById('cp-current') as HTMLInputElement).value;
        const newPassword = (document.getElementById('cp-new') as HTMLInputElement).value;
        if (!currentPassword || newPassword.length < 8) {
          Swal.showValidationMessage('Informe a senha atual e uma nova senha com pelo menos 8 caracteres');
          return false;
        }
        return { currentPassword, newPassword };
      },
    });
    if (!value) return;
    try {
      const { data } = await api.post('/auth/change-password', value);
      setUser(data.user, data.token);
      Swal.fire({ ...swalTheme(), icon: 'success', title: 'Senha alterada!', text: 'Outras sessões foram encerradas.', timer: 2200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ ...swalTheme(), icon: 'error', title: 'Erro', text: apiErrorMessage(err) });
    }
  };

  const isActive = (href: string) => router.pathname === href || router.pathname.startsWith(`${href}/`);

  const renderItem = (item: NavItem) =>
    item.external ? (
      <a
        key={item.href}
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 text-slate-400 hover:bg-surface-light hover:text-white"
      >
        <span className="material-symbols-outlined text-slate-500 group-hover:text-primary transition-colors">{item.icon}</span>
        {item.label}
        <span className="material-symbols-outlined text-xs ml-auto text-slate-600">open_in_new</span>
      </a>
    ) : (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMenuOpen(false)}
        className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
          isActive(item.href)
            ? 'bg-primary/10 text-primary border border-primary/20 shadow-glow'
            : 'text-slate-400 hover:bg-surface-light hover:text-white'
        }`}
      >
        <span
          className={`material-symbols-outlined ${
            isActive(item.href) ? 'fill-icon' : 'text-slate-500 group-hover:text-primary transition-colors'
          }`}
        >
          {item.icon}
        </span>
        {item.label}
      </Link>
    );

  const sidebar = (
    <>
      <div className="flex h-20 items-center justify-between px-6 border-b border-border-dark/50">
        <Link href="/dashboard" aria-label={brand.name}>
          <BrandLogo className="h-10 w-auto max-w-[180px] object-contain" />
        </Link>
        <span className="text-xs font-bold text-primary/70 bg-primary/10 px-2 py-1 rounded">V2</span>
      </div>

      <div className="flex flex-1 flex-col justify-between px-4 py-6 overflow-y-auto">
        <nav className="space-y-1.5">
          <div className="px-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Menu Principal</div>
          {navItems.map(renderItem)}
          <div className="my-4 border-t border-border-dark/50" />
          <div className="px-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sistema</div>
          {systemItems.map(renderItem)}
        </nav>

        <div className="rounded-2xl bg-surface-light/50 border border-border-dark p-4 mt-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-tr from-primary to-primary-hover p-[2px]">
              <div className="h-full w-full rounded-full bg-[#111111] flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-lg">person</span>
              </div>
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold text-white truncate">{user?.name || 'Usuário'}</span>
              <span className="text-xs text-slate-500 truncate" title={user?.email}>
                {user?.email}
              </span>
            </div>
            <div className="ml-auto flex gap-2">
              <button onClick={changePassword} className="text-slate-500 hover:text-white transition-colors" title="Alterar senha">
                <span className="material-symbols-outlined text-xl">key</span>
              </button>
              <button onClick={handleLogout} className="text-slate-500 hover:text-white transition-colors" title="Sair">
                <span className="material-symbols-outlined text-xl">logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <aside className="hidden w-72 flex-col border-r border-border-dark bg-[#111111] md:flex">{sidebar}</aside>

      {/* Navegação mobile */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMenuOpen(false)} />
          <aside className="relative flex w-72 flex-col border-r border-border-dark bg-[#111111]">{sidebar}</aside>
        </div>
      )}

      <main className="flex-1 overflow-y-auto bg-background-dark relative">
        <div className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b border-border-dark bg-[#111111]/95 px-4 h-16 backdrop-blur">
          <BrandLogo className="h-8 w-auto max-w-[140px] object-contain" />
          <button onClick={() => setMenuOpen(true)} className="text-slate-300" aria-label="Abrir menu">
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
        <div className="fixed top-0 right-0 -z-10 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="fixed bottom-0 left-0 -z-10 h-[300px] w-[300px] rounded-full bg-blue-500/5 blur-[100px]" />
        <div className="container mx-auto max-w-7xl px-4 py-8 md:px-10 md:py-10">{children}</div>
      </main>
    </div>
  );
}
