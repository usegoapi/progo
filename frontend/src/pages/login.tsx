import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import api, { apiErrorMessage } from '@/lib/api';
import { BrandLogo, brandColor, useBrand } from '@/lib/branding';
import { useAuth } from '@/store/auth';

export default function Login() {
  const router = useRouter();
  const brand = useBrand();
  const { setUser, token } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [allowRegistration, setAllowRegistration] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) router.replace('/dashboard');
  }, [token, router]);

  useEffect(() => {
    api
      .get('/auth/options')
      .then(({ data }) => setAllowRegistration(!!data.allowRegistration))
      .catch(() => setAllowRegistration(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload =
        mode === 'login'
          ? { email: form.email, password: form.password }
          : { email: form.email, password: form.password, name: form.name || undefined };
      const { data } = await api.post(`/auth/${mode}`, payload);
      setUser(data.user, data.token);
      router.replace('/dashboard');
    } catch (err: any) {
      const status = err?.response?.status;
      Swal.fire({
        icon: 'error',
        title: status === 429 ? 'Muitas tentativas' : 'Não foi possível entrar',
        text: status === 429 ? 'Aguarde um minuto e tente novamente.' : apiErrorMessage(err, 'E-mail ou senha incorretos.'),
        background: '#1a1a1a',
        color: '#fff',
        confirmButtonColor: brandColor(),
      });
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full h-14 pl-12 pr-4 bg-[#1a1a1a] text-white placeholder-gray-600 border border-[#2a2a2a] rounded-xl focus:outline-none focus:border-primary transition-colors';

  return (
    <>
      <Head>
        <title>{`Entrar · ${brand.name}`}</title>
      </Head>
      <div className="flex min-h-screen">
        <div className="hidden lg:flex lg:w-1/2 bg-[#0d0d0d] flex-col justify-center px-16 xl:px-24 relative overflow-hidden">
          <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

          <div className="relative z-10 mb-8">
            <BrandLogo className="h-12 w-auto max-w-[220px] object-contain" />
          </div>

          <div className="relative z-10">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
              Bem-vindo de volta
              <br />à sua <span className="text-primary">área exclusiva</span>.
            </h1>
            <p className="text-gray-400 text-lg max-w-md">{brand.tagline}</p>
          </div>

          <div className="relative z-10 flex gap-2 mt-12">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <div className="w-2 h-2 rounded-full bg-gray-600" />
            <div className="w-2 h-2 rounded-full bg-gray-600" />
            <div className="w-2 h-2 rounded-full bg-gray-600" />
          </div>
        </div>

        <div className="w-full lg:w-1/2 bg-[#121212] flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex justify-center mb-8">
              <BrandLogo className="h-10 w-auto max-w-[180px] object-contain" />
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
              <p className="text-gray-500">
                {mode === 'login' ? 'Acesse sua conta para continuar' : `Cadastre-se para usar o ${brand.name}`}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'register' && (
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Nome</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                      <span className="material-symbols-outlined text-xl">badge</span>
                    </span>
                    <input
                      type="text"
                      placeholder="Seu nome"
                      autoComplete="name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={inputClass}
                      maxLength={80}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-gray-400 text-sm mb-2">Email</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    <span className="material-symbols-outlined text-xl">mail</span>
                  </span>
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Senha</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    <span className="material-symbols-outlined text-xl">lock</span>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className={`${inputClass} pr-12`}
                    minLength={mode === 'register' ? 8 : undefined}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility' : 'visibility_off'}</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-primary hover:bg-primary-hover text-on-primary font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                ) : mode === 'login' ? (
                  'Entrar'
                ) : (
                  'Criar conta'
                )}
              </button>
            </form>

            {allowRegistration && (
              <p className="mt-6 text-center text-sm text-gray-500">
                {mode === 'login' ? 'Ainda não tem conta?' : 'Já possui conta?'}{' '}
                <button
                  type="button"
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  className="text-primary hover:text-primary-hover font-semibold"
                >
                  {mode === 'login' ? 'Criar conta' : 'Entrar'}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
