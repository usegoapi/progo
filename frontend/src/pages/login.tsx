import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';
import Image from 'next/image';
import axios from 'axios';
import { useAuth } from '@/store/auth';

interface Config {
  adminEmail: string;
  adminPassword: string;
  apiUrl: string;
}

export default function Login() {
  const router = useRouter();
  const { setUser, token } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);

  // Se já está logado, redirecionar
  useEffect(() => {
    if (token) {
      router.push('/dashboard');
    }
  }, [token, router]);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        console.log('Config carregada:', { email: data.adminEmail, apiUrl: data.apiUrl });
      })
      .catch(err => console.error('Erro ao carregar config:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!config) {
      Swal.fire({
        icon: 'error',
        title: 'Erro!',
        text: 'Configurações não carregadas. Tente novamente.',
        background: '#1a1a1a',
        color: '#fff',
        confirmButtonColor: '#eaa800',
      });
      return;
    }

    setLoading(true);

    // Verificar credenciais locais
    if (form.email !== config.adminEmail || form.password !== config.adminPassword) {
      Swal.fire({
        icon: 'error',
        title: 'Erro!',
        text: 'E-mail ou senha incorretos.',
        background: '#1a1a1a',
        color: '#fff',
        confirmButtonColor: '#eaa800',
      });
      setLoading(false);
      return;
    }

    try {
      // Tentar login na API
      const response = await axios.post(`${config.apiUrl}/auth/login`, {
        email: form.email,
        password: form.password,
      });

      // Usar o store para salvar
      setUser(response.data.user, response.data.token);

      await Swal.fire({
        icon: 'success',
        title: 'Bem-vindo!',
        text: 'Login realizado com sucesso.',
        background: '#1a1a1a',
        color: '#fff',
        confirmButtonColor: '#eaa800',
        timer: 1500,
        showConfirmButton: false,
      });

      router.push('/dashboard');
    } catch (apiError) {
      console.log('Login na API falhou, usando login local');
      
      // Login local
      const localUser = {
        id: '1',
        email: config.adminEmail,
        name: 'Administrador',
        role: 'ADMIN'
      };
      const localToken = 'local-token-' + Date.now();

      setUser(localUser, localToken);

      await Swal.fire({
        icon: 'success',
        title: 'Bem-vindo!',
        text: 'Login realizado com sucesso.',
        background: '#1a1a1a',
        color: '#fff',
        confirmButtonColor: '#eaa800',
        timer: 1500,
        showConfirmButton: false,
      });

      router.push('/dashboard');
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 bg-[#0d0d0d] flex-col justify-center px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

        <div className="relative z-10 mb-8">
          <Image src="/img/logosite.png" alt="GO-API Logo" width={120} height={48} className="h-12 w-auto" />
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Bem-vindo de volta<br />à sua <span className="text-primary">área exclusiva</span>.
          </h1>
          <p className="text-gray-400 text-lg max-w-md">
            Gerencie suas instâncias de WhatsApp API, acompanhe mensagens e integre com suas ferramentas favoritas.
          </p>
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
            <Image src="/img/logosite.png" alt="GO-API Logo" width={100} height={40} className="h-10 w-auto" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Entrar</h2>
            <p className="text-gray-500">Acesse sua conta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Email</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <span className="material-symbols-outlined text-xl">mail</span>
                </span>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full h-14 pl-12 pr-4 bg-[#1a1a1a] text-white placeholder-gray-600 border border-[#2a2a2a] rounded-xl focus:outline-none focus:border-primary transition-colors"
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
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full h-14 pl-12 pr-12 bg-[#1a1a1a] text-white placeholder-gray-600 border border-[#2a2a2a] rounded-xl focus:outline-none focus:border-primary transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-[#1a1a1a] text-primary focus:ring-primary focus:ring-offset-0"
                />
                <span className="text-gray-400 text-sm">Lembrar-me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !config}
              className="w-full h-14 bg-primary hover:bg-primary-hover text-black font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
