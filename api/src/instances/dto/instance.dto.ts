import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateInstanceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;
}

export class UpdateInstanceDto extends CreateInstanceDto {}

class EventsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) events?: string[];
}

export class ProxySettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsIn(['http', 'https', 'socks4', 'socks5']) protocol?: string;
  @IsOptional() @IsString() @MaxLength(255) host?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(65535) port?: number;
  @IsOptional() @IsString() @MaxLength(255) username?: string;
  @IsOptional() @IsString() @MaxLength(255) password?: string;
}

export class WebhookSettingsDto extends EventsDto {
  @IsOptional() @IsString() @MaxLength(2048) url?: string;
  @IsOptional() @IsString() @MaxLength(255) secret?: string;
}

export class WebSocketSettingsDto extends EventsDto {}

export class RabbitMQSettingsDto extends EventsDto {
  @IsOptional() @IsString() @MaxLength(2048) uri?: string;
  @IsOptional() @IsString() @MaxLength(255) exchange?: string;
}

export class SQSSettingsDto extends EventsDto {
  @IsOptional() @IsString() @MaxLength(255) accessKeyId?: string;
  @IsOptional() @IsString() @MaxLength(255) secretAccessKey?: string;
  @IsOptional() @IsString() @MaxLength(64) region?: string;
  @IsOptional() @IsString() @MaxLength(2048) queueUrl?: string;
}

export class BotSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsIn(['keyword', 'all', 'advanced', 'none']) triggerType?: string;
  @IsOptional() @IsIn(['contains', 'equals', 'startsWith', 'endsWith', 'regex']) triggerOperator?: string;
  @IsOptional() @IsString() @MaxLength(500) keyword?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) expireMinutes?: number;
  @IsOptional() @IsString() @MaxLength(100) keywordFinish?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(60_000) delayMessage?: number;
  @IsOptional() @IsString() @MaxLength(2000) unknownMessage?: string;
  @IsOptional() @IsBoolean() listeningFromMe?: boolean;
  @IsOptional() @IsBoolean() stopBotFromMe?: boolean;
  @IsOptional() @IsBoolean() keepOpen?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(300) debounceTime?: number;
}

export class TypebotSettingsDto extends BotSettingsDto {
  @IsOptional() @IsString() @MaxLength(2048) apiUrl?: string;
  @IsOptional() @IsString() @MaxLength(255) publicName?: string;
}

export class N8nSettingsDto extends BotSettingsDto {
  @IsOptional() @IsString() @MaxLength(2048) webhookUrl?: string;
  @IsOptional() @IsString() @MaxLength(255) basicAuthUser?: string;
  @IsOptional() @IsString() @MaxLength(255) basicAuthPassword?: string;
  @IsOptional() @IsBoolean() splitMessages?: boolean;
}

export class ChatwootSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(2048) url?: string;
  @IsOptional() @IsString() @MaxLength(32) accountId?: string;
  @IsOptional() @IsString() @MaxLength(255) token?: string;
  @IsOptional() @IsBoolean() signMessages?: boolean;
  @IsOptional() @IsString() @MaxLength(20) signDelimiter?: string;
  @IsOptional() @IsString() @MaxLength(120) nameInbox?: string;
  @IsOptional() @IsString() @MaxLength(120) organization?: string;
  @IsOptional() @IsString() @MaxLength(2048) logo?: string;
  @IsOptional() @IsBoolean() conversationPending?: boolean;
  @IsOptional() @IsBoolean() reopenConversation?: boolean;
  @IsOptional() @IsBoolean() importContacts?: boolean;
  @IsOptional() @IsBoolean() importMessages?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(365) daysLimitImport?: number;
  @IsOptional() @IsString() @MaxLength(4000) ignoreJids?: string;
  @IsOptional() @IsBoolean() autoCreate?: boolean;
}

export class UpdateSettingsDto {
  @IsOptional() @IsBoolean() rejectCalls?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) rejectCallMessage?: string;
  @IsOptional() @IsBoolean() ignoreGroups?: boolean;
  @IsOptional() @IsBoolean() alwaysOnline?: boolean;
  @IsOptional() @IsBoolean() readMessages?: boolean;
  @IsOptional() @IsBoolean() syncFullHistory?: boolean;
  @IsOptional() @IsBoolean() readStatus?: boolean;

  @IsOptional() @ValidateNested() @Type(() => ProxySettingsDto) proxy?: ProxySettingsDto;
  @IsOptional() @ValidateNested() @Type(() => WebhookSettingsDto) webhook?: WebhookSettingsDto;
  @IsOptional() @ValidateNested() @Type(() => WebSocketSettingsDto) websocket?: WebSocketSettingsDto;
  @IsOptional() @ValidateNested() @Type(() => RabbitMQSettingsDto) rabbitmq?: RabbitMQSettingsDto;
  @IsOptional() @ValidateNested() @Type(() => SQSSettingsDto) sqs?: SQSSettingsDto;
  @IsOptional() @ValidateNested() @Type(() => TypebotSettingsDto) typebot?: TypebotSettingsDto;
  @IsOptional() @ValidateNested() @Type(() => N8nSettingsDto) n8n?: N8nSettingsDto;
  @IsOptional() @ValidateNested() @Type(() => ChatwootSettingsDto) chatwoot?: ChatwootSettingsDto;
}

export class SharedTokenDto {
  @IsUUID()
  instanceId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  expiresInHours?: number;

  @IsOptional()
  @IsArray()
  @IsIn(['view_qr'], { each: true })
  permissions?: string[];
}
