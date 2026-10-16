import '@/styles/globals.css';
import type { AppContext, AppProps } from 'next/app';
import NextApp from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { setApiBaseUrl } from '@/lib/api';
import { BrandProvider, brandCssVariables, defaultPublicConfig, PublicConfig, readPublicConfig } from '@/lib/branding';
import { useAuth } from '@/store/auth';

const PUBLIC_PATHS = ['/login', '/', '/qr/[token]'];

type Props = AppProps & { publicConfig: PublicConfig };

// Configuração resolvida no primeiro carregamento (SSR) e reaproveitada nas navegações.
let clientConfig: PublicConfig | null = null;

export default function App({ Component, pageProps, publicConfig }: Props) {
  const router = useRouter();
  const loadUser = useAuth((s) => s.loadUser);
  const token = useAuth((s) => s.token);
  const isLoading = useAuth((s) => s.isLoading);

  const config = publicConfig ?? clientConfig ?? defaultPublicConfig;
  if (typeof window !== 'undefined') {
    clientConfig = config;
    setApiBaseUrl(config.apiUrl);
  }

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const isPublic = PUBLIC_PATHS.includes(router.pathname);
  useEffect(() => {
    if (!isLoading && !token && !isPublic) router.replace('/login');
  }, [token, isLoading, isPublic, router]);

  const { brand } = config;
  const showSpinner = !isPublic && (isLoading || !token);

  return (
    <BrandProvider value={config}>
      <Head>
        <title>{brand.name}</title>
        <link rel="icon" href={brand.iconUrl} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={brand.primaryColor} />
        <style dangerouslySetInnerHTML={{ __html: brandCssVariables(brand.primaryColor) }} />
      </Head>
      {showSpinner ? (
        <div className="min-h-screen bg-background-dark flex items-center justify-center">
          <span className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : (
        <Component {...pageProps} />
      )}
    </BrandProvider>
  );
}

App.getInitialProps = async (appContext: AppContext) => {
  const appProps = await NextApp.getInitialProps(appContext);
  const publicConfig = typeof window === 'undefined' ? readPublicConfig() : clientConfig ?? defaultPublicConfig;
  return { ...appProps, publicConfig };
};
