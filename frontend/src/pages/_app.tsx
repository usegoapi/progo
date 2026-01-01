import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/store/auth';

const publicPages = ['/login', '/'];

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const loadUser = useAuth((s) => s.loadUser);
  const token = useAuth((s) => s.token);
  const isLoading = useAuth((s) => s.isLoading);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isLoading) {
      const isPublicPage = publicPages.includes(router.pathname);
      
      if (!token && !isPublicPage) {
        router.push('/login');
      }
    }
  }, [token, isLoading, router]);

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-primary">
          <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
        </div>
      </div>
    );
  }

  return <Component {...pageProps} />;
}
