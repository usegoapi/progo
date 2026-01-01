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
  const [buttons, setButtons] = useState([{ text: '' }]);
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
      // Mostrar todas as instâncias, mas indicar quais estão conectadas
      setInstances(data);
      const connected = data.filter((i: Instance) => i.status === 'CONNECTED');
      if (connected.length > 0) {
        setSelectedInstance(connected[0].id);
      } else if (data.length > 0) {
        setSelectedInstance(data[0].id);
      }
    }).catch(() => {});
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
        case 'buttons':
          endpoint = '/messages/buttons';
          payload.text = text;
          payload.footer = footer;
          payload.buttons = buttons.filter((b) => b.text.trim());
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
    { id: 'text', label: 'Texto', icon: 'chat' },
    { id: 'image', label: 'Imagem', icon: 'image' },
    { id: 'audio', label: 'Áudio', icon: 'mic' },
    { id: 'location', label: 'Localização', icon: 'location_on' },
    { id: 'buttons', label: 'Botões', icon: 'smart_button' },
    { id: 'carousel', label: 'Carrossel', icon: 'view_carousel' },
    { id: 'pix', label: 'PIX', icon: 'payments' },
    { id: 'list', label: 'Lista', icon: 'list_alt' },
    { id: 'poll', label: 'Enquete', icon: 'poll' },
    { id: 'interactive', label: 'Interativo', icon: 'touch_app' },
  ];

  return (
    <Layout>
      <div className="mb-10">
        <h2 className="text-4xl font-black tracking-tight text-white mb-2">Enviar Mensagens</h2>
        <p className="text-slate-400 text-lg font-light">
          Teste o envio de mensagens para suas instâncias conectadas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message Form */}
        <div className="lg:col-span-2 rounded-2xl border border-border-dark bg-surface-dark p-6">
          <div className="space-y-6">
            {/* Instance & Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Instância</label>
                <select
                  value={selectedInstance}
                  onChange={(e) => setSelectedInstance(e.target.value)}
                  className="w-full h-12 px-4 bg-[#2a2a2a] text-white border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                >
                  {instances.length === 0 && <option value="">Nenhuma instância</option>}
                  {instances.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} {i.status === 'CONNECTED' ? '🟢' : '🔴'}
                    </option>
                  ))}
                </select>
                {selectedInstance && getSelectedInstanceStatus() !== 'CONNECTED' && (
                  <p className="text-danger text-xs mt-1">⚠️ Esta instância não está conectada</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Número (com DDD)
                </label>
                <input
                  type="text"
                  placeholder="5511999999999"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                />
              </div>
            </div>

            {/* Message Type Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tipo de Mensagem
              </label>
              <div className="flex flex-wrap gap-2">
                {messageTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setMessageType(type.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      messageType === type.id
                        ? 'bg-primary text-black'
                        : 'bg-surface-light text-slate-400 hover:text-white hover:bg-[#252525]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{type.icon}</span>
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Fields */}
            {messageType === 'text' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Mensagem</label>
                <textarea
                  placeholder="Digite sua mensagem..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm resize-none"
                />
              </div>
            )}

            {messageType === 'image' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    URL da Imagem
                  </label>
                  <input
                    type="text"
                    placeholder="https://exemplo.com/imagem.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Legenda (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Legenda da imagem"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                  />
                </div>
              </div>
            )}

            {messageType === 'audio' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">URL do Áudio</label>
                <input
                  type="text"
                  placeholder="https://exemplo.com/audio.mp3"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                />
              </div>
            )}

            {messageType === 'location' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Latitude</label>
                  <input
                    type="text"
                    placeholder="-23.5505"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Longitude</label>
                  <input
                    type="text"
                    placeholder="-46.6333"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                  />
                </div>
              </div>
            )}

            {messageType === 'buttons' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Texto da Mensagem
                  </label>
                  <textarea
                    placeholder="Escolha uma opção:"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Footer</label>
                  <input
                    type="text"
                    placeholder="GO-API"
                    value={footer}
                    onChange={(e) => setFooter(e.target.value)}
                    className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Botões</label>
                  {buttons.map((btn, i) => (
                    <input
                      key={i}
                      type="text"
                      placeholder={`Botão ${i + 1}`}
                      value={btn.text}
                      onChange={(e) => {
                        const newButtons = [...buttons];
                        newButtons[i].text = e.target.value;
                        setButtons(newButtons);
                      }}
                      className="w-full h-12 px-4 mb-2 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setButtons([...buttons, { text: '' }])}
                    className="text-primary text-sm font-medium hover:text-primary-hover transition-colors"
                  >
                    + Adicionar botão
                  </button>
                </div>
              </div>
            )}

            {messageType === 'carousel' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Texto do Corpo
                  </label>
                  <textarea
                    placeholder="Confira nossas ofertas!"
                    value={carouselBodyText}
                    onChange={(e) => setCarouselBodyText(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm resize-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Cards do Carrossel
                  </label>
                  {carouselCards.map((card, cardIndex) => (
                    <div key={cardIndex} className="p-4 mb-3 bg-[#1a1a1a] rounded-lg border border-[#333]">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-slate-400">Card {cardIndex + 1}</span>
                        {carouselCards.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newCards = carouselCards.filter((_, i) => i !== cardIndex);
                              setCarouselCards(newCards);
                            }}
                            className="text-danger text-xs hover:text-red-400"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                      
                      <input
                        type="text"
                        placeholder="URL da Imagem"
                        value={card.imageUrl}
                        onChange={(e) => {
                          const newCards = [...carouselCards];
                          newCards[cardIndex].imageUrl = e.target.value;
                          setCarouselCards(newCards);
                        }}
                        className="w-full h-10 px-3 mb-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary text-sm"
                      />
                      
                      <div className="space-y-2">
                        <span className="text-xs text-slate-500">Botões do Card:</span>
                        {card.buttons.map((btn, btnIndex) => (
                          <div key={btnIndex} className="flex gap-2">
                            <select
                              value={btn.type}
                              onChange={(e) => {
                                const newCards = [...carouselCards];
                                newCards[cardIndex].buttons[btnIndex].type = e.target.value;
                                setCarouselCards(newCards);
                              }}
                              className="h-10 px-2 bg-[#2a2a2a] text-white border border-[#444] rounded-lg text-xs"
                            >
                              <option value="cta_url">URL</option>
                              <option value="quick_reply">Resposta</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Texto do botão"
                              value={btn.displayText}
                              onChange={(e) => {
                                const newCards = [...carouselCards];
                                newCards[cardIndex].buttons[btnIndex].displayText = e.target.value;
                                setCarouselCards(newCards);
                              }}
                              className="flex-1 h-10 px-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm"
                            />
                            {btn.type === 'cta_url' && (
                              <input
                                type="text"
                                placeholder="URL"
                                value={btn.url}
                                onChange={(e) => {
                                  const newCards = [...carouselCards];
                                  newCards[cardIndex].buttons[btnIndex].url = e.target.value;
                                  setCarouselCards(newCards);
                                }}
                                className="flex-1 h-10 px-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm"
                              />
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const newCards = [...carouselCards];
                            newCards[cardIndex].buttons.push({ type: 'cta_url', displayText: '', url: '' });
                            setCarouselCards(newCards);
                          }}
                          className="text-primary text-xs hover:text-primary-hover"
                        >
                          + Adicionar botão
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => setCarouselCards([...carouselCards, { imageUrl: '', buttons: [{ type: 'cta_url', displayText: '', url: '' }] }])}
                    className="text-primary text-sm font-medium hover:text-primary-hover transition-colors"
                  >
                    + Adicionar Card
                  </button>
                </div>
              </div>
            )}

            {messageType === 'pix' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Mensagem</label>
                  <textarea
                    placeholder="Realize o pagamento via PIX"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Título</label>
                    <input
                      type="text"
                      placeholder="Pagamento PIX"
                      value={pixTitle}
                      onChange={(e) => setPixTitle(e.target.value)}
                      className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="99.90"
                      value={pixAmount}
                      onChange={(e) => setPixAmount(e.target.value)}
                      className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Nome do Comerciante</label>
                  <input
                    type="text"
                    placeholder="Loja Exemplo"
                    value={pixMerchantName}
                    onChange={(e) => setPixMerchantName(e.target.value)}
                    className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Chave PIX</label>
                    <input
                      type="text"
                      placeholder="email@exemplo.com"
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                      className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Tipo</label>
                    <select
                      value={pixKeyType}
                      onChange={(e) => setPixKeyType(e.target.value)}
                      className="w-full h-12 px-4 bg-[#2a2a2a] text-white border border-[#444] rounded-lg focus:outline-none focus:border-primary text-sm"
                    >
                      <option value="email">Email</option>
                      <option value="cpf">CPF</option>
                      <option value="phone">Telefone</option>
                      <option value="random">Aleatória</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Produto (opcional)</label>
                  <input
                    type="text"
                    placeholder="Nome do produto"
                    value={pixProductName}
                    onChange={(e) => setPixProductName(e.target.value)}
                    className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary text-sm"
                  />
                </div>
              </div>
            )}

            {messageType === 'list' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Mensagem</label>
                  <textarea
                    placeholder="Selecione uma opção:"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Título (opcional)</label>
                    <input
                      type="text"
                      placeholder="Menu"
                      value={listTitle}
                      onChange={(e) => setListTitle(e.target.value)}
                      className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Texto do Botão</label>
                    <input
                      type="text"
                      placeholder="Ver opções"
                      value={listButtonText}
                      onChange={(e) => setListButtonText(e.target.value)}
                      className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Seções</label>
                  {listSections.map((section, sectionIndex) => (
                    <div key={sectionIndex} className="p-4 mb-3 bg-[#1a1a1a] rounded-lg border border-[#333]">
                      <div className="flex justify-between items-center mb-3">
                        <input
                          type="text"
                          placeholder="Nome da seção"
                          value={section.title}
                          onChange={(e) => {
                            const newSections = [...listSections];
                            newSections[sectionIndex].title = e.target.value;
                            setListSections(newSections);
                          }}
                          className="flex-1 h-10 px-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm"
                        />
                        {listSections.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setListSections(listSections.filter((_, i) => i !== sectionIndex))}
                            className="ml-2 text-danger text-xs hover:text-red-400"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                      {section.rows.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            placeholder="Título"
                            value={row.title}
                            onChange={(e) => {
                              const newSections = [...listSections];
                              newSections[sectionIndex].rows[rowIndex].title = e.target.value;
                              setListSections(newSections);
                            }}
                            className="flex-1 h-10 px-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Descrição"
                            value={row.description}
                            onChange={(e) => {
                              const newSections = [...listSections];
                              newSections[sectionIndex].rows[rowIndex].description = e.target.value;
                              setListSections(newSections);
                            }}
                            className="flex-1 h-10 px-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const newSections = [...listSections];
                          newSections[sectionIndex].rows.push({ title: '', description: '', rowId: `row_${Date.now()}` });
                          setListSections(newSections);
                        }}
                        className="text-primary text-xs hover:text-primary-hover"
                      >
                        + Adicionar item
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setListSections([...listSections, { title: '', rows: [{ title: '', description: '', rowId: `row_${Date.now()}` }] }])}
                    className="text-primary text-sm font-medium hover:text-primary-hover"
                  >
                    + Adicionar Seção
                  </button>
                </div>
              </div>
            )}

            {messageType === 'poll' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Pergunta</label>
                  <input
                    type="text"
                    placeholder="O que você prefere?"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Opções</label>
                  {pollOptions.map((option, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder={`Opção ${index + 1}`}
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...pollOptions];
                          newOptions[index] = e.target.value;
                          setPollOptions(newOptions);
                        }}
                        className="flex-1 h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary text-sm"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== index))}
                          className="px-3 text-danger hover:text-red-400"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ''])}
                    className="text-primary text-sm font-medium hover:text-primary-hover"
                  >
                    + Adicionar opção
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Seleções permitidas</label>
                  <input
                    type="number"
                    min="1"
                    max={pollOptions.length}
                    value={pollSelectableCount}
                    onChange={(e) => setPollSelectableCount(parseInt(e.target.value) || 1)}
                    className="w-24 h-12 px-4 bg-[#2a2a2a] text-white border border-[#444] rounded-lg focus:outline-none focus:border-primary text-sm"
                  />
                </div>
              </div>
            )}

            {messageType === 'interactive' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Mensagem</label>
                  <textarea
                    placeholder="Escolha uma ação:"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Título (opcional)</label>
                    <input
                      type="text"
                      placeholder="Título"
                      value={interactiveTitle}
                      onChange={(e) => setInteractiveTitle(e.target.value)}
                      className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Imagem (opcional)</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={interactiveImageUrl}
                      onChange={(e) => setInteractiveImageUrl(e.target.value)}
                      className="w-full h-12 px-4 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Botões Interativos</label>
                  {interactiveButtons.map((btn, index) => (
                    <div key={index} className="p-3 mb-2 bg-[#1a1a1a] rounded-lg border border-[#333]">
                      <div className="flex gap-2 mb-2">
                        <select
                          value={btn.type}
                          onChange={(e) => {
                            const newButtons = [...interactiveButtons];
                            newButtons[index].type = e.target.value;
                            setInteractiveButtons(newButtons);
                          }}
                          className="h-10 px-2 bg-[#2a2a2a] text-white border border-[#444] rounded-lg text-xs"
                        >
                          <option value="cta_url">🔗 URL</option>
                          <option value="cta_call">📞 Ligar</option>
                          <option value="cta_copy">📋 Copiar</option>
                          <option value="quick_reply">💬 Resposta</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Texto do botão"
                          value={btn.displayText}
                          onChange={(e) => {
                            const newButtons = [...interactiveButtons];
                            newButtons[index].displayText = e.target.value;
                            setInteractiveButtons(newButtons);
                          }}
                          className="flex-1 h-10 px-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm"
                        />
                        {interactiveButtons.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setInteractiveButtons(interactiveButtons.filter((_, i) => i !== index))}
                            className="px-2 text-danger hover:text-red-400"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {btn.type === 'cta_url' && (
                        <input
                          type="text"
                          placeholder="https://exemplo.com"
                          value={btn.url}
                          onChange={(e) => {
                            const newButtons = [...interactiveButtons];
                            newButtons[index].url = e.target.value;
                            setInteractiveButtons(newButtons);
                          }}
                          className="w-full h-10 px-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm"
                        />
                      )}
                      {btn.type === 'cta_call' && (
                        <input
                          type="text"
                          placeholder="+5511999999999"
                          value={btn.phoneNumber}
                          onChange={(e) => {
                            const newButtons = [...interactiveButtons];
                            newButtons[index].phoneNumber = e.target.value;
                            setInteractiveButtons(newButtons);
                          }}
                          className="w-full h-10 px-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm"
                        />
                      )}
                      {btn.type === 'cta_copy' && (
                        <input
                          type="text"
                          placeholder="Código para copiar"
                          value={btn.copyCode}
                          onChange={(e) => {
                            const newButtons = [...interactiveButtons];
                            newButtons[index].copyCode = e.target.value;
                            setInteractiveButtons(newButtons);
                          }}
                          className="w-full h-10 px-3 bg-[#2a2a2a] text-white placeholder-gray-500 border border-[#444] rounded-lg text-sm"
                        />
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setInteractiveButtons([...interactiveButtons, { type: 'cta_url', displayText: '', url: '', phoneNumber: '', copyCode: '', id: '' }])}
                    className="text-primary text-sm font-medium hover:text-primary-hover"
                  >
                    + Adicionar botão
                  </button>
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div
                className={`p-4 rounded-lg text-sm ${
                  result.success
                    ? 'bg-success/10 text-success border border-success/20'
                    : 'bg-danger/10 text-danger border border-danger/20'
                }`}
              >
                {result.message}
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={sendMessage}
              disabled={loading || !selectedInstance || !to || getSelectedInstanceStatus() !== 'CONNECTED'}
              className="w-full h-12 bg-primary hover:bg-primary-hover text-black font-bold rounded-lg shadow-lg hover:shadow-primary/20 transition-all duration-200 transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                'Enviando...'
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">send</span>
                  Enviar Mensagem
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info Panel */}
        <div className="rounded-2xl border border-border-dark bg-surface-dark p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">info</span>
            </div>
            <h3 className="text-lg font-bold text-white">Dicas</h3>
          </div>

          <div className="space-y-4 text-sm text-slate-400">
            <p>
              <strong className="text-white">Número:</strong> Use o formato internacional com DDD
              (ex: 5511999999999)
            </p>
            <p>
              <strong className="text-white">Imagem/Áudio:</strong> Use URLs públicas acessíveis
            </p>
            <p>
              <strong className="text-white">Botões:</strong> Ideal para menus interativos e
              pagamentos PIX
            </p>
            <p>
              <strong className="text-white">Carrossel:</strong> Até 10 cards com imagens e botões
              interativos (URL ou resposta rápida)
            </p>
            <p>
              <strong className="text-white">PIX:</strong> Envie cobranças com botão de pagamento
              e código para copiar
            </p>
            <p>
              <strong className="text-white">Lista:</strong> Menu com seções e itens selecionáveis
            </p>
            <p>
              <strong className="text-white">Enquete:</strong> Crie votações com múltiplas opções
            </p>
            <p>
              <strong className="text-white">Interativo:</strong> Botões de URL, ligar, copiar código
              ou resposta rápida
            </p>
          </div>
        </div>
      </div>
      {/* Footer */}
      <div className="mt-12 border-t border-border-dark/50 pt-6 text-center">
        <p className="text-sm text-slate-600">© 2025 GO-API todos direitos reservados.</p>
      </div>
    </Layout>
  );
}
