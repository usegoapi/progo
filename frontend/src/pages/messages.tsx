import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';

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
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [footer, setFooter] = useState('GO-API');
  // Carousel states
  const [carouselBodyText, setCarouselBodyText] = useState('');
  const [carouselCards, setCarouselCards] = useState([
    { imageUrl: '', buttons: [{ type: 'cta_url', displayText: '', url: '' }] }
  ]);
  // PIX states
  const [pixAmount, setPixAmount] = useState('');
  const [pixMerchantName, setPixMerchantName] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('email');
  const [pixProductName, setPixProductName] = useState('');
  const [pixTitle, setPixTitle] = useState('Pagamento PIX');
  // List states
  const [listButtonText, setListButtonText] = useState('Ver opções');
  const [listTitle, setListTitle] = useState('');
  const [listSections, setListSections] = useState([
    { title: 'Seção 1', rows: [{ title: '', description: '', rowId: 'row_1' }] }
  ]);
  // Poll states
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollSelectableCount, setPollSelectableCount] = useState(1);
  // Interactive buttons states
  const [interactiveTitle, setInteractiveTitle] = useState('');
  const [interactiveImageUrl, setInteractiveImageUrl] = useState('');
  const [interactiveButtons, setInteractiveButtons] = useState([
    { type: 'cta_url', displayText: '', url: '', phoneNumber: '', copyCode: '', id: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    api.get('/instances').then(({ data }) => {
      const instancesArray = Array.isArray(data) ? data : [];
      setInstances(instancesArray);
      const connected = instancesArray.filter((i: Instance) => i.status === 'CONNECTED');
      if (connected.length > 0) {
        setSelectedInstance(connected[0].id);
      } else if (instancesArray.length > 0) {
        setSelectedInstance(instancesArray[0].id);
      }
    }).catch(() => setInstances([]));
  }, []);

  const getSelectedInstanceStatus = () => {
    const instance = instances.find(i => i.id === selectedInstance);
    return instance?.status || 'DISCONNECTED';
  };

  const sendMessage = async () => {
    if (!selectedInstance || !to) return;
    setLoading(true);
    setResult(null);

    try {
      let endpoint = '';
      let payload: any = { instanceId: selectedInstance, to };

      switch (messageType) {
        case 'text':
          endpoint = '/messages/text';
          payload.text = text;
          break;
        case 'image':
          endpoint = '/messages/image';
          payload.imageUrl = imageUrl;
          payload.caption = caption;
          break;
        case 'audio':
          endpoint = '/messages/audio';
          payload.audioUrl = audioUrl;
          payload.ptt = true;
          break;
        case 'location':
          endpoint = '/messages/location';
          payload.latitude = parseFloat(latitude);
          payload.longitude = parseFloat(longitude);
          break;
        case 'carousel':
          endpoint = '/messages/carousel';
          payload.bodyText = carouselBodyText;
          payload.cards = carouselCards.filter(c => c.imageUrl.trim()).map(card => ({
            imageUrl: card.imageUrl,
            buttons: card.buttons.filter(b => b.displayText.trim())
          }));
          break;
        case 'pix':
          endpoint = '/messages/pix';
          payload.text = text;
          payload.footer = footer;
          payload.title = pixTitle;
          payload.amount = parseFloat(pixAmount);
          payload.merchantName = pixMerchantName;
          payload.pixKey = pixKey;
          payload.pixKeyType = pixKeyType;
          payload.productName = pixProductName;
          break;
        case 'list':
          endpoint = '/messages/list';
          payload.text = text;
          payload.buttonText = listButtonText;
          payload.title = listTitle;
          payload.footer = footer;
          payload.sections = listSections.map(section => ({
            title: section.title,
            rows: section.rows.filter(r => r.title.trim())
          }));
          break;
        case 'poll':
          endpoint = '/messages/poll';
          payload.question = pollQuestion;
          payload.options = pollOptions.filter(o => o.trim());
          payload.selectableCount = pollSelectableCount;
          break;
        case 'interactive':
          endpoint = '/messages/interactive';
          payload.text = text;
          payload.footer = footer;
          payload.title = interactiveTitle;
          payload.imageUrl = interactiveImageUrl || undefined;
          payload.buttons = interactiveButtons.filter(b => b.displayText.trim()).map(btn => ({
            type: btn.type,
            displayText: btn.displayText,
            url: btn.type === 'cta_url' ? btn.url : undefined,
            phoneNumber: btn.type === 'cta_call' ? btn.phoneNumber : undefined,
            copyCode: btn.type === 'cta_copy' ? btn.copyCode : undefined,
            id: btn.type === 'quick_reply' ? btn.id || btn.displayText : undefined,
          }));
          break;
      }

      await api.post(endpoint, payload);
      setResult({ success: true, message: 'Mensagem enviada com sucesso!' });
    } catch (err: any) {
      setResult({ success: false, message: err.response?.data?.message || 'Erro ao enviar' });
    } finally {
      setLoading(false);
    }
  };

  const messageTypes = [
    { id: 'text', label: 'Texto', icon: 'chat', color: 'from-blue-500 to-blue-600' },
    { id: 'audio', label: 'Áudio', icon: 'mic', color: 'from-purple-500 to-purple-600' },
    { id: 'image', label: 'Imagem', icon: 'image', color: 'from-pink-500 to-pink-600' },
    { id: 'location', label: 'Localização', icon: 'location_on', color: 'from-red-500 to-red-600' },
    { id: 'poll', label: 'Enquete', icon: 'poll', color: 'from-amber-500 to-amber-600' },
    { id: 'carousel', label: 'Carrossel', icon: 'view_carousel', color: 'from-cyan-500 to-cyan-600' },
    { id: 'interactive', label: 'Interativo', icon: 'touch_app', color: 'from-green-500 to-green-600' },
    { id: 'list', label: 'Lista', icon: 'list_alt', color: 'from-indigo-500 to-indigo-600' },
    { id: 'pix', label: 'PIX', icon: 'payments', color: 'from-emerald-500 to-emerald-600' },
  ];

  return (
    <Layout>
      <div className="mb-8">
        <h2 className="text-4xl font-black tracking-tight text-white mb-2">Enviar Mensagens</h2>
        <p className="text-slate-400 text-lg font-light">Teste o envio de mensagens para suas instâncias.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-border-dark bg-surface-dark p-6">
          <div className="space-y-6">
            {/* Instance & Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Instância</label>
                <select value={selectedInstance} onChange={(e) => setSelectedInstance(e.target.value)}
                  className="w-full h-12 px-4 bg-[#2a2a2a] text-white border border-[#444] rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                  {instances.length === 0 && <option value="">Nenhuma instância</option>}
                  {instances.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} {i.status === 'CONNECTED' ? '🟢' : '🔴'}</option>
                  ))}
                </select>
                {selectedInstance && getSelectedInstanceStatus() !== 'CONNECTED' && (
                  <p className="text-danger text-xs mt-1">⚠️ Instância não conectada</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Número (com DDD)</label>
                <input type="text" placeholder="5511999999999" value={to} onChange={(e) => setTo(e.target.value)}
                  className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              </div>
            </div>

            {/* Message Type Grid */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">Tipo de Mensagem</label>
              <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
                {messageTypes.map((type) => (
                  <button key={type.id} onClick={() => setMessageType(type.id)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs font-medium transition-all ${
                      messageType === type.id
                        ? `bg-gradient-to-br ${type.color} text-white shadow-lg scale-105`
                        : 'bg-surface-light text-slate-400 hover:text-white hover:bg-[#252525]'
                    }`}>
                    <span className="material-symbols-outlined text-xl">{type.icon}</span>
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TEXTO */}
            {messageType === 'text' && (
              <div className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl border border-blue-500/20">
                <label className="block text-sm font-medium text-blue-400 mb-2">💬 Mensagem de Texto</label>
                <textarea placeholder="Digite sua mensagem..." value={text} onChange={(e) => setText(e.target.value)} rows={4}
                  className="w-full px-4 py-3 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-blue-500 resize-none" />
              </div>
            )}

            {/* ÁUDIO */}
            {messageType === 'audio' && (
              <div className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl border border-purple-500/20">
                <label className="block text-sm font-medium text-purple-400 mb-2">🎤 URL do Áudio</label>
                <input type="text" placeholder="https://exemplo.com/audio.mp3 ou .ogg" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)}
                  className="w-full h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-purple-500" />
                <p className="text-xs text-slate-500 mt-2">Formatos suportados: MP3, OGG, M4A, WAV</p>
              </div>
            )}

            {/* IMAGEM */}
            {messageType === 'image' && (
              <div className="p-4 bg-gradient-to-br from-pink-500/10 to-pink-600/5 rounded-xl border border-pink-500/20 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-pink-400 mb-2">🖼️ URL da Imagem</label>
                  <input type="text" placeholder="https://exemplo.com/imagem.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-pink-400 mb-2">Legenda (opcional)</label>
                  <input type="text" placeholder="Legenda da imagem" value={caption} onChange={(e) => setCaption(e.target.value)}
                    className="w-full h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-pink-500" />
                </div>
              </div>
            )}

            {/* LOCALIZAÇÃO */}
            {messageType === 'location' && (
              <div className="p-4 bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl border border-red-500/20">
                <label className="block text-sm font-medium text-red-400 mb-3">📍 Coordenadas</label>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Latitude: -23.5505" value={latitude} onChange={(e) => setLatitude(e.target.value)}
                    className="h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-red-500" />
                  <input type="text" placeholder="Longitude: -46.6333" value={longitude} onChange={(e) => setLongitude(e.target.value)}
                    className="h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-red-500" />
                </div>
              </div>
            )}

            {/* ENQUETE */}
            {messageType === 'poll' && (
              <div className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl border border-amber-500/20 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-amber-400 mb-2">📊 Pergunta da Enquete</label>
                  <input type="text" placeholder="O que você prefere?" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)}
                    className="w-full h-12 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-amber-400 mb-2">Opções</label>
                  {pollOptions.map((option, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input type="text" placeholder={`Opção ${index + 1}`} value={option}
                        onChange={(e) => { const n = [...pollOptions]; n[index] = e.target.value; setPollOptions(n); }}
                        className="flex-1 h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-amber-500" />
                      {pollOptions.length > 2 && (
                        <button onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== index))} className="px-3 text-danger hover:text-red-400">✕</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-amber-400 text-sm font-medium hover:text-amber-300">+ Adicionar opção</button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-amber-400 mb-2">Seleções permitidas</label>
                  <input type="number" min="1" max={pollOptions.length} value={pollSelectableCount} onChange={(e) => setPollSelectableCount(parseInt(e.target.value) || 1)}
                    className="w-24 h-11 px-4 bg-[#1a1a1a] text-white border border-[#333] rounded-xl focus:outline-none focus:border-amber-500" />
                </div>
              </div>
            )}

            {/* CARROSSEL */}
            {messageType === 'carousel' && (
              <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 rounded-xl border border-cyan-500/20 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-cyan-400 mb-2">🎠 Texto do Carrossel</label>
                  <textarea placeholder="Confira nossas ofertas!" value={carouselBodyText} onChange={(e) => setCarouselBodyText(e.target.value)} rows={2}
                    className="w-full px-4 py-3 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-cyan-500 resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cyan-400 mb-2">Cards</label>
                  {carouselCards.map((card, ci) => (
                    <div key={ci} className="p-3 mb-3 bg-[#1a1a1a] rounded-xl border border-[#333]">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-slate-400">Card {ci + 1}</span>
                        {carouselCards.length > 1 && (
                          <button onClick={() => setCarouselCards(carouselCards.filter((_, i) => i !== ci))} className="text-danger text-xs">Remover</button>
                        )}
                      </div>
                      <input type="text" placeholder="URL da Imagem" value={card.imageUrl}
                        onChange={(e) => { const n = [...carouselCards]; n[ci].imageUrl = e.target.value; setCarouselCards(n); }}
                        className="w-full h-10 px-3 mb-2 bg-[#252525] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm" />
                      {card.buttons.map((btn, bi) => (
                        <div key={bi} className="flex gap-2 mb-1">
                          <select value={btn.type} onChange={(e) => { const n = [...carouselCards]; n[ci].buttons[bi].type = e.target.value; setCarouselCards(n); }}
                            className="h-9 px-2 bg-[#252525] text-white border border-[#444] rounded-lg text-xs">
                            <option value="cta_url">URL</option>
                            <option value="quick_reply">Resposta</option>
                          </select>
                          <input type="text" placeholder="Texto" value={btn.displayText}
                            onChange={(e) => { const n = [...carouselCards]; n[ci].buttons[bi].displayText = e.target.value; setCarouselCards(n); }}
                            className="flex-1 h-9 px-3 bg-[#252525] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm" />
                          {btn.type === 'cta_url' && (
                            <input type="text" placeholder="URL" value={btn.url}
                              onChange={(e) => { const n = [...carouselCards]; n[ci].buttons[bi].url = e.target.value; setCarouselCards(n); }}
                              className="flex-1 h-9 px-3 bg-[#252525] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm" />
                          )}
                        </div>
                      ))}
                      <button onClick={() => { const n = [...carouselCards]; n[ci].buttons.push({ type: 'cta_url', displayText: '', url: '' }); setCarouselCards(n); }}
                        className="text-cyan-400 text-xs">+ Botão</button>
                    </div>
                  ))}
                  <button onClick={() => setCarouselCards([...carouselCards, { imageUrl: '', buttons: [{ type: 'cta_url', displayText: '', url: '' }] }])}
                    className="text-cyan-400 text-sm font-medium">+ Adicionar Card</button>
                </div>
              </div>
            )}

            {/* INTERATIVO */}
            {messageType === 'interactive' && (
              <div className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl border border-green-500/20 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-green-400 mb-2">👆 Mensagem Interativa</label>
                  <textarea placeholder="Escolha uma ação:" value={text} onChange={(e) => setText(e.target.value)} rows={2}
                    className="w-full px-4 py-3 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-green-500 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Título (opcional)" value={interactiveTitle} onChange={(e) => setInteractiveTitle(e.target.value)}
                    className="h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-green-500" />
                  <input type="text" placeholder="URL Imagem (opcional)" value={interactiveImageUrl} onChange={(e) => setInteractiveImageUrl(e.target.value)}
                    className="h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-green-400 mb-2">Botões</label>
                  {interactiveButtons.map((btn, i) => (
                    <div key={i} className="p-3 mb-2 bg-[#1a1a1a] rounded-xl border border-[#333]">
                      <div className="flex gap-2 mb-2">
                        <select value={btn.type} onChange={(e) => { const n = [...interactiveButtons]; n[i].type = e.target.value; setInteractiveButtons(n); }}
                          className="h-10 px-2 bg-[#252525] text-white border border-[#444] rounded-lg text-xs">
                          <option value="cta_url">🔗 URL</option>
                          <option value="cta_call">📞 Ligar</option>
                          <option value="cta_copy">📋 Copiar</option>
                          <option value="quick_reply">💬 Resposta</option>
                        </select>
                        <input type="text" placeholder="Texto do botão" value={btn.displayText}
                          onChange={(e) => { const n = [...interactiveButtons]; n[i].displayText = e.target.value; setInteractiveButtons(n); }}
                          className="flex-1 h-10 px-3 bg-[#252525] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm" />
                        {interactiveButtons.length > 1 && (
                          <button onClick={() => setInteractiveButtons(interactiveButtons.filter((_, idx) => idx !== i))} className="px-2 text-danger">✕</button>
                        )}
                      </div>
                      {btn.type === 'cta_url' && <input type="text" placeholder="https://exemplo.com" value={btn.url} onChange={(e) => { const n = [...interactiveButtons]; n[i].url = e.target.value; setInteractiveButtons(n); }} className="w-full h-10 px-3 bg-[#252525] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm" />}
                      {btn.type === 'cta_call' && <input type="text" placeholder="+5511999999999" value={btn.phoneNumber} onChange={(e) => { const n = [...interactiveButtons]; n[i].phoneNumber = e.target.value; setInteractiveButtons(n); }} className="w-full h-10 px-3 bg-[#252525] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm" />}
                      {btn.type === 'cta_copy' && <input type="text" placeholder="Código para copiar" value={btn.copyCode} onChange={(e) => { const n = [...interactiveButtons]; n[i].copyCode = e.target.value; setInteractiveButtons(n); }} className="w-full h-10 px-3 bg-[#252525] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm" />}
                    </div>
                  ))}
                  <button onClick={() => setInteractiveButtons([...interactiveButtons, { type: 'cta_url', displayText: '', url: '', phoneNumber: '', copyCode: '', id: '' }])}
                    className="text-green-400 text-sm font-medium">+ Adicionar botão</button>
                </div>
              </div>
            )}

            {/* LISTA */}
            {messageType === 'list' && (
              <div className="p-4 bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 rounded-xl border border-indigo-500/20 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-indigo-400 mb-2">📋 Mensagem da Lista</label>
                  <textarea placeholder="Selecione uma opção:" value={text} onChange={(e) => setText(e.target.value)} rows={2}
                    className="w-full px-4 py-3 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-indigo-500 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Título (opcional)" value={listTitle} onChange={(e) => setListTitle(e.target.value)}
                    className="h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-indigo-500" />
                  <input type="text" placeholder="Texto do Botão" value={listButtonText} onChange={(e) => setListButtonText(e.target.value)}
                    className="h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-indigo-400 mb-2">Seções</label>
                  {listSections.map((section, si) => (
                    <div key={si} className="p-3 mb-3 bg-[#1a1a1a] rounded-xl border border-[#333]">
                      <div className="flex justify-between items-center mb-2">
                        <input type="text" placeholder="Nome da seção" value={section.title}
                          onChange={(e) => { const n = [...listSections]; n[si].title = e.target.value; setListSections(n); }}
                          className="flex-1 h-9 px-3 bg-[#252525] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm" />
                        {listSections.length > 1 && (
                          <button onClick={() => setListSections(listSections.filter((_, i) => i !== si))} className="ml-2 text-danger text-xs">Remover</button>
                        )}
                      </div>
                      {section.rows.map((row, ri) => (
                        <div key={ri} className="flex gap-2 mb-1">
                          <input type="text" placeholder="Título" value={row.title}
                            onChange={(e) => { const n = [...listSections]; n[si].rows[ri].title = e.target.value; setListSections(n); }}
                            className="flex-1 h-9 px-3 bg-[#252525] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm" />
                          <input type="text" placeholder="Descrição" value={row.description}
                            onChange={(e) => { const n = [...listSections]; n[si].rows[ri].description = e.target.value; setListSections(n); }}
                            className="flex-1 h-9 px-3 bg-[#252525] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm" />
                        </div>
                      ))}
                      <button onClick={() => { const n = [...listSections]; n[si].rows.push({ title: '', description: '', rowId: `row_${Date.now()}` }); setListSections(n); }}
                        className="text-indigo-400 text-xs">+ Item</button>
                    </div>
                  ))}
                  <button onClick={() => setListSections([...listSections, { title: '', rows: [{ title: '', description: '', rowId: `row_${Date.now()}` }] }])}
                    className="text-indigo-400 text-sm font-medium">+ Adicionar Seção</button>
                </div>
              </div>
            )}

            {/* PIX */}
            {messageType === 'pix' && (
              <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl border border-emerald-500/20 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-2xl">💳</span>
                  </div>
                  <div>
                    <h4 className="text-emerald-400 font-semibold">Cobrança PIX</h4>
                    <p className="text-xs text-slate-500">Envia mensagem com botão para copiar a chave</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-emerald-400 mb-2">Mensagem</label>
                  <textarea placeholder="Realize o pagamento via PIX" value={text} onChange={(e) => setText(e.target.value)} rows={2}
                    className="w-full px-4 py-3 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-emerald-500 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Título (ex: Pagamento PIX)" value={pixTitle} onChange={(e) => setPixTitle(e.target.value)}
                    className="h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-emerald-500" />
                  <input type="number" step="0.01" placeholder="Valor R$" value={pixAmount} onChange={(e) => setPixAmount(e.target.value)}
                    className="h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-emerald-500" />
                </div>
                <input type="text" placeholder="Nome do Comerciante" value={pixMerchantName} onChange={(e) => setPixMerchantName(e.target.value)}
                  className="w-full h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-emerald-500" />
                <input type="text" placeholder="Nome do Produto (opcional)" value={pixProductName} onChange={(e) => setPixProductName(e.target.value)}
                  className="w-full h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-emerald-500" />
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                  <label className="block text-sm font-medium text-emerald-400 mb-2">🔑 Chave PIX (será copiada ao clicar no botão)</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="email@exemplo.com ou CPF ou telefone" value={pixKey} onChange={(e) => setPixKey(e.target.value)}
                      className="flex-1 h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-emerald-500" />
                    <select value={pixKeyType} onChange={(e) => setPixKeyType(e.target.value)}
                      className="h-11 px-3 bg-[#1a1a1a] text-white border border-[#333] rounded-xl focus:outline-none focus:border-emerald-500">
                      <option value="email">Email</option>
                      <option value="cpf">CPF</option>
                      <option value="phone">Telefone</option>
                      <option value="random">Aleatória</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className={`p-4 rounded-xl text-sm flex items-center gap-3 ${
                result.success ? 'bg-success/10 text-success border border-success/20' : 'bg-danger/10 text-danger border border-danger/20'
              }`}>
                <span className="material-symbols-outlined">{result.success ? 'check_circle' : 'error'}</span>
                {result.message}
              </div>
            )}

            {/* Send Button */}
            <button onClick={sendMessage} disabled={loading || !selectedInstance || !to}
              className="w-full h-14 bg-gradient-to-r from-primary to-primary-hover text-black font-bold rounded-xl shadow-lg hover:shadow-primary/30 transition-all duration-200 transform active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-lg">
              {loading ? (
                <><span className="animate-spin">⏳</span> Enviando...</>
              ) : (
                <><span className="material-symbols-outlined text-2xl">send</span> Enviar Mensagem</>
              )}
            </button>
          </div>
        </div>

        {/* Info Panel */}
        <div className="rounded-2xl border border-border-dark bg-surface-dark p-6 h-fit">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">tips_and_updates</span>
            </div>
            <h3 className="text-lg font-bold text-white">Dicas</h3>
          </div>
          <div className="space-y-3 text-sm text-slate-400">
            <div className="p-3 bg-surface-light rounded-lg">
              <strong className="text-white block mb-1">📱 Número</strong>
              Formato internacional com DDD (5511999999999)
            </div>
            <div className="p-3 bg-surface-light rounded-lg">
              <strong className="text-white block mb-1">🎤 Áudio</strong>
              Use URLs públicas. Formatos: MP3, OGG, M4A
            </div>
            <div className="p-3 bg-surface-light rounded-lg">
              <strong className="text-white block mb-1">💳 PIX</strong>
              Envia botão interativo para copiar a chave
            </div>
            <div className="p-3 bg-surface-light rounded-lg">
              <strong className="text-white block mb-1">👆 Interativo</strong>
              Botões de URL, ligar, copiar ou resposta
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 border-t border-border-dark/50 pt-6 text-center">
        <p className="text-sm text-slate-600">© 2025 GO-API todos direitos reservados.</p>
      </div>
    </Layout>
  );
}