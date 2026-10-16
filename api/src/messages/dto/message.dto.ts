import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/** Campos comuns. `delay` = tempo (ms) exibindo "digitando..." antes do envio. */
class BaseSendBody {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  to: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(25_000)
  delay?: number;
}

export class SendTextBody extends BaseSendBody {
  @IsString() @IsNotEmpty() @MaxLength(65_536) text: string;
}

export class SendImageBody extends BaseSendBody {
  /** URL http(s) ou data URI base64. */
  @IsString() @IsNotEmpty() imageUrl: string;
  @IsOptional() @IsString() @MaxLength(4096) caption?: string;
}

export class SendAudioBody extends BaseSendBody {
  @IsString() @IsNotEmpty() audioUrl: string;
  /** true (padrão) envia como mensagem de voz (PTT). */
  @IsOptional() @IsBoolean() ptt?: boolean;
}

export class SendVideoBody extends BaseSendBody {
  @IsString() @IsNotEmpty() videoUrl: string;
  @IsOptional() @IsString() @MaxLength(4096) caption?: string;
}

export class SendDocumentBody extends BaseSendBody {
  @IsString() @IsNotEmpty() documentUrl: string;
  @IsOptional() @IsString() @MaxLength(255) filename?: string;
  @IsOptional() @IsString() @MaxLength(4096) caption?: string;
}

export class SendContactBody extends BaseSendBody {
  @IsString() @IsNotEmpty() @MaxLength(120) contactName: string;
  @IsString() @IsNotEmpty() @MaxLength(32) contactPhone: string;
  @IsOptional() @IsString() @MaxLength(120) organization?: string;
}

export class SendLocationBody extends BaseSendBody {
  @Type(() => Number) @IsNumber() @IsLatitude() latitude: number;
  @Type(() => Number) @IsNumber() @IsLongitude() longitude: number;
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
}

export const BUTTON_TYPES = ['reply', 'url', 'call', 'copy'] as const;
export type ButtonType = (typeof BUTTON_TYPES)[number];

/**
 * Botão interativo (native flow):
 * - reply: resposta rápida (o toque volta como mensagem com o texto e o `id`)
 * - url:   abre um link
 * - call:  liga para um número
 * - copy:  copia um código (ex: cupom, chave Pix)
 */
// Os decoradores são avaliados de baixo para cima: a checagem de "obrigatório"
// fica por último para que, com stopAtFirstError, a mensagem exibida seja a mais útil.
export class ButtonDto {
  @IsIn(BUTTON_TYPES, { message: 'O tipo deve ser reply, url, call ou copy' })
  type: ButtonType;

  @MaxLength(25, { message: 'O texto do botão deve ter no máximo 25 caracteres' })
  @IsNotEmpty({ message: 'Informe o texto do botão' })
  @IsString({ message: 'Informe o texto do botão' })
  text: string;

  /** Identificador devolvido quando o contato toca no botão (reply/copy). Gerado se omitido. */
  @IsOptional()
  @MaxLength(256, { message: 'O ID do botão deve ter no máximo 256 caracteres' })
  @IsString()
  id?: string;

  @ValidateIf((b) => b.type === 'url')
  @MaxLength(2048, { message: 'URL muito longa' })
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'Botão de link requer uma URL http(s) válida' })
  url?: string;

  @ValidateIf((b) => b.type === 'call')
  @Matches(/^\+?[\d\s().-]{8,20}$/, { message: 'Botão de ligação requer um telefone válido' })
  phoneNumber?: string;

  @ValidateIf((b) => b.type === 'copy')
  @MaxLength(512, { message: 'O código deve ter no máximo 512 caracteres' })
  @IsNotEmpty({ message: 'Botão de copiar requer o código' })
  @IsString({ message: 'Botão de copiar requer o código' })
  copyCode?: string;
}

export class SendButtonsBody extends BaseSendBody {
  @IsString() @IsNotEmpty() @MaxLength(1024) text: string;
  /** Título exibido no cabeçalho (ignorado se houver imagem). */
  @IsOptional() @IsString() @MaxLength(60) title?: string;
  @IsOptional() @IsString() @MaxLength(60) footer?: string;
  /** Imagem do cabeçalho (URL http(s) ou data URI). */
  @IsOptional() @IsString() imageUrl?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Informe pelo menos 1 botão' })
  @ArrayMaxSize(10, { message: 'Máximo de 10 botões' })
  @ValidateNested({ each: true })
  @Type(() => ButtonDto)
  buttons: ButtonDto[];
}

/** Cartão do catálogo inteiro (botão "Ver catálogo"). Requer WhatsApp Business com catálogo. */
export class SendCatalogBody extends BaseSendBody {
  @IsOptional() @IsString() @MaxLength(1024) text?: string;
  @IsOptional() @IsString() @MaxLength(60) title?: string;
  @IsOptional() @IsString() @MaxLength(60) footer?: string;
  @IsOptional() @IsString() @MaxLength(25) buttonText?: string;
  /** Imagem do cabeçalho. Se omitida, usa a foto do primeiro produto do catálogo. */
  @IsOptional() @IsString() imageUrl?: string;
  /** Número dono do catálogo. Padrão: o próprio número da instância. */
  @IsOptional() @Matches(/^\+?\d{8,15}$/, { message: 'catalogPhone deve conter apenas dígitos (DDI+DDD+número)' })
  catalogPhone?: string;
}

/**
 * Produto do catálogo (mensagem nativa de produto).
 *
 * O WhatsApp deixou de responder às consultas de catálogo para aparelhos conectados,
 * então os dados podem ser informados diretamente (title + price + imageUrl).
 * Se omitidos, a API tenta buscá-los no catálogo.
 */
export class SendProductBody extends BaseSendBody {
  /** ID do produto no catálogo (o número em wa.me/p/<ID>/<telefone>). */
  @Matches(/^\d{6,30}$/, { message: 'productId deve ser o ID numérico do produto (veja o link wa.me/p/ID/telefone)' })
  productId: string;

  @IsOptional() @MaxLength(120) @IsString() title?: string;
  @IsOptional() @MaxLength(500) @IsString() description?: string;
  /** Preço em unidades da moeda (ex: 59.9). */
  @IsOptional() @Type(() => Number) @Max(100_000_000) @Min(0) @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Preço inválido' }) price?: number;
  @IsOptional() @Matches(/^[A-Z]{3}$/, { message: 'Moeda deve ser um código ISO de 3 letras (ex: BRL)' }) currency?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @MaxLength(2048) @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'URL do produto inválida' }) url?: string;

  @IsOptional() @IsString() @MaxLength(1024) text?: string;
  @IsOptional() @IsString() @MaxLength(60) footer?: string;
}

export class CatalogQuery {
  @IsOptional() @Matches(/^\+?\d{8,15}$/, { message: 'phone deve conter apenas dígitos' }) phone?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() @MaxLength(512) cursor?: string;
  /** true = ignora o cache e consulta o WhatsApp novamente. */
  @IsOptional() @Transform(({ value }) => value === true || value === 'true' || value === '1') @IsBoolean() refresh?: boolean;
}

export class SendPollBody extends BaseSendBody {
  @IsString() @IsNotEmpty() @MaxLength(255) question: string;
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(12) @IsString({ each: true }) @IsNotEmpty({ each: true }) options: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(12) selectableCount?: number;
}

export class CheckNumbersBody {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsString({ each: true }) numbers: string[];
}

// Variantes do painel (JWT): informam a instância no corpo.
function withInstance<T extends new (...args: any[]) => object>(Base: T) {
  class Mixed extends Base {
    @IsUUID() instanceId: string;
  }
  return Mixed;
}

export class SendTextDto extends withInstance(SendTextBody) {}
export class SendImageDto extends withInstance(SendImageBody) {}
export class SendAudioDto extends withInstance(SendAudioBody) {}
export class SendVideoDto extends withInstance(SendVideoBody) {}
export class SendDocumentDto extends withInstance(SendDocumentBody) {}
export class SendContactDto extends withInstance(SendContactBody) {}
export class SendLocationDto extends withInstance(SendLocationBody) {}
export class SendButtonsDto extends withInstance(SendButtonsBody) {}
export class SendCatalogDto extends withInstance(SendCatalogBody) {}
export class SendProductDto extends withInstance(SendProductBody) {}
export class SendPollDto extends withInstance(SendPollBody) {}
export class CheckNumbersDto extends withInstance(CheckNumbersBody) {}
