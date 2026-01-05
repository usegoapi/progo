import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import Swal from 'sweetalert2';

interface Instance {
  id: string;
  name: string;
  status: string;
}

export default function Messages() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [messageType, setMessageType] = useState('text');
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoCaption, setVideoCaption] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [documentFilename, setDocumentFilename] = useState('');
  const [documentCaption, setDocumentCaption] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactOrg, setContactOrg] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [footer, setFooter] = useState('GO-API');
  const [pixAmount, setPixAmount] = useState('');
  const [pixMerchantName, setPixMerchantName] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('email');
  const [pixProductName, setPixProductName] = useState('');
  const [pixTitle, setPixTitle] = useState('Pagamento PIX');
  const [listButtonText, setListButtonText] = useState('Ver opções');
  const [listTitle, setListTitle] = useState('');
  const [listSections, setListSections] = useState([{ title: 'Seção 1', rows: [{ title: '', description: '', rowId: 'row_1' }] }]);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollSelectableCount, setPollSelectableCount] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/instances').then(({ data }) => {
      const arr = Array.isArray(data) ? data : [];
      setInstances(arr);
      const conn = arr.filter((i: Instance) => i.status === 'CONNECTED');
      if (conn.length > 0) setSelectedInstance(conn[0].id);
      else if (arr.length > 0) setSelectedInstance(arr[0].id);
    }).catch(() => setInstances([]));
  }, []);

  const sendMessage = async () => {
    if (!selectedInstance || !to) return;
    setLoading(true);
    try {
      let endpoint = '';
      let payload: any = { instanceId: selectedInstance, to };
      switch (messageType) {
        case 'text': endpoint = '/messages/text'; payload.text = text; break;
        case 'image': endpoint = '/messages/image'; payload.imageUrl = imageUrl; payload.caption = caption; break;
        case 'audio': endpoint = '/messages/audio'; payload.audioUrl = audioUrl; payload.ptt = true; break;
        case 'video': endpoint = '/messages/video'; payload.videoUrl = videoUrl; payload.caption = videoCaption; break;
        case 'document': endpoint = '/messages/document'; payload.documentUrl = documentUrl; payload.filename = documentFilename; payload.caption = documentCaption; break;
        case 'contact': endpoint = '/messages/contact'; payload.contactName = contactName; payload.contactPhone = contactPhone; payload.organization = contactOrg; break;
        case 'location': endpoint = '/messages/location'; payload.latitude = parseFloat(latitude); payload.longitude = parseFloat(longitude); break;
        case 'pix': endpoint = '/messages/pix'; payload.text = text; payload.footer = footer; payload.title = pixTitle; payload.amount = parseFloat(pixAmount); payload.merchantName = pixMerchantName; payload.pixKey = pixKey; payload.pixKeyType = pixKeyType; payload.productName = pixProductName; break;
        case 'list': endpoint = '/messages/list'; payload.text = text; payload.buttonText = listButtonText; payload.title = listTitle; payload.footer = footer; payload.sections = listSections.map(s => ({ title: s.title, rows: s.rows.filter(r => r.title.trim()) })); break;
        case 'poll': endpoint = '/messages/poll'; payload.question = pollQuestion; payload.options = pollOptions.filter(o => o.trim()); payload.selectableCount = pollSelectableCount; break;
      }
      await api.post(endpoint, payload);
      Swal.fire({ icon: 'success', title: 'Enviado!', text: 'Mensagem enviada com sucesso.', background: '#1a1a1a', color: '#fff', confirmButtonColor: '#22c55e', timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Erro!', text: err.response?.data?.message || 'Erro ao enviar', background: '#1a1a1a', color: '#fff', confirmButtonColor: '#ef4444' });
    } finally {
      setLoading(false);
    }
  };

  const messageTypes = [
    { id: 'text', label: 'Texto', icon: 'chat', color: 'from-blue-500 to-blue-600' },
    { id: 'audio', label: 'Áudio', icon: 'mic', color: 'from-purple-500 to-purple-600' },
    { id: 'image', label: 'Imagem', icon: 'image', color: 'from-pink-500 to-pink-600' },
    { id: 'video', label: 'Vídeo', icon: 'videocam', color: 'from-red-500 to-red-600' },
    { id: 'document', label: 'Arquivo', icon: 'description', color: 'from-orange-500 to-orange-600' },
    { id: 'contact', label: 'Contato', icon: 'person', color: 'from-teal-500 to-teal-600' },
    { id: 'location', label: 'Localização', icon: 'location_on', color: 'from-cyan-500 to-cyan-600' },
    { id: 'poll', label: 'Enquete', icon: 'poll', color: 'from-amber-500 to-amber-600' },
    { id: 'list', label: 'Lista', icon: 'list_alt', color: 'from-indigo-500 to-indigo-600' },
    { id: 'pix', label: 'PIX', icon: 'payments', color: 'from-emerald-500 to-emerald-600' },
  ];

  return (
    <Layout>
      <div className="mb-8">
        <h2 className="text-4xl font-black tracking-tight text-white mb-2">Testar API</h2>
        <p className="text-slate-400 text-lg font-light">Teste o envio de mensagens para suas instâncias.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-border-dark bg-surface-dark p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Instância</label>
                <select value={selectedInstance} onChange={(e) => setSelectedInstance(e.target.value)} className="w-full h-12 px-4 bg-[#2a2a2a] text-white border border-[#444] rounded-xl focus:outline-none focus:border-primary">
                  {instances.length === 0 && <option value="">Nenhuma instância</option>}
                  {instances.map((i) => (<option key={i.id} value={i.id}>{i.name} {i.status === 'CONNECTED' ? '🟢' : '🔴'}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Número (com DDD)</label>
                <input type="text" placeholder="5511999999999" value={to} onChange={(e) => setTo(e.target.value)} className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-xl focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">Tipo de Mensagem</label>
              <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                {messageTypes.map((type) => (
                  <button key={type.id} onClick={() => setMessageType(type.id)} className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs font-medium transition-all ${messageType === type.id ? `bg-gradient-to-br ${type.color} text-white shadow-lg scale-105` : 'bg-surface-light text-slate-400 hover:text-white hover:bg-[#252525]'}`}>
                    <span className="material-symbols-outlined text-xl">{type.icon}</span>
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {messageType === 'text' && (
              <div className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl border border-blue-500/20">
                <label className="block text-sm font-medium text-blue-400 mb-2">💬 Mensagem de Texto</label>
                <textarea placeholder="Digite sua mensagem..." value={text} onChange={(e) => setText(e.target.value)} rows={4} className="w-full px-4 py-3 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-blue-500 resize-none" />
              </div>
            )}

            {messageType === 'audio' && (
              <div className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl border border-purple-500/20">
                <label className="block text-sm font-medium text-purple-400 mb-2">🎤 URL do Áudio</label>
                <input type="text" placeholder="https://exemplo.com/audio.mp3" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} className="w-full h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-purple-500" />
              </div>
            )}

            {messageType === 'image' && (
              <div className="p-4 bg-gradient-to-br from-pink-500/10 to-pink-600/5 rounded-xl border border-pink-500/20 space-y-3">
                <div><label className="block text-sm font-medium text-pink-400 mb-2">🖼️ URL da Imagem</label><input type="text" placeholder="https://exemplo.com/imagem.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-pink-500" /></div>
                <div><label className="block text-sm font-medium text-pink-400 mb-2">Legenda (opcional)</label><input type="text" placeholder="Legenda da imagem" value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-pink-500" /></div>
              </div>
            )}

            {messageType === 'video' && (
              <div className="p-4 bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl border border-red-500/20 space-y-3">
                <div><label className="block text-sm font-medium text-red-400 mb-2">🎬 URL do Vídeo</label><input type="text" placeholder="https://exemplo.com/video.mp4" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="w-full h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-red-500" /></div>
                <div><label className="block text-sm font-medium text-red-400 mb-2">Legenda (opcional)</label><input type="text" placeholder="Legenda do vídeo" value={videoCaption} onChange={(e) => setVideoCaption(e.target.value)} className="w-full h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-red-500" /></div>
              </div>
            )}

            {messageType === 'document' && (
              <div className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-xl border border-orange-500/20 space-y-3">
                <div><label className="block text-sm font-medium text-orange-400 mb-2">📄 URL do Arquivo</label><input type="text" placeholder="https://exemplo.com/arquivo.pdf" value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} className="w-full h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-orange-500" /></div>
                <div><label className="block text-sm font-medium text-orange-400 mb-2">Nome do Arquivo</label><input type="text" placeholder="documento.pdf" value={documentFilename} onChange={(e) => setDocumentFilename(e.target.value)} className="w-full h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-orange-500" /></div>
              </div>
            )}

            {messageType === 'contact' && (
              <div className="p-4 bg-gradient-to-br from-teal-500/10 to-teal-600/5 rounded-xl border border-teal-500/20 space-y-3">
                <div><label className="block text-sm font-medium text-teal-400 mb-2">👤 Nome do Contato</label><input type="text" placeholder="João Silva" value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-teal-500" /></div>
                <div><label className="block text-sm font-medium text-teal-400 mb-2">📱 Telefone</label><input type="text" placeholder="5511999999999" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-teal-500" /></div>
                <div><label className="block text-sm font-medium text-teal-400 mb-2">🏢 Organização</label><input type="text" placeholder="Empresa XYZ" value={contactOrg} onChange={(e) => setContactOrg(e.target.value)} className="w-full h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-teal-500" /></div>
              </div>
            )}

            {messageType === 'location' && (
              <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 rounded-xl border border-cyan-500/20">
                <label className="block text-sm font-medium text-cyan-400 mb-3">📍 Coordenadas</label>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Latitude: -23.5505" value={latitude} onChange={(e) => setLatitude(e.target.value)} className="h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-cyan-500" />
                  <input type="text" placeholder="Longitude: -46.6333" value={longitude} onChange={(e) => setLongitude(e.target.value)} className="h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
            )}

            {messageType === 'poll' && (
              <div className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl border border-amber-500/20 space-y-4">
                <div><label className="block text-sm font-medium text-amber-400 mb-2">📊 Pergunta</label><input type="text" placeholder="O que você prefere?" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} className="w-full h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-amber-500" /></div>
                <div>
                  <label className="block text-sm font-medium text-amber-400 mb-2">Opções</label>
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input type="text" placeholder={`Opção ${i + 1}`} value={opt} onChange={(e) => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }} className="flex-1 h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl" />
                      {pollOptions.length > 2 && <button onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))} className="px-3 text-danger">✕</button>}
                    </div>
                  ))}
                  <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-amber-400 text-sm">+ Adicionar opção</button>
                </div>
              </div>
            )}

            {messageType === 'list' && (
              <div className="p-4 bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 rounded-xl border border-indigo-500/20 space-y-4">
                <div><label className="block text-sm font-medium text-indigo-400 mb-2">📋 Mensagem</label><textarea placeholder="Selecione uma opção:" value={text} onChange={(e) => setText(e.target.value)} rows={2} className="w-full px-4 py-3 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl resize-none" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Título" value={listTitle} onChange={(e) => setListTitle(e.target.value)} className="h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl" />
                  <input type="text" placeholder="Texto do Botão" value={listButtonText} onChange={(e) => setListButtonText(e.target.value)} className="h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-indigo-400 mb-2">Seções</label>
                  {listSections.map((sec, si) => (
                    <div key={si} className="p-3 mb-3 bg-[#1a1a1a] rounded-xl border border-[#333]">
                      <div className="flex justify-between items-center mb-2">
                        <input type="text" placeholder="Nome da seção" value={sec.title} onChange={(e) => { const n = [...listSections]; n[si].title = e.target.value; setListSections(n); }} className="flex-1 h-9 px-3 bg-[#252525] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm" />
                        {listSections.length > 1 && <button onClick={() => setListSections(listSections.filter((_, i) => i !== si))} className="ml-2 text-danger text-xs">Remover</button>}
                      </div>
                      {sec.rows.map((row, ri) => (
                        <div key={ri} className="flex gap-2 mb-1">
                          <input type="text" placeholder="Título" value={row.title} onChange={(e) => { const n = [...listSections]; n[si].rows[ri].title = e.target.value; setListSections(n); }} className="flex-1 h-9 px-3 bg-[#252525] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm" />
                          <input type="text" placeholder="Descrição" value={row.description} onChange={(e) => { const n = [...listSections]; n[si].rows[ri].description = e.target.value; setListSections(n); }} className="flex-1 h-9 px-3 bg-[#252525] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm" />
                        </div>
                      ))}
                      <button onClick={() => { const n = [...listSections]; n[si].rows.push({ title: '', description: '', rowId: `row_${Date.now()}` }); setListSections(n); }} className="text-indigo-400 text-xs">+ Item</button>
                    </div>
                  ))}
                  <button onClick={() => setListSections([...listSections, { title: '', rows: [{ title: '', description: '', rowId: `row_${Date.now()}` }] }])} className="text-indigo-400 text-sm">+ Adicionar Seção</button>
                </div>
              </div>
            )}

            {messageType === 'pix' && (
              <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl border border-emerald-500/20 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center"><span className="text-2xl">💳</span></div>
                  <div><h4 className="text-emerald-400 font-semibold">Cobrança PIX</h4><p className="text-xs text-slate-500">Envia mensagem com botão para copiar a chave</p></div>
                </div>
                <div><label className="block text-sm font-medium text-emerald-400 mb-2">Mensagem</label><textarea placeholder="Realize o pagamento via PIX" value={text} onChange={(e) => setText(e.target.value)} rows={2} className="w-full px-4 py-3 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl resize-none" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Pagamento PIX" value={pixTitle} onChange={(e) => setPixTitle(e.target.value)} className="h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl" />
                  <input type="text" placeholder="Nome do Produto" value={pixProductName} onChange={(e) => setPixProductName(e.target.value)} className="h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Valor (R$)" value={pixAmount} onChange={(e) => setPixAmount(e.target.value)} className="h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl" />
                  <input type="text" placeholder="Nome do Recebedor" value={pixMerchantName} onChange={(e) => setPixMerchantName(e.target.value)} className="h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <select value={pixKeyType} onChange={(e) => setPixKeyType(e.target.value)} className="h-11 px-4 bg-[#1a1a1a] text-white border border-[#333] rounded-xl">
                    <option value="email">E-mail</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="phone">Telefone</option><option value="random">Aleatória</option>
                  </select>
                  <input type="text" placeholder="Chave PIX" value={pixKey} onChange={(e) => setPixKey(e.target.value)} className="col-span-2 h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl" />
                </div>
              </div>
            )}

            <button onClick={sendMessage} disabled={loading || !selectedInstance || !to} className="w-full h-14 bg-gradient-to-r from-primary to-green-500 hover:from-primary-hover hover:to-green-400 text-black font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? (<><span className="animate-spin h-5 w-5 border-2 border-black border-t-transparent rounded-full" /> Enviando...</>) : (<><span className="material-symbols-outlined">send</span> Enviar Mensagem</>)}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border-dark bg-surface-dark p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-primary">info</span>Informações</h3>
          <div className="space-y-4 text-sm text-slate-400">
            <div className="p-3 bg-surface-light rounded-xl"><p className="font-medium text-white mb-1">📱 Formato do Número</p><p>Use o formato internacional sem símbolos: 5511999999999</p></div>
            <div className="p-3 bg-surface-light rounded-xl"><p className="font-medium text-white mb-1">🔗 URLs de Mídia</p><p>As URLs devem ser públicas e acessíveis diretamente.</p></div>
            <div className="p-3 bg-surface-light rounded-xl"><p className="font-medium text-white mb-1">📋 Lista</p><p>Único tipo de botão disponível. Crie seções com itens selecionáveis.</p></div>
            <div className="p-3 bg-surface-light rounded-xl"><p className="font-medium text-white mb-1">💳 PIX</p><p>Envia mensagem com botão para copiar a chave PIX automaticamente.</p></div>
          </div>
        </div>
      </div>
      <div className="mt-12 border-t border-border-dark/50 pt-6 text-center"><p className="text-sm text-slate-600">© 2025 GO-API todos direitos reservados.</p></div>
    </Layout>
  );
}
