import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import Layout from '@/components/Layout';
import api, { apiErrorMessage } from '@/lib/api';
import { brandColor, Copyright } from '@/lib/branding';

// ───────────────────────────── Tipos ─────────────────────────────

interface Instance {
  id: string;
  name: string;
  status: string;
  phone: string | null;
}

type MessageType = 'text' | 'audio' | 'image' | 'video' | 'document' | 'contact' | 'location' | 'poll' | 'buttons' | 'catalog';
type ButtonKind = 'reply' | 'url' | 'call' | 'copy';
type CatalogMode = 'catalog' | 'product';

interface ButtonDraft {
  key: string;
  type: ButtonKind;
  text: string;
  id: string;
  url: string;
  phoneNumber: string;
  copyCode: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  priceFormatted: string;
  imageUrl: string | null;
  url: string | null;
  available: boolean;
}

interface ProductForm {
  /** ID numérico ou link do produto (wa.me/p/<ID>/<telefone>). */
  ref: string;
  title: string;
  price: string;
  currency: string;
  imageUrl: string;
  description: string;
}

const EMPTY_PRODUCT: ProductForm = { ref: '', title: '', price: '', currency: 'BRL', imageUrl: '', description: '' };

/** Extrai o ID do produto de "123456", "wa.me/p/123456/5511..." ou da URL completa. */
const parseProductId = (ref: string): string => {
  const value = ref.trim();
  const fromLink = /wa\.me\/p\/(\d{6,30})/i.exec(value)?.[1];
  if (fromLink) return fromLink;
  return /^\d{6,30}$/.test(value) ? value : '';
};

const parsePrice = (value: string): number | null => {
  const normalized = value.trim().replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

const formatMoney = (value: number | null, currency: string) => {
  if (value === null) return '';
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};

interface SendResult {
  messageId: string | null;
  status: string;
  type: string;
  to: string;
  at: string;
}

const TYPES: Array<{ id: MessageType; label: string; icon: string }> = [
  { id: 'text', label: 'Texto', icon: 'chat' },
  { id: 'image', label: 'Imagem', icon: 'image' },
  { id: 'audio', label: 'Áudio', icon: 'mic' },
  { id: 'video', label: 'Vídeo', icon: 'videocam' },
  { id: 'document', label: 'Arquivo', icon: 'description' },
  { id: 'contact', label: 'Contato', icon: 'person' },
  { id: 'location', label: 'Localização', icon: 'location_on' },
  { id: 'poll', label: 'Enquete', icon: 'poll' },
  { id: 'buttons', label: 'Botões', icon: 'smart_button' },
  { id: 'catalog', label: 'Catálogo', icon: 'storefront' },
];

const BUTTON_KINDS: Array<{ id: ButtonKind; label: string; icon: string; hint: string }> = [
  { id: 'reply', label: 'Resposta', icon: 'reply', hint: 'O toque volta como mensagem (com o ID)' },
  { id: 'url', label: 'Link', icon: 'open_in_new', hint: 'Abre um endereço' },
  { id: 'call', label: 'Ligar', icon: 'call', hint: 'Liga para um número' },
  { id: 'copy', label: 'Copiar', icon: 'content_copy', hint: 'Copia um código (cupom, Pix...)' },
];

const MAX_BUTTONS = 10;
const BUTTON_TEXT_MAX = 25;

const newButton = (type: ButtonKind = 'reply', index = 0): ButtonDraft => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type,
  text: '',
  id: `opcao_${index + 1}`,
  url: '',
  phoneNumber: '',
  copyCode: '',
});

const isHttpUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());
const onlyDigits = (value: string) => value.replace(/\D/g, '');

const notify = (icon: 'success' | 'error' | 'warning', title: string, text?: string) =>
  Swal.fire({ icon, title, text, background: '#1a1a1a', color: '#fff', confirmButtonColor: brandColor() });

// ───────────────────────────── Componentes de formulário ─────────────────────────────

const inputClass =
  'w-full h-11 px-4 bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#333] rounded-xl focus:outline-none focus:border-primary transition-colors text-sm';

function Field({ label, hint, children, counter }: { label: string; hint?: string; counter?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        {counter && <span className="text-[11px] text-slate-500 tabular-nums">{counter}</span>}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-xl border border-primary/20 bg-primary/[0.04] space-y-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-primary">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
        {title}
      </p>
      {children}
    </div>
  );
}

// ───────────────────────────── Página ─────────────────────────────

export default function Messages() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [instanceId, setInstanceId] = useState('');
  const [type, setType] = useState<MessageType>('text');
  const [to, setTo] = useState('');
  const [delay, setDelay] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<SendResult | null>(null);

  // Conteúdo
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [filename, setFilename] = useState('');
  const [contact, setContact] = useState({ name: '', phone: '', organization: '' });
  const [location, setLocation] = useState({ latitude: '', longitude: '', name: '' });
  const [poll, setPoll] = useState({ question: '', options: ['', ''], selectableCount: 1 });

  // Botões
  const [buttonsForm, setButtonsForm] = useState({ title: '', footer: '', imageUrl: '' });
  const [buttons, setButtons] = useState<ButtonDraft[]>([newButton('reply', 0)]);

  // Catálogo
  const [catalogMode, setCatalogMode] = useState<CatalogMode>('catalog');
  const [catalogForm, setCatalogForm] = useState({ title: '', footer: '', imageUrl: '', buttonText: 'Ver catálogo', catalogPhone: '' });
  const [products, setProducts] = useState<Product[] | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_PRODUCT);

  const instance = instances.find((i) => i.id === instanceId);
  const connected = instance?.status === 'CONNECTED';
  const productId = parseProductId(productForm.ref);
  const productPrice = parsePrice(productForm.price);

  /** Escolher um item do catálogo preenche os campos (que continuam editáveis). */
  const pickProduct = (p: Product) =>
    setProductForm({
      ref: p.id,
      title: p.name,
      price: p.price.toFixed(2).replace('.', ','),
      currency: p.currency || 'BRL',
      imageUrl: p.imageUrl ?? '',
      description: p.description ?? '',
    });

  useEffect(() => {
    api
      .get('/instances')
      .then(({ data }) => {
        const list: Instance[] = Array.isArray(data) ? data : [];
        setInstances(list);
        setInstanceId((list.find((i) => i.status === 'CONNECTED') ?? list[0])?.id ?? '');
      })
      .catch(() => setInstances([]));
  }, []);

  // Trocar de instância invalida os produtos carregados (são de outro número).
  useEffect(() => {
    setProducts(null);
    setProductForm(EMPTY_PRODUCT);
    setProductsError('');
  }, [instanceId]);

  const loadProducts = async () => {
    if (!instanceId) return;
    setProductsLoading(true);
    setProductsError('');
    try {
      // Na primeira carga usa o cache do servidor; "Recarregar" força nova consulta ao WhatsApp.
      const { data } = await api.get('/messages/catalog', { params: { instanceId, ...(products ? { refresh: true } : {}) } });
      setProducts(data.products ?? []);
      if (!data.products?.length) setProductsError(data.message || 'Nenhum produto publicado no catálogo deste número.');
    } catch (err) {
      setProducts(null);
      setProductsError(apiErrorMessage(err, 'Não foi possível carregar o catálogo.'));
    } finally {
      setProductsLoading(false);
    }
  };

  // ───────── Botões: edição ─────────

  const updateButton = (key: string, patch: Partial<ButtonDraft>) =>
    setButtons((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const removeButton = (key: string) => setButtons((prev) => prev.filter((b) => b.key !== key));
  const moveButton = (index: number, direction: -1 | 1) =>
    setButtons((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const buttonError = (b: ButtonDraft): string | null => {
    if (!b.text.trim()) return 'Informe o texto do botão';
    if (b.text.length > BUTTON_TEXT_MAX) return `Máximo de ${BUTTON_TEXT_MAX} caracteres`;
    if (b.type === 'url' && !isHttpUrl(b.url)) return 'URL deve começar com http:// ou https://';
    if (b.type === 'call' && (onlyDigits(b.phoneNumber).length < 8 || onlyDigits(b.phoneNumber).length > 15)) return 'Telefone inválido';
    if (b.type === 'copy' && !b.copyCode.trim()) return 'Informe o código a ser copiado';
    if ((b.type === 'reply' || b.type === 'copy') && buttons.filter((o) => o.id.trim() && o.id.trim() === b.id.trim()).length > 1) {
      return 'ID duplicado';
    }
    return null;
  };

  // ───────── Validação e envio ─────────

  const validation = useMemo((): string | null => {
    if (!instanceId) return 'Selecione uma instância';
    if (onlyDigits(to).length < 8 && !to.includes('@')) return 'Informe o número de destino';
    switch (type) {
      case 'text':
        return text.trim() ? null : 'Digite a mensagem';
      case 'image':
      case 'audio':
      case 'video':
      case 'document':
        return isHttpUrl(mediaUrl) || mediaUrl.startsWith('data:') ? null : 'Informe uma URL pública (http/https)';
      case 'contact':
        return contact.name.trim() && onlyDigits(contact.phone).length >= 8 ? null : 'Informe nome e telefone do contato';
      case 'location': {
        const lat = Number(location.latitude.replace(',', '.'));
        const lng = Number(location.longitude.replace(',', '.'));
        if (!location.latitude || !location.longitude || Number.isNaN(lat) || Number.isNaN(lng)) return 'Informe latitude e longitude';
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return 'Coordenadas fora do intervalo válido';
        return null;
      }
      case 'poll': {
        const options = poll.options.map((o) => o.trim()).filter(Boolean);
        if (!poll.question.trim()) return 'Digite a pergunta';
        if (new Set(options).size < 2) return 'A enquete precisa de 2 opções diferentes';
        return null;
      }
      case 'buttons': {
        if (!text.trim()) return 'Digite o texto da mensagem';
        if (buttonsForm.imageUrl && !isHttpUrl(buttonsForm.imageUrl)) return 'URL da imagem inválida';
        const invalid = buttons.map(buttonError).find(Boolean);
        return invalid ?? null;
      }
      case 'catalog':
        if (catalogMode === 'product') {
          if (!productId) return 'Informe o ID ou o link do produto (wa.me/p/...)';
          if (!productForm.title.trim()) return 'Informe o nome do produto';
          if (productPrice === null) return 'Informe um preço válido';
          if (!isHttpUrl(productForm.imageUrl)) return 'Informe a URL pública da imagem do produto';
          return null;
        }
        if (catalogForm.imageUrl && !isHttpUrl(catalogForm.imageUrl)) return 'URL da imagem inválida';
        if (catalogForm.catalogPhone && onlyDigits(catalogForm.catalogPhone).length < 8) return 'Número do catálogo inválido';
        return null;
    }
  }, [instanceId, to, type, text, mediaUrl, contact, location, poll, buttons, buttonsForm, catalogMode, catalogForm, productId, productForm, productPrice]);

  const buildRequest = (): { endpoint: string; payload: Record<string, unknown> } => {
    const base: Record<string, unknown> = { instanceId, to: to.includes('@') ? to.trim() : onlyDigits(to) };
    const delayMs = Number(delay);
    if (delay && Number.isFinite(delayMs) && delayMs >= 0) base.delay = Math.min(Math.round(delayMs), 25_000);
    const opt = (value: string) => (value.trim() ? value.trim() : undefined);

    switch (type) {
      case 'text':
        return { endpoint: '/messages/text', payload: { ...base, text } };
      case 'image':
        return { endpoint: '/messages/image', payload: { ...base, imageUrl: mediaUrl.trim(), caption: opt(caption) } };
      case 'audio':
        return { endpoint: '/messages/audio', payload: { ...base, audioUrl: mediaUrl.trim(), ptt: true } };
      case 'video':
        return { endpoint: '/messages/video', payload: { ...base, videoUrl: mediaUrl.trim(), caption: opt(caption) } };
      case 'document':
        return { endpoint: '/messages/document', payload: { ...base, documentUrl: mediaUrl.trim(), filename: opt(filename), caption: opt(caption) } };
      case 'contact':
        return {
          endpoint: '/messages/contact',
          payload: { ...base, contactName: contact.name.trim(), contactPhone: onlyDigits(contact.phone), organization: opt(contact.organization) },
        };
      case 'location':
        return {
          endpoint: '/messages/location',
          payload: {
            ...base,
            latitude: Number(location.latitude.replace(',', '.')),
            longitude: Number(location.longitude.replace(',', '.')),
            name: opt(location.name),
          },
        };
      case 'poll':
        return {
          endpoint: '/messages/poll',
          payload: { ...base, question: poll.question.trim(), options: poll.options.map((o) => o.trim()).filter(Boolean), selectableCount: poll.selectableCount },
        };
      case 'buttons':
        return {
          endpoint: '/messages/buttons',
          payload: {
            ...base,
            text,
            title: opt(buttonsForm.title),
            footer: opt(buttonsForm.footer),
            imageUrl: opt(buttonsForm.imageUrl),
            buttons: buttons.map((b) => ({
              type: b.type,
              text: b.text.trim(),
              ...(b.type === 'reply' || b.type === 'copy' ? { id: opt(b.id) } : {}),
              ...(b.type === 'url' ? { url: b.url.trim() } : {}),
              ...(b.type === 'call' ? { phoneNumber: onlyDigits(b.phoneNumber) } : {}),
              ...(b.type === 'copy' ? { copyCode: b.copyCode.trim() } : {}),
            })),
          },
        };
      case 'catalog':
        if (catalogMode === 'product') {
          return {
            endpoint: '/messages/product',
            payload: {
              ...base,
              productId,
              title: productForm.title.trim(),
              price: productPrice,
              currency: productForm.currency,
              imageUrl: productForm.imageUrl.trim(),
              description: opt(productForm.description),
              text: opt(text),
              footer: opt(catalogForm.footer),
            },
          };
        }
        return {
          endpoint: '/messages/catalog',
          payload: {
            ...base,
            text: opt(text),
            title: opt(catalogForm.title),
            footer: opt(catalogForm.footer),
            imageUrl: opt(catalogForm.imageUrl),
            buttonText: opt(catalogForm.buttonText),
            catalogPhone: catalogForm.catalogPhone ? onlyDigits(catalogForm.catalogPhone) : undefined,
          },
        };
    }
  };

  const send = async () => {
    if (validation) return notify('warning', 'Revise os campos', validation);
    if (!connected) return notify('warning', 'Instância desconectada', 'Conecte a instância antes de enviar.');
    setLoading(true);
    try {
      const { endpoint, payload } = buildRequest();
      const { data } = await api.post(endpoint, payload);
      setLastResult({ messageId: data.messageId, status: data.status, type: data.type, to: data.to, at: new Date().toLocaleTimeString('pt-BR') });
      Swal.fire({ icon: 'success', title: 'Enviado!', background: '#1a1a1a', color: '#fff', timer: 1600, showConfirmButton: false });
    } catch (err) {
      notify('error', 'Falha no envio', apiErrorMessage(err, 'Erro ao enviar a mensagem'));
    } finally {
      setLoading(false);
    }
  };

  // ───────────────────────────── Render ─────────────────────────────

  const mediaLabels: Record<string, { label: string; placeholder: string }> = {
    image: { label: 'URL da imagem', placeholder: 'https://exemplo.com/imagem.jpg' },
    audio: { label: 'URL do áudio', placeholder: 'https://exemplo.com/audio.mp3' },
    video: { label: 'URL do vídeo', placeholder: 'https://exemplo.com/video.mp4' },
    document: { label: 'URL do arquivo', placeholder: 'https://exemplo.com/contrato.pdf' },
  };

  return (
    <Layout>
      <div className="mb-8">
        <h2 className="text-4xl font-black tracking-tight text-white mb-2">Testar API</h2>
        <p className="text-slate-400 text-lg font-light">Envie mensagens de teste e veja a prévia antes de disparar.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ───────── Formulário ───────── */}
        <div className="xl:col-span-2 rounded-2xl border border-border-dark bg-surface-dark p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Instância">
              <select value={instanceId} onChange={(e) => setInstanceId(e.target.value)} className={inputClass}>
                {instances.length === 0 && <option value="">Nenhuma instância</option>}
                {instances.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.status === 'CONNECTED' ? '🟢' : '🔴'} {i.name}
                    {i.phone ? ` · ${i.phone}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Número de destino" hint="Com DDI e DDD, ex: 5511999999999">
              <input type="text" inputMode="numeric" placeholder="5511999999999" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
            </Field>
          </div>

          {instance && !connected && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
              <span className="material-symbols-outlined text-[20px]">warning</span>
              Esta instância não está conectada. Conecte-a na página Instâncias para enviar.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Tipo de mensagem</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs font-medium transition-all ${
                    type === t.id ? 'bg-primary text-on-primary shadow-glow' : 'bg-surface-light text-slate-400 hover:text-white hover:bg-[#252525]'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Texto */}
          {type === 'text' && (
            <Section title="Mensagem" icon="chat">
              <Field label="Texto" counter={`${text.length}`} hint="Formatação do WhatsApp: *negrito*, _itálico_, ~riscado~">
                <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Digite sua mensagem..." className={`${inputClass} h-auto py-3 resize-none`} />
              </Field>
            </Section>
          )}

          {/* Mídia */}
          {(type === 'image' || type === 'audio' || type === 'video' || type === 'document') && (
            <Section title={TYPES.find((t) => t.id === type)!.label} icon={TYPES.find((t) => t.id === type)!.icon}>
              <Field label={mediaLabels[type].label} hint={type === 'audio' ? 'Convertido automaticamente em nota de voz.' : 'A URL precisa ser pública.'}>
                <input type="url" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder={mediaLabels[type].placeholder} className={inputClass} />
              </Field>
              {type === 'document' && (
                <Field label="Nome do arquivo (opcional)">
                  <input type="text" value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="contrato.pdf" className={inputClass} />
                </Field>
              )}
              {type !== 'audio' && (
                <Field label="Legenda (opcional)">
                  <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Legenda" className={inputClass} />
                </Field>
              )}
            </Section>
          )}

          {/* Contato */}
          {type === 'contact' && (
            <Section title="Cartão de contato" icon="person">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nome">
                  <input type="text" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="Maria Silva" className={inputClass} />
                </Field>
                <Field label="Telefone">
                  <input type="text" inputMode="numeric" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="5511988887777" className={inputClass} />
                </Field>
              </div>
              <Field label="Empresa (opcional)">
                <input type="text" value={contact.organization} onChange={(e) => setContact({ ...contact, organization: e.target.value })} placeholder="Empresa XYZ" className={inputClass} />
              </Field>
            </Section>
          )}

          {/* Localização */}
          {type === 'location' && (
            <Section title="Localização" icon="location_on">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Latitude">
                  <input type="text" inputMode="decimal" value={location.latitude} onChange={(e) => setLocation({ ...location, latitude: e.target.value })} placeholder="-23.5505" className={inputClass} />
                </Field>
                <Field label="Longitude">
                  <input type="text" inputMode="decimal" value={location.longitude} onChange={(e) => setLocation({ ...location, longitude: e.target.value })} placeholder="-46.6333" className={inputClass} />
                </Field>
              </div>
              <Field label="Nome do local (opcional)">
                <input type="text" value={location.name} onChange={(e) => setLocation({ ...location, name: e.target.value })} placeholder="Escritório" className={inputClass} />
              </Field>
            </Section>
          )}

          {/* Enquete */}
          {type === 'poll' && (
            <Section title="Enquete" icon="poll">
              <Field label="Pergunta">
                <input type="text" value={poll.question} onChange={(e) => setPoll({ ...poll, question: e.target.value })} placeholder="Qual horário você prefere?" className={inputClass} />
              </Field>
              <Field label={`Opções (${poll.options.length}/12)`}>
                <div className="space-y-2">
                  {poll.options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => setPoll({ ...poll, options: poll.options.map((o, i) => (i === index ? e.target.value : o)) })}
                        placeholder={`Opção ${index + 1}`}
                        className={inputClass}
                      />
                      {poll.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPoll({ ...poll, options: poll.options.filter((_, i) => i !== index) })}
                          className="px-3 rounded-xl text-slate-500 hover:text-danger hover:bg-danger/10"
                          aria-label="Remover opção"
                        >
                          <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={poll.options.length >= 12}
                  onClick={() => setPoll({ ...poll, options: [...poll.options, ''] })}
                  className="text-primary text-sm font-medium disabled:opacity-40"
                >
                  + Adicionar opção
                </button>
                <label className="flex items-center gap-2 text-sm text-slate-400">
                  Escolhas por pessoa
                  <select
                    value={poll.selectableCount}
                    onChange={(e) => setPoll({ ...poll, selectableCount: Number(e.target.value) })}
                    className="h-9 px-2 bg-[#1a1a1a] text-white border border-[#333] rounded-lg"
                  >
                    <option value={1}>1 (única)</option>
                    <option value={0}>Várias</option>
                  </select>
                </label>
              </div>
            </Section>
          )}

          {/* Botões */}
          {type === 'buttons' && (
            <Section title="Mensagem com botões" icon="smart_button">
              <Field label="Texto da mensagem" counter={`${text.length}/1024`}>
                <textarea rows={3} maxLength={1024} value={text} onChange={(e) => setText(e.target.value)} placeholder="Como podemos te ajudar?" className={`${inputClass} h-auto py-3 resize-none`} />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Título (opcional)" counter={`${buttonsForm.title.length}/60`}>
                  <input type="text" maxLength={60} value={buttonsForm.title} onChange={(e) => setButtonsForm({ ...buttonsForm, title: e.target.value })} placeholder="Atendimento" className={inputClass} />
                </Field>
                <Field label="Rodapé (opcional)" counter={`${buttonsForm.footer.length}/60`}>
                  <input type="text" maxLength={60} value={buttonsForm.footer} onChange={(e) => setButtonsForm({ ...buttonsForm, footer: e.target.value })} placeholder="Responda tocando" className={inputClass} />
                </Field>
                <Field label="Imagem (opcional)">
                  <input type="url" value={buttonsForm.imageUrl} onChange={(e) => setButtonsForm({ ...buttonsForm, imageUrl: e.target.value })} placeholder="https://..." className={inputClass} />
                </Field>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">
                    Botões ({buttons.length}/{MAX_BUTTONS})
                  </span>
                  <button
                    type="button"
                    disabled={buttons.length >= MAX_BUTTONS}
                    onClick={() => setButtons((prev) => [...prev, newButton('reply', prev.length)])}
                    className="flex items-center gap-1 text-primary text-sm font-medium disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Adicionar botão
                  </button>
                </div>

                {buttons.map((button, index) => {
                  const error = buttonError(button);
                  const kind = BUTTON_KINDS.find((k) => k.id === button.type)!;
                  return (
                    <div key={button.key} className={`p-4 rounded-xl border bg-[#141414] space-y-3 ${error ? 'border-danger/40' : 'border-[#2a2a2a]'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 w-6">#{index + 1}</span>
                        {BUTTON_KINDS.map((k) => (
                          <button
                            key={k.id}
                            type="button"
                            title={k.hint}
                            onClick={() => updateButton(button.key, { type: k.id })}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              button.type === k.id ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-surface-light text-slate-400 hover:text-white border border-transparent'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">{k.icon}</span>
                            {k.label}
                          </button>
                        ))}
                        <div className="ml-auto flex items-center">
                          <button type="button" onClick={() => moveButton(index, -1)} disabled={index === 0} className="p-1 text-slate-500 hover:text-white disabled:opacity-30" aria-label="Mover para cima">
                            <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveButton(index, 1)}
                            disabled={index === buttons.length - 1}
                            className="p-1 text-slate-500 hover:text-white disabled:opacity-30"
                            aria-label="Mover para baixo"
                          >
                            <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeButton(button.key)}
                            disabled={buttons.length === 1}
                            className="p-1 text-slate-500 hover:text-danger disabled:opacity-30"
                            aria-label="Remover botão"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Texto do botão" counter={`${button.text.length}/${BUTTON_TEXT_MAX}`}>
                          <input
                            type="text"
                            maxLength={BUTTON_TEXT_MAX}
                            value={button.text}
                            onChange={(e) => updateButton(button.key, { text: e.target.value })}
                            placeholder={kind.id === 'url' ? 'Acessar site' : kind.id === 'call' ? 'Falar com atendente' : kind.id === 'copy' ? 'Copiar cupom' : 'Quero saber mais'}
                            className={inputClass}
                          />
                        </Field>
                        {button.type === 'reply' && (
                          <Field label="ID da resposta" hint="Chega no webhook/bot como buttonId">
                            <input type="text" value={button.id} onChange={(e) => updateButton(button.key, { id: e.target.value })} placeholder="opcao_1" className={inputClass} />
                          </Field>
                        )}
                        {button.type === 'url' && (
                          <Field label="URL">
                            <input type="url" value={button.url} onChange={(e) => updateButton(button.key, { url: e.target.value })} placeholder="https://suaempresa.com" className={inputClass} />
                          </Field>
                        )}
                        {button.type === 'call' && (
                          <Field label="Telefone">
                            <input type="text" inputMode="numeric" value={button.phoneNumber} onChange={(e) => updateButton(button.key, { phoneNumber: e.target.value })} placeholder="5511999999999" className={inputClass} />
                          </Field>
                        )}
                        {button.type === 'copy' && (
                          <Field label="Código a copiar">
                            <input type="text" value={button.copyCode} onChange={(e) => updateButton(button.key, { copyCode: e.target.value })} placeholder="CUPOM10" className={inputClass} />
                          </Field>
                        )}
                      </div>
                      {error && <p className="text-xs text-danger">{error}</p>}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Catálogo */}
          {type === 'catalog' && (
            <Section title="Catálogo do WhatsApp Business" icon="storefront">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#141414] border border-[#2a2a2a]">
                {(
                  [
                    ['catalog', 'Catálogo completo', 'storefront'],
                    ['product', 'Produto específico', 'sell'],
                  ] as const
                ).map(([mode, label, icon]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCatalogMode(mode)}
                    className={`flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-medium transition-all ${
                      catalogMode === mode ? 'bg-primary text-on-primary' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>

              <p className="text-xs text-slate-500 flex gap-2">
                <span className="material-symbols-outlined text-[16px]">info</span>
                Requer que o número da instância (ou o informado) seja WhatsApp Business com catálogo publicado.
              </p>

              {catalogMode === 'catalog' ? (
                <>
                  <Field label="Texto (opcional)" counter={`${text.length}/1024`} hint="O botão abre o catálogo dentro do WhatsApp do contato.">
                    <textarea rows={3} maxLength={1024} value={text} onChange={(e) => setText(e.target.value)} placeholder="Confira nossas novidades 👇" className={`${inputClass} h-auto py-3 resize-none`} />
                  </Field>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Título (opcional)" counter={`${catalogForm.title.length}/60`}>
                      <input type="text" maxLength={60} value={catalogForm.title} onChange={(e) => setCatalogForm({ ...catalogForm, title: e.target.value })} placeholder="Nossa loja" className={inputClass} />
                    </Field>
                    <Field label="Texto do botão" counter={`${catalogForm.buttonText.length}/25`}>
                      <input type="text" maxLength={25} value={catalogForm.buttonText} onChange={(e) => setCatalogForm({ ...catalogForm, buttonText: e.target.value })} placeholder="Ver catálogo" className={inputClass} />
                    </Field>
                    <Field label="Imagem de capa (opcional)" hint="Recomendado: uma vitrine ou o logo da loja.">
                      <input type="url" value={catalogForm.imageUrl} onChange={(e) => setCatalogForm({ ...catalogForm, imageUrl: e.target.value })} placeholder="https://..." className={inputClass} />
                    </Field>
                    <Field label="Número do catálogo (opcional)" hint="Padrão: o número desta instância.">
                      <input type="text" inputMode="numeric" value={catalogForm.catalogPhone} onChange={(e) => setCatalogForm({ ...catalogForm, catalogPhone: e.target.value })} placeholder={instance?.phone ?? '5511999999999'} className={inputClass} />
                    </Field>
                  </div>
                  <Field label="Rodapé (opcional)" counter={`${catalogForm.footer.length}/60`}>
                    <input type="text" maxLength={60} value={catalogForm.footer} onChange={(e) => setCatalogForm({ ...catalogForm, footer: e.target.value })} placeholder="Entregamos em toda a cidade" className={inputClass} />
                  </Field>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field
                      label="ID ou link do produto"
                      hint={productForm.ref && !productId ? 'Formato inválido' : 'No app: Catálogo › produto › Compartilhar link (wa.me/p/...)'}
                    >
                      <input
                        type="text"
                        value={productForm.ref}
                        onChange={(e) => setProductForm({ ...productForm, ref: e.target.value })}
                        placeholder="https://wa.me/p/1234567890/5511999999999"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Nome do produto" counter={`${productForm.title.length}/120`}>
                      <input type="text" maxLength={120} value={productForm.title} onChange={(e) => setProductForm({ ...productForm, title: e.target.value })} placeholder="Camiseta básica" className={inputClass} />
                    </Field>
                    <Field label="Preço" hint={productPrice !== null ? formatMoney(productPrice, productForm.currency) : 'Ex: 59,90'}>
                      <div className="flex gap-2">
                        <input type="text" inputMode="decimal" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} placeholder="59,90" className={inputClass} />
                        <select value={productForm.currency} onChange={(e) => setProductForm({ ...productForm, currency: e.target.value })} className="h-11 px-2 bg-[#1a1a1a] text-white border border-[#333] rounded-xl text-sm">
                          {['BRL', 'USD', 'EUR'].map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </Field>
                    <Field label="Imagem do produto">
                      <input type="url" value={productForm.imageUrl} onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })} placeholder="https://..." className={inputClass} />
                    </Field>
                  </div>
                  <Field label="Descrição (opcional)" counter={`${productForm.description.length}/500`}>
                    <input type="text" maxLength={500} value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} placeholder="100% algodão" className={inputClass} />
                  </Field>

                  <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-300">Preencher a partir do catálogo</p>
                        <p className="text-xs text-slate-500">O WhatsApp pode não responder a essa consulta para aparelhos conectados.</p>
                      </div>
                      <button
                        type="button"
                        onClick={loadProducts}
                        disabled={productsLoading || !connected}
                        className="flex items-center gap-2 px-4 h-10 shrink-0 rounded-xl bg-surface-light text-slate-200 hover:text-white text-sm font-medium disabled:opacity-50"
                      >
                        <span className={`material-symbols-outlined text-[18px] ${productsLoading ? 'animate-spin' : ''}`}>{productsLoading ? 'progress_activity' : 'download'}</span>
                        {productsLoading ? 'Consultando...' : products ? 'Recarregar' : 'Buscar produtos'}
                      </button>
                    </div>
                    {productsError && <p className="text-sm text-yellow-400">{productsError}</p>}
                  </div>

                  {products && products.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
                      {products.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => pickProduct(p)}
                          className={`text-left rounded-xl overflow-hidden border transition-all ${
                            productId === p.id ? 'border-primary ring-2 ring-primary/30' : 'border-[#2a2a2a] hover:border-primary/40'
                          }`}
                        >
                          <div className="aspect-square bg-[#111] flex items-center justify-center">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="material-symbols-outlined text-slate-600 text-4xl">image</span>
                            )}
                          </div>
                          <div className="p-2.5">
                            <p className="text-sm text-white font-medium line-clamp-1">{p.name}</p>
                            <p className="text-xs text-primary font-semibold">{p.priceFormatted}</p>
                            {!p.available && <p className="text-[11px] text-danger">Indisponível</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <Field label="Mensagem (opcional)" counter={`${text.length}/1024`}>
                    <textarea rows={2} maxLength={1024} value={text} onChange={(e) => setText(e.target.value)} placeholder="Esse é o modelo que você pediu 😉" className={`${inputClass} h-auto py-3 resize-none`} />
                  </Field>
                  <Field label="Rodapé (opcional)" counter={`${catalogForm.footer.length}/60`}>
                    <input type="text" maxLength={60} value={catalogForm.footer} onChange={(e) => setCatalogForm({ ...catalogForm, footer: e.target.value })} placeholder="Frete grátis acima de R$ 99" className={inputClass} />
                  </Field>
                </>
              )}
            </Section>
          )}

          <details className="group rounded-xl border border-[#2a2a2a] bg-[#141414]">
            <summary className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400 cursor-pointer select-none">
              <span className="material-symbols-outlined text-[18px] transition-transform group-open:rotate-90">chevron_right</span>
              Opções avançadas
            </summary>
            <div className="px-4 pb-4">
              <Field label="Simular digitação (ms)" hint="Tempo exibindo “digitando...” antes do envio. Vazio = automático pelo tamanho do texto.">
                <input type="number" min={0} max={25000} step={100} value={delay} onChange={(e) => setDelay(e.target.value)} placeholder="Automático" className={inputClass} />
              </Field>
            </div>
          </details>

          <div>
            <button
              onClick={send}
              disabled={loading || !!validation || !connected}
              className="w-full h-14 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" /> Enviando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">send</span> Enviar mensagem
                </>
              )}
            </button>
            {validation && <p className="mt-2 text-center text-xs text-slate-500">{validation}</p>}
          </div>
        </div>

        {/* ───────── Prévia e informações ───────── */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border-dark bg-surface-dark overflow-hidden">
            <div className="px-5 py-4 border-b border-border-dark flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">visibility</span>
              <h3 className="text-white font-bold">Pré-visualização</h3>
            </div>
            <div className="p-5 min-h-[260px] bg-[#0b141a] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] [background-size:16px_16px]">
              <Preview
                type={type}
                text={text}
                mediaUrl={mediaUrl}
                caption={caption}
                filename={filename}
                contact={contact}
                location={location}
                poll={poll}
                buttons={buttons}
                buttonsForm={buttonsForm}
                catalogMode={catalogMode}
                catalogForm={catalogForm}
                product={
                  productForm.title || productForm.imageUrl
                    ? { name: productForm.title, priceFormatted: formatMoney(productPrice, productForm.currency), imageUrl: productForm.imageUrl }
                    : null
                }
              />
            </div>
          </div>

          {lastResult && (
            <div className="rounded-2xl border border-success/30 bg-success/5 p-5 text-sm space-y-1.5">
              <p className="flex items-center gap-2 text-success font-semibold">
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                Último envio · {lastResult.at}
              </p>
              <p className="text-slate-400">
                Tipo: <span className="text-white">{lastResult.type}</span> · Para: <span className="text-white">{lastResult.to}</span>
              </p>
              {lastResult.messageId && (
                <p className="text-slate-400 break-all">
                  ID: <code className="text-slate-200">{lastResult.messageId}</code>
                </p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-border-dark bg-surface-dark p-5">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">tips_and_updates</span>
              Dicas
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>📱 Use o formato internacional: <span className="text-slate-200">5511999999999</span>.</li>
              <li>🛡️ Os envios passam pela fila anti-ban (intervalo, limite por minuto e “digitando...”).</li>
              <li>🔘 Toques em botões de resposta chegam no webhook como <code className="text-slate-200">MESSAGES_UPSERT</code> com <code className="text-slate-200">buttonId</code>.</li>
              <li>🛍️ Catálogo e produto exigem WhatsApp Business com catálogo publicado.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-12 border-t border-border-dark/50 pt-6 text-center">
        <Copyright />
      </div>
    </Layout>
  );
}

// ───────────────────────────── Pré-visualização estilo WhatsApp ─────────────────────────────

interface PreviewProps {
  type: MessageType;
  text: string;
  mediaUrl: string;
  caption: string;
  filename: string;
  contact: { name: string; phone: string; organization: string };
  location: { latitude: string; longitude: string; name: string };
  poll: { question: string; options: string[]; selectableCount: number };
  buttons: ButtonDraft[];
  buttonsForm: { title: string; footer: string; imageUrl: string };
  catalogMode: CatalogMode;
  catalogForm: { title: string; footer: string; imageUrl: string; buttonText: string };
  product: { name: string; priceFormatted: string; imageUrl: string } | null;
}

const BUTTON_ICON: Record<ButtonKind, string> = { reply: 'reply', url: 'open_in_new', call: 'call', copy: 'content_copy' };

function Bubble({ children, footer }: { children: React.ReactNode; footer?: string }) {
  return (
    <div className="max-w-[300px] ml-auto">
      <div className="rounded-xl rounded-tr-sm bg-[#005c4b] text-[#e9edef] text-sm shadow-md overflow-hidden">
        {children}
        <div className="flex items-center justify-between gap-3 px-3 pb-1.5 -mt-0.5">
          <span className="text-[11px] text-[#e9edef]/60 truncate">{footer}</span>
          <span className="text-[11px] text-[#e9edef]/60 flex items-center gap-0.5 shrink-0">
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            <span className="material-symbols-outlined text-[14px] text-[#53bdeb]">done_all</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function ActionButtons({ items }: { items: Array<{ key: string; icon: string; label: string }> }) {
  return (
    <div className="max-w-[300px] ml-auto mt-1 space-y-1">
      {items.map((item) => (
        <div key={item.key} className="flex items-center justify-center gap-1.5 h-10 rounded-lg bg-[#005c4b] text-[#53bdeb] text-sm font-medium shadow">
          <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function Preview(props: PreviewProps) {
  const { type, text, mediaUrl, caption } = props;
  const body = (value: string, placeholder: string) => (
    <p className={`px-3 pt-2 pb-1 whitespace-pre-wrap break-words ${value.trim() ? '' : 'italic text-[#e9edef]/40'}`}>{value.trim() || placeholder}</p>
  );
  const image = (url: string) =>
    url && /^https?:\/\//.test(url) ? (
      <img src={url} alt="" className="w-full max-h-48 object-cover" referrerPolicy="no-referrer" />
    ) : (
      <div className="h-32 bg-black/20 flex items-center justify-center">
        <span className="material-symbols-outlined text-4xl text-[#e9edef]/30">image</span>
      </div>
    );

  switch (type) {
    case 'text':
      return <Bubble>{body(text, 'Sua mensagem aparecerá aqui')}</Bubble>;

    case 'image':
      return <Bubble>{image(mediaUrl)}{caption && body(caption, '')}</Bubble>;

    case 'video':
      return (
        <Bubble>
          <div className="h-36 bg-black/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-[#e9edef]/70">play_circle</span>
          </div>
          {caption && body(caption, '')}
        </Bubble>
      );

    case 'audio':
      return (
        <Bubble>
          <div className="flex items-center gap-3 px-3 pt-3 pb-1">
            <span className="material-symbols-outlined text-3xl">play_arrow</span>
            <div className="flex-1 h-1 rounded bg-[#e9edef]/30" />
            <span className="material-symbols-outlined text-[#53bdeb]">mic</span>
          </div>
        </Bubble>
      );

    case 'document':
      return (
        <Bubble>
          <div className="m-2 flex items-center gap-3 rounded-lg bg-black/20 p-3">
            <span className="material-symbols-outlined text-3xl text-[#e9edef]/70">description</span>
            <span className="truncate">{props.filename || mediaUrl.split('/').pop() || 'arquivo.pdf'}</span>
          </div>
          {caption && body(caption, '')}
        </Bubble>
      );

    case 'contact':
      return (
        <Bubble>
          <div className="flex items-center gap-3 px-3 pt-3 pb-2 border-b border-white/10">
            <span className="h-10 w-10 rounded-full bg-[#e9edef]/20 flex items-center justify-center material-symbols-outlined">person</span>
            <div className="min-w-0">
              <p className="font-medium truncate">{props.contact.name || 'Nome do contato'}</p>
              {props.contact.organization && <p className="text-xs text-[#e9edef]/60 truncate">{props.contact.organization}</p>}
            </div>
          </div>
          <p className="text-center text-[#53bdeb] py-2 text-sm">Conversar</p>
        </Bubble>
      );

    case 'location':
      return (
        <Bubble>
          <div className="h-32 bg-[#1f3a33] flex items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-red-400">location_on</span>
          </div>
          {body(props.location.name || `${props.location.latitude || '0'}, ${props.location.longitude || '0'}`, '')}
        </Bubble>
      );

    case 'poll':
      return (
        <Bubble>
          <div className="px-3 pt-2 pb-1 space-y-2">
            <p className="font-medium">{props.poll.question || 'Pergunta da enquete'}</p>
            <p className="text-[11px] text-[#e9edef]/60">{props.poll.selectableCount === 1 ? 'Selecione uma opção' : 'Selecione uma ou mais opções'}</p>
            {props.poll.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border border-[#e9edef]/50" />
                <span className={o ? '' : 'text-[#e9edef]/40 italic'}>{o || `Opção ${i + 1}`}</span>
              </div>
            ))}
          </div>
        </Bubble>
      );

    case 'buttons':
      return (
        <>
          <Bubble footer={props.buttonsForm.footer}>
            {props.buttonsForm.imageUrl
              ? image(props.buttonsForm.imageUrl)
              : props.buttonsForm.title && <p className="px-3 pt-2 font-bold">{props.buttonsForm.title}</p>}
            {body(text, 'Texto da mensagem')}
          </Bubble>
          <ActionButtons items={props.buttons.map((b, i) => ({ key: b.key, icon: BUTTON_ICON[b.type], label: b.text || `Botão ${i + 1}` }))} />
        </>
      );

    case 'catalog':
      if (props.catalogMode === 'product') {
        const p = props.product;
        return (
          <Bubble footer={props.catalogForm.footer}>
            {p ? image(p.imageUrl ?? '') : image('')}
            <div className="px-3 pt-2">
              <p className={`font-medium ${p?.name ? '' : 'italic text-[#e9edef]/40'}`}>{p?.name || 'Nome do produto'}</p>
              {p?.priceFormatted && <p className="text-xs text-[#e9edef]/70">{p.priceFormatted}</p>}
            </div>
            {text.trim() && body(text, '')}
            <p className="text-center text-[#53bdeb] py-2 text-sm border-t border-white/10 mt-2">Ver</p>
          </Bubble>
        );
      }
      return (
        <>
          <Bubble footer={props.catalogForm.footer}>
            {image(props.catalogForm.imageUrl)}
            {props.catalogForm.title && <p className="px-3 pt-2 font-bold">{props.catalogForm.title}</p>}
            {body(text, 'Confira nosso catálogo 🛍️')}
          </Bubble>
          <ActionButtons items={[{ key: 'catalog', icon: 'storefront', label: props.catalogForm.buttonText || 'Ver catálogo' }]} />
        </>
      );
  }
}
