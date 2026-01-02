import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/store/auth';
import api from '@/lib/api';
import Swal from 'sweetalert2';

const publicPages = ['/login', '/', '/qr/[token]', '/blocked'];

// Componente de tela de bloqueio - mesmo estilo da página de login
function BlockedScreen({
  reason,
  onCheckLicense,
}: {
  reason: string;
  onCheckLicense: () => Promise<boolean>;
}) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(30);
  const [checking, setChecking] = useState(false);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    try {
      const isUnblocked = await onCheckLicense();
      if (isUnblocked) {
        // Licença foi liberada - mostrar SweetAlert e redirecionar
        await Swal.fire({
          icon: 'success',
          title: 'Licença Liberada!',
          text: 'Sua licença foi reativada com sucesso.',
          confirmButtonText: 'Ir para Login',
          confirmButtonColor: '#d4a843',
          background: '#1a1a1a',
          color: '#fff',
          iconColor: '#d4a843',
          customClass: {
            popup: 'rounded-xl border border-[#2a2a2a]',
            confirmButton: 'rounded-lg font-semibold',
          },
        });
        router.push('/login');
      }
    } finally {
      setChecking(false);
      setCountdown(30);
    }
  }, [onCheckLicense, router]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleCheck();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [handleCheck]);

  return (
    <div className="flex min-h-screen">
      {/* Lado esquerdo - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0d0d0d] flex-col justify-center px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

        <div className="relative z-10 mb-8">
          <img src="/img/logosite.png" alt="GO-API Logo" className="h-12 w-auto" />
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Acesso<br /><span className="text-primary">temporariamente</span><br />suspenso.
          </h1>
          <p className="text-gray-400 text-lg max-w-md">
            Sua licença precisa ser verificada ou renovada para continuar utilizando a plataforma.
          </p>
        </div>

        <div className="relative z-10 flex gap-2 mt-12">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <div className="w-2 h-2 rounded-full bg-gray-600" />
          <div className="w-2 h-2 rounded-full bg-gray-600" />
          <div className="w-2 h-2 rounded-full bg-gray-600" />
        </div>
      </div>

      {/* Lado direito - Card de bloqueio */}
      <div className="w-full lg:w-1/2 bg-[#121212] flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden flex justify-center mb-8">
            <img src="/img/logosite.png" alt="GO-API Logo" className="h-10 w-auto" />
          </div>

          {/* Ícone de bloqueio */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-red-500">lock</span>
            </div>
          </div>

          {/* Título */}
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Licença Bloqueada</h2>
            <p className="text-gray-500">Sua licença foi suspensa ou expirou</p>
          </div>

          {/* Motivo */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-red-500 mt-0.5">error</span>
              <div>
                <p className="text-gray-400 text-sm mb-1">Motivo do bloqueio:</p>
                <p className="text-white font-medium">{reason}</p>
              </div>
            </div>
          </div>

          {/* Countdown */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Verificando novamente em</span>
              <span className="text-primary font-bold">{countdown}s</span>
            </div>
            <div className="w-full bg-[#1a1a1a] rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-1000"
                style={{ width: `${(countdown / 30) * 100}%` }}
              />
            </div>
          </div>

          {/* Botão */}
          <button
            onClick={handleCheck}
            disabled={checking}
            className="w-full h-14 bg-primary hover:bg-primary-hover text-black font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {checking ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verificando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">refresh</span>
                Verificar Novamente
              </>
            )}
          </button>

          {/* Contato */}
          <div className="mt-8 pt-6 border-t border-[#2a2a2a]">
            <p className="text-center text-gray-500 text-sm mb-2">
              Precisa de ajuda com sua licença?
            </p>
            <a
              href="mailto:suporte@usego.com.br"
              className="flex items-center justify-center gap-2 text-primary hover:text-primary-hover transition-colors"
            >
              <span className="material-symbols-outlined text-lg">mail</span>
              suporte@usego.com.br
            </a>
          </div>
        </div>
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
  const [wasBlocked, setWasBlocked] = useState(false);

  // Função para verificar licença - retorna true se foi desbloqueada
  const checkLicense = useCallback(async (): Promise<boolean> => {
    try {
      const response = await api.get('/license/check');
      const data = response.data;

      if (data?.blocked || data?.error === 'LICENSE_BLOCKED') {
        setLicenseBlocked(true);
        setBlockReason(data?.reason || data?.message || 'Licença bloqueada ou inválida');
        return false;
      } else {
        // Licença OK
        const previouslyBlocked = licenseBlocked;
        setLicenseBlocked(false);
        setBlockReason('');
        return previouslyBlocked; // Retorna true se estava bloqueado antes
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        const data = err.response?.data;
        if (data?.error === 'LICENSE_BLOCKED' || data?.error === 'LICENSE_INVALID' || data?.blocked) {
          setLicenseBlocked(true);
          setBlockReason(data?.reason || data?.message || 'Licença bloqueada ou inválida');
          return false;
        }
      }
      // Erro 404 ou outros - não bloquear, apenas logar
      console.warn('Erro ao verificar licença:', err.response?.status);
      return false;
    }
  }, [licenseBlocked]);

  // Verificar licença ao carregar e periodicamente
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const initialCheck = async () => {
      await checkLicense();
      setCheckingLicense(false);
    };

    initialCheck();

    // Verificar licença periodicamente (a cada 10 segundos)
    interval = setInterval(async () => {
      const previouslyBlocked = licenseBlocked;
      
      try {
        const response = await api.get('/license/check');
        const data = response.data;

        if (data?.blocked || data?.error === 'LICENSE_BLOCKED') {
          if (!previouslyBlocked) {
            // Acabou de ser bloqueado - mostrar alerta
            Swal.fire({
              icon: 'error',
              title: 'Licença Bloqueada',
              text: data?.reason || 'Sua licença foi bloqueada.',
              confirmButtonText: 'Entendi',
              confirmButtonColor: '#d4a843',
              background: '#1a1a1a',
              color: '#fff',
              iconColor: '#ef4444',
              customClass: {
                popup: 'rounded-xl border border-[#2a2a2a]',
                confirmButton: 'rounded-lg font-semibold',
              },
            });
          }
          setLicenseBlocked(true);
          setBlockReason(data?.reason || data?.message || 'Licença bloqueada ou inválida');
        } else {
          // Licença OK
          if (previouslyBlocked) {
            // Foi desbloqueado - mostrar alerta e redirecionar
            await Swal.fire({
              icon: 'success',
              title: 'Licença Liberada!',
              text: 'Sua licença foi reativada com sucesso.',
              confirmButtonText: 'Ir para Login',
              confirmButtonColor: '#d4a843',
              background: '#1a1a1a',
              color: '#fff',
              iconColor: '#d4a843',
              customClass: {
                popup: 'rounded-xl border border-[#2a2a2a]',
                confirmButton: 'rounded-lg font-semibold',
              },
            });
            router.push('/login');
          }
          setLicenseBlocked(false);
          setBlockReason('');
        }
      } catch (err: any) {
        if (err.response?.status === 403) {
          const data = err.response?.data;
          if (data?.error === 'LICENSE_BLOCKED' || data?.error === 'LICENSE_INVALID' || data?.blocked) {
            if (!previouslyBlocked) {
              Swal.fire({
                icon: 'error',
                title: 'Licença Bloqueada',
                text: data?.reason || 'Sua licença foi bloqueada.',
                confirmButtonText: 'Entendi',
                confirmButtonColor: '#d4a843',
                background: '#1a1a1a',
                color: '#fff',
                iconColor: '#ef4444',
                customClass: {
                  popup: 'rounded-xl border border-[#2a2a2a]',
                  confirmButton: 'rounded-lg font-semibold',
                },
              });
            }
            setLicenseBlocked(true);
            setBlockReason(data?.reason || data?.message || 'Licença bloqueada ou inválida');
          }
        }
      }
    }, 10000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [licenseBlocked, router]);

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
        <BlockedScreen reason={blockReason} onCheckLicense={checkLicense} />
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
