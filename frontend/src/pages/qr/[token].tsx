import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import api from '@/lib/api';

export default function SharedQRCode() {
  const router = useRouter();
  const { token } = router.query;
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchQR = async () => {
      try {
        const { data } = await api.get(`/instances/shared/${token}`);
        
        if (data.status === 'CONNECTED') {
          if (!connected) {
            setConnecting(true);
            setTimeout(() => {
              setConnecting(false);
              setConnected(true);
              setQrCode(null);
              setInstanceName(data.instanceName || 'Instância');
            }, 1500);
          }
          setLoading(false);
          return;
        }
        
        setQrCode(data.qrCode);
        setInstanceName(data.instanceName || 'Instância');
        setLoading(false);

        pollRef.current = setTimeout(fetchQR, 2000);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Link inválido ou expirado');
        setLoading(false);
      }
    };

    fetchQR();

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [token, connected]);

  return (
    <>
      <Head>
        <title>Escanear QR Code - GO-API</title>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </Head>
      
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[150px] pointer-events-none" />
        
        <div className="w-full max-w-md relative z-10">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src="/img/logosite.png"
              alt="GO-API Logo"
              className="h-14 w-auto mx-auto"
              style={{ imageRendering: 'crisp-edges' }}
            />
          </div>

          {/* Card */}
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
            {/* Card glow effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
            
            <div className="relative z-10">
              {loading ? (
                <div className="py-16">
                  <div className="relative mx-auto w-20 h-20 mb-6">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
                    <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-primary/50 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                  </div>
                  <p className="text-slate-400 text-lg font-medium">Carregando...</p>
                </div>
              ) : error ? (
                <div className="py-12">
                  <div className="h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6 ring-4 ring-red-500/20">
                    <span className="material-symbols-outlined text-red-500 text-5xl">error</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-3">Ops!</h2>
                  <p className="text-slate-400 mb-6">{error}</p>
                  <button
                    onClick={() => router.push('/')}
                    className="px-6 py-2.5 bg-[#1f1f1f] text-slate-300 rounded-xl border border-[#2a2a2a] hover:bg-[#252525] hover:text-white transition-all text-sm font-medium"
                  >
                    Voltar ao início
                  </button>
                </div>
              ) : connecting ? (
                <div className="py-16">
                  <div className="relative mx-auto w-24 h-24 mb-6">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <div className="relative h-full w-full rounded-full bg-primary/10 flex items-center justify-center border border-primary/30">
                      <span className="material-symbols-outlined text-primary text-4xl animate-pulse">sync</span>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Conectando...</h2>
                  <p className="text-slate-400 mb-4">QR Code escaneado com sucesso!</p>
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              ) : connected ? (
                <div className="py-12">
                  <div className="relative mx-auto w-24 h-24 mb-6">
                    <div className="absolute inset-0 rounded-full bg-green-500/20 animate-pulse" />
                    <div className="relative h-full w-full rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                      <span className="material-symbols-outlined text-white text-5xl">check</span>
                    </div>
                  </div>
                  <h2 className="text-3xl font-black text-white mb-3">Conectado!</h2>
                  <p className="text-slate-400 mb-6">
                    A instância <span className="text-primary font-bold">{instanceName}</span> está online.
                  </p>
                  <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-500 px-4 py-2 rounded-full border border-green-500/20">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                    </span>
                    <span className="font-bold text-sm">Online</span>
                  </div>
                </div>
              ) : (
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
                      {/* Glow effect */}
                      <div className="absolute -inset-4 bg-primary/10 blur-2xl rounded-full" />
                      {/* QR Container */}
                      <div className="relative bg-white p-5 rounded-2xl shadow-2xl ring-1 ring-white/10">
                        <img src={qrCode} alt="QR Code" className="w-56 h-56 sm:w-64 sm:h-64" />
                      </div>
                      {/* Scanning indicator */}
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#161616] px-4 py-2 rounded-full border border-[#2a2a2a] shadow-lg">
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

                  {/* Instructions */}
                  <div className="bg-[#1f1f1f] rounded-xl p-4 border border-[#2a2a2a] mt-4">
                    <div className="flex items-center gap-3 text-left">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-primary">smartphone</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">Como escanear</p>
                        <p className="text-slate-500 text-xs">
                          WhatsApp → Menu (⋮) → Aparelhos conectados → Conectar
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-slate-600 text-xs mt-8">
            © 2025 GO-API todos direitos reservados.
          </p>
        </div>
      </div>

      <style jsx global>{`
        :root {
          --primary: #eaa800;
          --primary-hover: #dba000;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: #0d0d0d;
        }
        .bg-primary {
          background-color: #eaa800;
        }
        .bg-primary\\/3 {
          background-color: rgba(234, 168, 0, 0.03);
        }
        .bg-primary\\/5 {
          background-color: rgba(234, 168, 0, 0.05);
        }
        .bg-primary\\/10 {
          background-color: rgba(234, 168, 0, 0.1);
        }
        .bg-primary\\/20 {
          background-color: rgba(234, 168, 0, 0.2);
        }
        .text-primary {
          color: #eaa800;
        }
        .border-primary {
          border-color: #eaa800;
        }
        .border-primary\\/20 {
          border-color: rgba(234, 168, 0, 0.2);
        }
        .border-primary\\/30 {
          border-color: rgba(234, 168, 0, 0.3);
        }
        .border-t-primary {
          border-top-color: #eaa800;
        }
        .ring-primary\\/20 {
          --tw-ring-color: rgba(234, 168, 0, 0.2);
        }
        .from-primary\\/5 {
          --tw-gradient-from: rgba(234, 168, 0, 0.05);
        }
        .from-primary\\/20 {
          --tw-gradient-from: rgba(234, 168, 0, 0.2);
        }
        .to-primary\\/5 {
          --tw-gradient-to: rgba(234, 168, 0, 0.05);
        }
      `}</style>
    </>
  );
}
