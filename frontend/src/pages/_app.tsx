import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/store/auth';
import api from '@/lib/api';

const publicPages = ['/login', '/', '/qr/[token]', '/blocked'];

// Componente de tela de bloqueio
function BlockedScreen({ reason }: { reason: string }) {
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.location.reload();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d0d0d] via-[#1a0a0a] to-[#0d0d0d] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Ícone animado */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-32 h-32 bg-red-500/20 rounded-full flex items-center justify-center animate-pulse">
              <div className="w-24 h-24 bg-red-500/30 rounded-full flex items-center justify-center">
                <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <div className="absolute inset-0 w-32 h-32 bg-red-500/10 rounded-full animate-ping" />
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#1a1a1a]/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-red-500/30 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
            <div className="flex items-center justify-center gap-3">
              <img src="/img/icone.png" alt="GO-API" className="w-8 h-8" />
              <h1 className="text-2xl font-bold text-white">Acesso Bloqueado</h1>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            <div className="text-center">
              <p className="text-gray-300 text-lg mb-2">
                Sua licença foi bloqueada ou é inválida.
              </p>
              <p className="text-red-400 font-medium">{reason}</p>
            </div>

            {/* Countdown */}
            <div className="space-y-3">
              <p className="text-center text-gray-400 text-sm">
                Verificando novamente em <span className="text-[#d4a843] font-bold">{countdown}s</span>
              </p>
              <div className="w-full bg-[#2a2a2a] rounded-full h-2">
                <div
                  className="bg-[#d4a843] h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${(countdown / 30) * 100}%` }}
                />
              </div>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gradient-to-r from-[#d4a843] to-[#b8922e] hover:from-[#e0b44d] hover:to-[#c9a33a] text-[#0d0d0d] font-bold py-3 px-4 rounded-xl transition-all duration-200"
              >
                Tentar Novamente
              </button>
            </div>

            {/* Contato */}
            <div className="border-t border-[#2a2a2a] pt-4">
              <p className="text-center text-gray-500 text-sm">
                Precisa de ajuda? Entre em contato:
              </p>
              <a
                href="mailto:suporte@usego.com.br"
                className="block text-center text-[#d4a843] hover:text-[#e0b44d] font-medium mt-1"
              >
                suporte@usego.com.br
              </a>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-600 text-sm mt-6">
          GO-API © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const loadUser = useAuth((s) => s.loadUser);
  const token = useAuth((s) => s.token);
  const isLoading = useAuth((s) => s.isLoading);
  const [licenseBlocked, setLicenseBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [checkingLicense, setCheckingLicense] = useState(true);

  // Verificar licença ao carregar
  useEffect(() => {
    const checkLicense = async () => {
      try {
        // Fazer uma requisição simples para verificar se a API está acessível
        await api.get('/auth/me').catch((err) => {
          // Se for erro de licença, tratar
          if (err.response?.status === 403) {
            const data = err.response?.data;
            if (data?.error === 'LICENSE_BLOCKED' || data?.error === 'LICENSE_INVALID' || data?.blocked) {
              setLicenseBlocked(true);
              setBlockReason(data?.reason || data?.message || 'Licença bloqueada ou inválida');
              return;
            }
          }
          // Outros erros (401, etc) são normais
        });
      } catch {
        // Erro de rede - não bloquear
      } finally {
        setCheckingLicense(false);
      }
    };

    checkLicense();

    // Verificar licença periodicamente
    const interval = setInterval(checkLicense, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isLoading && !checkingLicense && !licenseBlocked) {
      const isPublicPage = publicPages.includes(router.pathname) || router.pathname.startsWith('/qr/');
      
      if (!token && !isPublicPage) {
        router.push('/login');
      }
    }
  }, [token, isLoading, router, checkingLicense, licenseBlocked]);

  // Se licença bloqueada, mostrar tela de bloqueio
  if (licenseBlocked) {
    return (
      <>
        <Head>
          <link rel="icon" href="/img/icone.png" />
          <title>Licença Bloqueada - GO-API</title>
        </Head>
        <BlockedScreen reason={blockReason} />
      </>
    );
  }

  // Loading
  if (isLoading || checkingLicense) {
    return (
      <>
        <Head>
          <link rel="icon" href="/img/icone.png" />
          <title>GO-API</title>
        </Head>
        <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
          <div className="text-[#d4a843]">
            <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <link rel="icon" href="/img/icone.png" />
        <title>GO-API</title>
      </Head>
      <Component {...pageProps} />
    </>
  );
}
