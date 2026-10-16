import { BadRequestException, GatewayTimeoutException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Product, proto } from 'baileys';
import { describeError } from '../common/utils/errors';
import { jidToPhone } from '../common/utils/jid';
import { downloadBuffer } from '../common/utils/net';
import { maskJid } from '../common/utils/privacy';
import { TtlCache } from '../common/utils/ttl-cache';
import { BaileysService } from '../instances/baileys.service';
import { MessageSenderService } from '../instances/message-sender.service';
import { MessageSource } from '../shared/event-bus.service';
import { ButtonDto, CatalogQuery, SendButtonsBody, SendCatalogBody, SendProductBody } from './dto/message.dto';
import { auditableUrl } from './media.util';
import { MessagesService } from './messages.service';

export interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  /** Preço no formato do protocolo (valor × 1000). */
  priceAmount1000: number;
  price: number;
  priceFormatted: string;
  currency: string;
  imageUrl: string | null;
  url: string | null;
  retailerId: string | null;
  available: boolean;
}

interface CatalogPage {
  products: Product[];
  nextPageCursor?: string;
}

const CATALOG_UNAVAILABLE =
  'Catálogo indisponível. O número precisa ser WhatsApp Business com catálogo ativo e produtos publicados.';
const CATALOG_EMPTY =
  'O catálogo deste número está vazio. Publique produtos em WhatsApp Business › Ferramentas › Catálogo (itens em análise ou ocultos não aparecem).';
const CATALOG_NO_RESPONSE =
  'O WhatsApp não respondeu à consulta do catálogo. Atualmente o WhatsApp não entrega o catálogo para aparelhos conectados (limitação do WhatsApp, não da API). ' +
  'O envio do catálogo completo continua funcionando, e o de produto funciona informando nome, preço e imagem.';
const notBusinessMessage = (jid: string) =>
  `O número ${jidToPhone(jid)} não é uma conta WhatsApp Business. Catálogo e produtos só existem em contas Business.`;

/** Tamanho de página único: listagem, cartão e busca compartilham o mesmo cache. */
const CATALOG_PAGE_SIZE = 30;
const PROFILE_TIMEOUT_MS = 10_000;
const CATALOG_TIMEOUT_MS = 15_000;
const CATALOG_TTL_MS = 3 * 60_000;
const EMPTY_CATALOG_TTL_MS = 60_000;

class TimeoutError extends Error {}

/** Rejeita se a promessa não resolver no prazo (a operação original segue em segundo plano). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(`timeout ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Mensagens interativas que ainda são entregues pelo WhatsApp:
 * - Botões "native flow" (resposta rápida, link, ligação, copiar código);
 * - Cartão do catálogo (botão "Ver catálogo");
 * - Produto do catálogo (mensagem nativa de produto).
 */
@Injectable()
export class InteractiveMessagesService {
  private readonly logger = new Logger(InteractiveMessagesService.name);
  private readonly catalogCache = new TtlCache<string, CatalogPage>(CATALOG_TTL_MS, 500);
  private readonly catalogInFlight = new Map<string, Promise<CatalogPage>>();
  private readonly businessCache = new TtlCache<string, boolean>(10 * 60_000, 2_000);
  private readonly unresponsiveCatalogs = new TtlCache<string, true>(5 * 60_000, 2_000);

  constructor(
    private readonly sender: MessageSenderService,
    private readonly baileys: BaileysService,
    private readonly messages: MessagesService,
  ) {}

  // ───────────────────────────── Botões ─────────────────────────────

  async sendButtons(instanceId: string, dto: SendButtonsBody, source: MessageSource = 'api') {
    const buttons = this.normalizeButtons(dto.buttons);
    const jid = await this.sender.resolveJid(instanceId, dto.to);
    const header = await this.buildHeader(instanceId, dto.title, dto.imageUrl);

    const raw: proto.IMessage = {
      interactiveMessage: {
        header,
        body: { text: dto.text },
        ...(dto.footer ? { footer: { text: dto.footer } } : {}),
        nativeFlowMessage: { buttons: buttons.map((b) => this.toNativeFlow(b)), messageParamsJson: '', messageVersion: 1 },
      },
    };

    const preview = `${dto.text}\n\n${buttons.map((b) => `[${b.text}]`).join(' ')}`;
    const sent = await this.sender.send(instanceId, jid, { raw }, { source, delayMs: dto.delay, preview, type: 'buttons' });
    return this.messages.record(
      instanceId,
      jid,
      'BUTTONS',
      {
        text: dto.text,
        title: dto.title,
        footer: dto.footer,
        imageUrl: dto.imageUrl ? auditableUrl(dto.imageUrl) : undefined,
        buttons: buttons.map(({ type, text, id }) => ({ type, text, id })),
      },
      sent,
    );
  }

  /** Valida regras que dependem do conjunto de botões e gera ids estáveis. */
  private normalizeButtons(buttons: ButtonDto[]): ButtonDto[] {
    const seen = new Set<string>();
    return buttons.map((button, index) => {
      const normalized: ButtonDto = { ...button, text: button.text.trim() };
      if (normalized.type === 'reply' || normalized.type === 'copy') {
        normalized.id = (button.id?.trim() || `${normalized.type}_${index + 1}`).slice(0, 256);
        if (seen.has(normalized.id)) throw new BadRequestException(`ID de botão duplicado: "${normalized.id}"`);
        seen.add(normalized.id);
      }
      if (normalized.type === 'call') {
        const digits = (button.phoneNumber ?? '').replace(/\D/g, '');
        if (digits.length < 8 || digits.length > 15) throw new BadRequestException(`Telefone inválido no botão "${normalized.text}"`);
        normalized.phoneNumber = `+${digits}`;
      }
      return normalized;
    });
  }

  private toNativeFlow(button: ButtonDto) {
    const json = (params: Record<string, unknown>) => JSON.stringify({ display_text: button.text, ...params });
    switch (button.type) {
      case 'reply':
        return { name: 'quick_reply', buttonParamsJson: json({ id: button.id }) };
      case 'url':
        return { name: 'cta_url', buttonParamsJson: json({ url: button.url, merchant_url: button.url }) };
      case 'call':
        return { name: 'cta_call', buttonParamsJson: json({ phone_number: button.phoneNumber }) };
      case 'copy':
        return { name: 'cta_copy', buttonParamsJson: json({ id: button.id, copy_code: button.copyCode }) };
    }
  }

  /** Cabeçalho com imagem (enviada ao servidor de mídia) ou apenas título. */
  private async buildHeader(instanceId: string, title?: string, imageUrl?: string): Promise<proto.Message.InteractiveMessage.IHeader> {
    if (imageUrl) {
      let image: { buffer: Buffer; contentType?: string };
      try {
        image = await downloadBuffer(imageUrl, { maxBytes: 5 * 1024 * 1024 });
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('Não foi possível baixar a imagem do cabeçalho. Verifique se a URL é pública.');
      }
      const contentType = image.contentType?.split(';')[0];
      if (contentType && !contentType.startsWith('image/')) {
        throw new BadRequestException('A URL do cabeçalho não aponta para uma imagem');
      }
      const imageMessage = await this.sender.uploadImage(instanceId, image.buffer, contentType);
      return { title: title ?? '', hasMediaAttachment: true, imageMessage };
    }
    return { title: title ?? '', subtitle: '', hasMediaAttachment: false };
  }

  // ───────────────────────────── Catálogo ─────────────────────────────

  async listCatalog(instanceId: string, query: CatalogQuery) {
    const ownerJid = this.catalogOwner(instanceId, query.phone);
    if (query.refresh) this.clearCatalogCache(instanceId, query.phone);
    const { products, nextPageCursor } = await this.fetchCatalog(instanceId, ownerJid, query.limit ?? CATALOG_PAGE_SIZE, query.cursor);
    const visible = products.filter((p) => !p.isHidden).map((p) => this.present(p));
    return {
      owner: jidToPhone(ownerJid),
      catalogUrl: `https://wa.me/c/${jidToPhone(ownerJid)}`,
      products: visible,
      nextCursor: nextPageCursor ?? null,
      ...(visible.length === 0 && !query.cursor ? { message: CATALOG_EMPTY } : {}),
    };
  }

  /**
   * Cartão com botão "Ver catálogo" (abre o catálogo dentro do WhatsApp).
   * Não depende da consulta de catálogo (que o WhatsApp não responde mais para aparelhos
   * conectados): basta o link wa.me/c/<número>, resolvido pelo próprio WhatsApp do contato.
   */
  async sendCatalog(instanceId: string, dto: SendCatalogBody, source: MessageSource = 'api') {
    const ownerJid = this.catalogOwner(instanceId, dto.catalogPhone);
    await this.assertBusiness(instanceId, ownerJid);

    const jid = await this.sender.resolveJid(instanceId, dto.to);
    const catalogUrl = `https://wa.me/c/${jidToPhone(ownerJid)}`;
    const text = dto.text?.trim() || 'Confira nosso catálogo 🛍️';
    const header = await this.buildHeader(instanceId, dto.title, dto.imageUrl);

    const raw: proto.IMessage = {
      interactiveMessage: {
        header,
        body: { text },
        ...(dto.footer ? { footer: { text: dto.footer } } : {}),
        nativeFlowMessage: {
          buttons: [
            {
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({ display_text: dto.buttonText?.trim() || 'Ver catálogo', url: catalogUrl, merchant_url: catalogUrl }),
            },
          ],
          messageParamsJson: '',
          messageVersion: 1,
        },
      },
    };

    const sent = await this.sender.send(instanceId, jid, { raw }, {
      source,
      delayMs: dto.delay,
      preview: `${text}\n${catalogUrl}`,
      type: 'catalog',
    });
    return this.messages.record(instanceId, jid, 'CATALOG', { text, catalogUrl }, sent);
  }

  /** Mensagem nativa de produto (cartão com foto, preço e botão "Ver"). */
  async sendProduct(instanceId: string, dto: SendProductBody, source: MessageSource = 'api') {
    const ownerJid = this.catalogOwner(instanceId);
    await this.assertBusiness(instanceId, ownerJid);
    const product = await this.resolveProduct(instanceId, ownerJid, dto);
    const presented = this.present(product);
    if (!presented.imageUrl) throw new BadRequestException('Informe a imagem do produto (imageUrl)');

    const jid = await this.sender.resolveJid(instanceId, dto.to);
    let image: Buffer;
    try {
      const downloaded = await downloadBuffer(presented.imageUrl, { maxBytes: 5 * 1024 * 1024 });
      const type = downloaded.contentType?.split(';')[0];
      if (type && !type.startsWith('image/')) throw new BadRequestException('A imagem do produto não é um arquivo de imagem');
      image = downloaded.buffer;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Não foi possível baixar a imagem do produto. Verifique se a URL é pública.');
    }

    const sent = await this.sender.send(
      instanceId,
      jid,
      {
        product: {
          productImage: image,
          productId: product.id,
          title: product.name,
          description: product.description,
          currencyCode: product.currency,
          priceAmount1000: product.price,
          retailerId: product.retailerId,
          url: product.url,
          productImageCount: 1,
        },
        businessOwnerJid: ownerJid,
        ...(dto.text ? { body: dto.text } : {}),
        ...(dto.footer ? { footer: dto.footer } : {}),
      } as any,
      {
        source,
        delayMs: dto.delay,
        preview: `🛍️ ${product.name} — ${presented.priceFormatted}${dto.text ? `\n${dto.text}` : ''}`,
        type: 'product',
      },
    );
    return this.messages.record(
      instanceId,
      jid,
      'PRODUCT',
      { productId: product.id, name: product.name, price: presented.priceFormatted, text: dto.text },
      sent,
    );
  }

  // ───────────────────────────── Auxiliares ─────────────────────────────

  private catalogOwner(instanceId: string, phone?: string): string {
    if (phone) return `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
    this.baileys.requireSocket(instanceId);
    const own = this.baileys.getInfo(instanceId).phone;
    if (!own) throw new BadRequestException('Número da instância ainda não identificado. Aguarde a conexão concluir.');
    return `${own}@s.whatsapp.net`;
  }

  /**
   * Garante que o dono do catálogo é uma conta WhatsApp Business.
   * Para números comuns o WhatsApp não responde à consulta de catálogo (a chamada fica
   * presa até o timeout de 60s); o perfil comercial responde em milissegundos.
   */
  private async assertBusiness(instanceId: string, ownerJid: string) {
    const cached = this.businessCache.get(ownerJid);
    if (cached === false) throw new BadRequestException(notBusinessMessage(ownerJid));
    if (cached === true) return;

    const socket = this.baileys.requireSocket(instanceId);
    let profile: unknown;
    try {
      profile = await withTimeout(socket.getBusinessProfile(ownerJid), PROFILE_TIMEOUT_MS);
    } catch (err) {
      // Falha transitória na checagem não deve bloquear: a consulta do catálogo tem timeout próprio.
      this.logger.warn(`Perfil comercial de ${maskJid(ownerJid)} indisponível: ${describeError(err)}`);
      return;
    }
    const isBusiness = !!profile;
    this.businessCache.set(ownerJid, isBusiness);
    if (!isBusiness) throw new BadRequestException(notBusinessMessage(ownerJid));
  }

  /** Consulta o catálogo com timeout curto, cache e deduplicação de chamadas simultâneas. */
  private async fetchCatalog(instanceId: string, ownerJid: string, limit: number, cursor?: string): Promise<CatalogPage> {
    const key = `${ownerJid}|${limit}|${cursor ?? ''}`;
    const cached = this.catalogCache.get(key);
    if (cached) return cached;
    if (this.unresponsiveCatalogs.has(ownerJid)) throw new GatewayTimeoutException(CATALOG_NO_RESPONSE);

    let pending = this.catalogInFlight.get(key);
    if (!pending) {
      pending = (async () => {
        await this.assertBusiness(instanceId, ownerJid);
        const socket = this.baileys.requireSocket(instanceId);
        const started = Date.now();
        try {
          const page = await withTimeout(
            socket.getCatalog({ jid: ownerJid, limit, ...(cursor ? { cursor } : {}) }),
            CATALOG_TIMEOUT_MS,
          );
          const result: CatalogPage = { products: page.products ?? [], nextPageCursor: page.nextPageCursor };
          this.catalogCache.set(key, result, result.products.length ? CATALOG_TTL_MS : EMPTY_CATALOG_TTL_MS);
          this.logger.debug(`Catálogo de ${maskJid(ownerJid)}: ${result.products.length} item(ns) em ${Date.now() - started}ms`);
          return result;
        } catch (err) {
          if (err instanceof TimeoutError) {
            // Lembra por alguns minutos para não prender cada nova tentativa por 15s.
            this.unresponsiveCatalogs.set(ownerJid, true);
            this.logger.warn(`WhatsApp não respondeu à consulta de catálogo de ${maskJid(ownerJid)} em ${CATALOG_TIMEOUT_MS}ms`);
            throw new GatewayTimeoutException(CATALOG_NO_RESPONSE);
          }
          this.logger.warn(`getCatalog falhou para ${maskJid(ownerJid)}: ${describeError(err)}`);
          throw new BadRequestException(CATALOG_UNAVAILABLE);
        }
      })().finally(() => this.catalogInFlight.delete(key));
      this.catalogInFlight.set(key, pending);
    }
    return pending;
  }

  /** Invalida o cache (ex: após o usuário editar produtos no app). */
  clearCatalogCache(instanceId: string, phone?: string) {
    const ownerJid = this.catalogOwner(instanceId, phone);
    this.catalogCache.deleteWhere((key) => key.startsWith(`${ownerJid}|`));
    this.businessCache.delete(ownerJid);
    this.unresponsiveCatalogs.delete(ownerJid);
  }

  /**
   * Dados do produto: usa os informados na requisição quando completos (caminho confiável);
   * senão tenta o catálogo e, se o WhatsApp não responder, explica o que informar.
   */
  private async resolveProduct(instanceId: string, ownerJid: string, dto: SendProductBody): Promise<Product> {
    const manual = !!dto.title?.trim() && dto.price !== undefined && !!dto.imageUrl?.trim();
    if (manual) {
      return {
        id: dto.productId,
        name: dto.title!.trim(),
        description: dto.description?.trim() ?? '',
        price: Math.round(dto.price! * 1000),
        currency: dto.currency ?? 'BRL',
        url: dto.url,
        imageUrls: { original: dto.imageUrl!.trim() },
        reviewStatus: {},
        availability: 'in stock',
      } as unknown as Product;
    }

    try {
      const found = await this.findProduct(instanceId, ownerJid, dto.productId);
      // Campos informados têm prioridade sobre os do catálogo.
      return {
        ...found,
        name: dto.title?.trim() || found.name,
        description: dto.description?.trim() ?? found.description,
        price: dto.price !== undefined ? Math.round(dto.price * 1000) : found.price,
        currency: dto.currency ?? found.currency,
        url: dto.url ?? found.url,
        imageUrls: dto.imageUrl ? { original: dto.imageUrl } : found.imageUrls,
      };
    } catch (err) {
      if (err instanceof GatewayTimeoutException) {
        throw new BadRequestException(
          'O WhatsApp não está respondendo às consultas de catálogo para aparelhos conectados. ' +
            'Informe os dados do produto no envio: title (nome), price (preço) e imageUrl (imagem).',
        );
      }
      throw err;
    }
  }

  /** Procura o produto paginando o catálogo (até 300 itens, páginas em cache). */
  private async findProduct(instanceId: string, ownerJid: string, productId: string): Promise<Product> {
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const { products, nextPageCursor } = await this.fetchCatalog(instanceId, ownerJid, CATALOG_PAGE_SIZE, cursor);
      const found = products.find((p) => p.id === productId || p.retailerId === productId);
      if (found) {
        if (found.isHidden) throw new BadRequestException('Este produto está oculto no catálogo');
        return found;
      }
      if (!nextPageCursor) break;
      cursor = nextPageCursor;
    }
    throw new NotFoundException('Produto não encontrado no catálogo');
  }

  private present(product: Product): CatalogProduct {
    const price = (product.price ?? 0) / 1000;
    let priceFormatted: string;
    try {
      priceFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: product.currency || 'BRL' }).format(price);
    } catch {
      priceFormatted = `${product.currency ?? ''} ${price.toFixed(2)}`.trim();
    }
    const images = product.imageUrls ?? {};
    return {
      id: product.id,
      name: product.name,
      description: product.description ?? '',
      priceAmount1000: product.price ?? 0,
      price,
      priceFormatted,
      currency: product.currency,
      imageUrl: images.original || images.requested || Object.values(images)[0] || null,
      url: product.url || null,
      retailerId: product.retailerId || null,
      available: String(product.availability ?? 'in stock') === 'in stock',
    };
  }
}
