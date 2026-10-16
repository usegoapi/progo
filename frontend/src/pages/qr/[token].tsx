import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '@/lib/api';
import { BrandLogo, Copyright, useBrand } from '@/lib/branding';

type Phase = 'loading' | 'qr' | 'connecting' | 'connected' | 'error';

export default function SharedQRCode() {
  const router = useRouter();
  const brand = useBrand();
  const token = typeof router.query.token === 'string' ? router.query.token : null;
  const [phase, setPhase] = useState<Phase>('loading');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const { data } = await api.get(`/instances/shared/${encodeURIComponent(token)}`);
        if (cancelled) return;
        setInstanceName(data.instanceName || 'Instância');

        if (data.status === 'CONNECTED') {
          setPhase((prev) => (prev === 'qr' ? 'connecting' : 'connected'));
          setTimeout(() => !cancelled && setPhase('connected'), 1500);
          return; // conectado: encerra o polling
        }
        setQrCode(data.qrCode);
        setPhase('qr');
        timer = setTimeout(poll, 2500);
      } catch (err) {
        if (cancelled) return;
        setError(apiErrorMessage(err, 'Link inválido ou expirado'));
        setPhase('error');
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token]);

  return (
    <>
      <Head>
        <title>{`Escanear QR Code · ${brand.name}`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <BrandLogo className="h-14 w-auto max-w-[220px] mx-auto object-contain" />
          </div>

          <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

            <div className="relative z-10">
              {phase === 'loading' && (
                <div className="py-16">
                  <div className="relative mx-auto w-20 h-20 mb-6">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
                  </div>
                  <p className="text-slate-400 text-lg font-medium">Carregando...</p>
                </div>
              )}

              {phase === 'error' && (
                <div className="py-12">
                  <div className="h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6 ring-4 ring-red-500/20">
                    <span className="material-symbols-outlined text-red-500 text-5xl">link_off</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-3">Link indisponível</h2>
                  <p className="text-slate-400">{error}</p>
                  <p className="text-slate-500 text-sm mt-3">Solicite um novo link a quem compartilhou com você.</p>
                </div>
              )}

              {phase === 'connecting' && (
                <div className="py-16">
                  <div className="relative mx-auto w-24 h-24 mb-6">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <div className="relative h-full w-full rounded-full bg-primary/10 flex items-center justify-center border border-primary/30">
                      <span className="material-symbols-outlined text-primary text-4xl animate-pulse">sync</span>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Conectando...</h2>
                  <p className="text-slate-400">QR Code lido com sucesso!</p>
                </div>
              )}

              {phase === 'connected' && (
                <div className="py-12">
                  <div className="relative mx-auto w-24 h-24 mb-6">
                    <div className="absolute inset-0 rounded-full bg-green-500/20 animate-pulse" />
                    <div className="relative h-full w-full rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                      <span className="material-symbols-outlined text-white text-5xl">check</span>
                    </div>
                  </div>
                  <h2 className="text-3xl font-black text-white mb-3">Conectado!</h2>
                  <p className="text-slate-400">
                    A instância <span className="text-primary font-bold">{instanceName}</span> está online. Você já pode fechar esta página.
                  </p>
                </div>
              )}

              {phase === 'qr' && (
                <>
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6 ring-1 ring-primary/20">
                    <span className="material-symbols-outlined text-primary text-3xl">qr_code_2</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Escaneie o QR Code</h2>
                  <p className="text-slate-400 mb-6">
                    Instância: <span className="text-primary font-semibold">{instanceName}</span>
                  </p>

                  {qrCode ? (
                    <div className="relative inline-block mb-6">
                      <div className="absolute -inset-4 bg-primary/10 blur-2xl rounded-full" />
                      <div className="relative bg-white p-5 rounded-2xl shadow-2xl">
                        <img src={qrCode} alt="QR Code" className="w-56 h-56 sm:w-64 sm:h-64" />
                      </div>
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#161616] px-4 py-2 rounded-full border border-[#2a2a2a] shadow-lg whitespace-nowrap">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                        </span>
                        <span className="text-xs text-slate-400 font-medium">Aguardando leitura...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 mb-6">
                      <div className="relative mx-auto w-16 h-16 mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
                      </div>
                      <p className="text-slate-500">Gerando QR Code...</p>
                    </div>
                  )}

                  <div className="bg-[#1f1f1f] rounded-xl p-4 border border-[#2a2a2a] mt-4">
                    <div className="flex items-center gap-3 text-left">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-primary">smartphone</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">Como escanear</p>
                        <p className="text-slate-500 text-xs">WhatsApp → Menu (⋮) → Aparelhos conectados → Conectar aparelho</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="text-center mt-8">
            <Copyright />
          </div>
        </div>
      </div>
    </>
  );
}
