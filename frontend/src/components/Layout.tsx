import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
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
  { href: '/messages', label: 'Mensagens', icon: 'chat' },
  { href: '/webhooks', label: 'Webhooks', icon: 'webhook' },
  { href: '/integrations', label: 'Integrações', icon: 'extension' },
];

const systemItems: NavItem[] = [
  { href: '/docs', label: 'Documentação', icon: 'description' },
  { href: 'https://usego.com.br/members/chat', label: 'Suporte', icon: 'support_agent', external: true },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const logout = useAuth((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isActive = (href: string) => router.pathname === href;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-72 flex-col border-r border-border-dark bg-[#111111] md:flex">
        {/* Logo */}
        <div className="flex h-16 items-center px-6 border-b border-border-dark/50">
          <Image
            src="/img/logosite.png"
            alt="GO-API Logo"
            width={120}
            height={40}
            className="h-8 w-auto"
          />
        </div>

        {/* Navigation */}
        <div className="flex flex-1 flex-col justify-between px-4 py-6">
          <nav className="space-y-1.5">
            <div className="px-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Menu Principal
            </div>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive(item.href)
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-glow'
                    : 'text-slate-400 hover:bg-surface-light hover:text-white'
                }`}
              >
                <span
                  className={`material-symbols-outlined ${
                    isActive(item.href)
                      ? 'fill-icon'
                      : 'text-slate-500 group-hover:text-primary transition-colors'
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            ))}

            <div className="my-4 border-t border-border-dark/50" />

            <div className="px-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sistema
            </div>
            {systemItems.map((item) =>
              item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 text-slate-400 hover:bg-surface-light hover:text-white"
                >
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-primary transition-colors">
                    {item.icon}
                  </span>
                  {item.label}
                  <span className="material-symbols-outlined text-xs ml-auto text-slate-600">open_in_new</span>
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    isActive(item.href)
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-glow'
                      : 'text-slate-400 hover:bg-surface-light hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-primary transition-colors">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              )
            )}

            {/* Versão */}
            <div className="mt-4 px-4">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="material-symbols-outlined text-sm text-primary/50">verified</span>
                <span>GO V1</span>
              </div>
            </div>
          </nav>

          {/* User Card */}
          <div className="rounded-2xl bg-surface-light/50 border border-border-dark p-4 mt-auto">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-orange-600 p-[2px] shadow-lg shadow-orange-500/10">
                <div className="h-full w-full rounded-full bg-[#111111] flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-lg">person</span>
                </div>
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-bold text-white truncate">Administrador</span>
                <span className="text-xs text-primary truncate">Admin</span>
              </div>
              <button
                onClick={handleLogout}
                className="ml-auto text-slate-500 hover:text-white transition-colors"
                title="Sair"
              >
                <span className="material-symbols-outlined text-xl">logout</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background-dark relative">
        <div className="fixed top-0 right-0 -z-10 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="fixed bottom-0 left-0 -z-10 h-[300px] w-[300px] rounded-full bg-blue-500/5 blur-[100px]" />

        <div className="container mx-auto max-w-7xl px-6 py-10 md:px-10">{children}</div>
      </main>
    </div>
  );
}
