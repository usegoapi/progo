import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

interface BlockedInfo {
  reason: string;
  machineId: string;
  ip: string;
  contactEmail: string;
}

export default function BlockedPage() {
  const router = useRouter();
  const [info, setInfo] = useState<BlockedInfo>({
    reason: 'Licença bloqueada ou inválida',
    machineId: '',
    ip: '',
    contactEmail: 'suporte@usego.com.br'
  });
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    // Pegar informações da query string
    const { reason, machineId, ip } = router.query;
    if (reason || machineId || ip) {
      setInfo(prev => ({
        ...prev,
        reason: (reason as string) || prev.reason,
        machineId: (machineId as string) || prev.machineId,
        ip: (ip as string) || prev.ip
      }));
    }
  }, [router.query]);

  useEffect(() => {
    // Countdown para tentar novamente
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Tentar verificar licença novamente
          window.location.reload();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <Head>
        <title>Licença Bloqueada - GO-API</title>
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          {/* Ícone de bloqueio animado */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-32 h-32 bg-red-500/20 rounded-full flex items-center justify-center animate-pulse">
                <div className="w-24 h-24 bg-red-500/30 rounded-full flex items-center justify-center">
                  <svg 
                    className="w-16 h-16 text-red-500" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                    />
                  </svg>
                </div>
              </div>
              {/* Círculo pulsante */}
              <div className="absolute inset-0 w-32 h-32 bg-red-500/10 rounded-full animate-ping" />
            </div>
          </div>

          {/* Card principal */}
          <div className="bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-red-500/30 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
              <h1 className="text-2xl font-bold text-white text-center">
                🚫 Acesso Bloqueado
              </h1>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Mensagem principal */}
              <div className="text-center">
                <p className="text-gray-300 text-lg mb-2">
                  Sua licença foi bloqueada ou é inválida.
                </p>
                <p className="text-red-400 font-medium">
                  {info.reason}
                </p>
              </div>

              {/* Informações técnicas */}
              <div className="bg-gray-900/50 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Informações do Sistema
                </h3>
                
                {info.machineId && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Machine ID:</span>
                    <code className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300 font-mono">
                      {info.machineId.substring(0, 16)}...
                    </code>
                  </div>
                )}
                
                {info.ip && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">IP:</span>
                    <code className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300 font-mono">
                      {info.ip}
                    </code>
                  </div>
                )}
              </div>

              {/* Ações */}
              <div className="space-y-3">
                <p className="text-center text-gray-400 text-sm">
                  Tentando reconectar em <span className="text-yellow-400 font-bold">{countdown}s</span>
                </p>

                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${(countdown / 30) * 100}%` }}
                  />
                </div>

                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-bold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02]"
                >
                  Tentar Novamente
                </button>
              </div>

              {/* Contato */}
              <div className="border-t border-gray-700 pt-4">
                <p className="text-center text-gray-500 text-sm">
                  Precisa de ajuda? Entre em contato:
                </p>
                <a 
                  href={`mailto:${info.contactEmail}`}
                  className="block text-center text-yellow-400 hover:text-yellow-300 font-medium mt-1"
                >
                  {info.contactEmail}
                </a>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-gray-600 text-sm mt-6">
            GO-API © {new Date().getFullYear()} - Sistema de Licenciamento
          </p>
        </div>
      </div>
    </>
  );
}
