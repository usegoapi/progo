import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInstanceDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateInstanceDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class ProxySettingsDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  protocol?: string; // http | https | socks4 | socks5

  @IsString()
  @IsOptional()
  host?: string;

  @IsNumber()
  @IsOptional()
  port?: number;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  password?: string;
}

export class WebhookSettingsDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  url?: string;

  @IsArray()
  @IsOptional()
  events?: string[];
}

export class WebSocketSettingsDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsArray()
  @IsOptional()
  events?: string[];
}

export class RabbitMQSettingsDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  uri?: string;

  @IsString()
  @IsOptional()
  exchange?: string;

  @IsArray()
  @IsOptional()
  events?: string[];
}

export class SQSSettingsDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  accessKeyId?: string;

  @IsString()
  @IsOptional()
  secretAccessKey?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  queueUrl?: string;

  @IsArray()
  @IsOptional()
  events?: string[];
}

export class TypebotSettingsDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  apiUrl?: string;

  @IsString()
  @IsOptional()
  publicName?: string;

  @IsString()
  @IsOptional()
  triggerType?: string;

  @IsString()
  @IsOptional()
  triggerOperator?: string;

  @IsString()
  @IsOptional()
  keyword?: string;

  @IsNumber()
  @IsOptional()
  expireMinutes?: number;

  @IsString()
  @IsOptional()
  keywordFinish?: string;

  @IsNumber()
  @IsOptional()
  delayMessage?: number;

  @IsString()
  @IsOptional()
  unknownMessage?: string;

  @IsBoolean()
  @IsOptional()
  listeningFromMe?: boolean;

  @IsBoolean()
  @IsOptional()
  stopBotFromMe?: boolean;

  @IsBoolean()
  @IsOptional()
  keepOpen?: boolean;

  @IsNumber()
  @IsOptional()
  debounceTime?: number;
}

export class N8nSettingsDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  webhookUrl?: string;

  @IsString()
  @IsOptional()
  basicAuthUser?: string;

  @IsString()
  @IsOptional()
  basicAuthPassword?: string;

  @IsString()
  @IsOptional()
  triggerType?: string;

  @IsString()
  @IsOptional()
  triggerOperator?: string;

  @IsString()
  @IsOptional()
  keyword?: string;

  @IsNumber()
  @IsOptional()
  expireMinutes?: number;

  @IsString()
  @IsOptional()
  keywordFinish?: string;

  @IsNumber()
  @IsOptional()
  delayMessage?: number;

  @IsString()
  @IsOptional()
  unknownMessage?: string;

  @IsBoolean()
  @IsOptional()
  listeningFromMe?: boolean;

  @IsBoolean()
  @IsOptional()
  stopBotFromMe?: boolean;

  @IsBoolean()
  @IsOptional()
  keepOpen?: boolean;

  @IsNumber()
  @IsOptional()
  debounceTime?: number;

  @IsBoolean()
  @IsOptional()
  splitMessages?: boolean;
}

export class ChatwootSettingsDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  accountId?: string;

  @IsString()
  @IsOptional()
  token?: string;

  @IsBoolean()
  @IsOptional()
  signMessages?: boolean;

  @IsString()
  @IsOptional()
  signDelimiter?: string;

  @IsString()
  @IsOptional()
  nameInbox?: string;

  @IsString()
  @IsOptional()
  organization?: string;

  @IsString()
  @IsOptional()
  logo?: string;

  @IsBoolean()
  @IsOptional()
  conversationPending?: boolean;

  @IsBoolean()
  @IsOptional()
  reopenConversation?: boolean;

  @IsBoolean()
  @IsOptional()
  importContacts?: boolean;

  @IsBoolean()
  @IsOptional()
  importMessages?: boolean;

  @IsNumber()
  @IsOptional()
  daysLimitImport?: number;

  @IsString()
  @IsOptional()
  ignoreJids?: string;

  @IsBoolean()
  @IsOptional()
  autoCreate?: boolean;
}

export class UpdateSettingsDto {
  @IsBoolean()
  @IsOptional()
  rejectCalls?: boolean;

  @IsBoolean()
  @IsOptional()
  ignoreGroups?: boolean;

  @IsBoolean()
  @IsOptional()
  alwaysOnline?: boolean;

  @IsBoolean()
  @IsOptional()
  readMessages?: boolean;

  @IsBoolean()
  @IsOptional()
  syncFullHistory?: boolean;

  @IsBoolean()
  @IsOptional()
  readStatus?: boolean;

  @ValidateNested()
  @Type(() => ProxySettingsDto)
  @IsOptional()
  proxy?: ProxySettingsDto;

  @ValidateNested()
  @Type(() => WebhookSettingsDto)
  @IsOptional()
  webhook?: WebhookSettingsDto;

  @ValidateNested()
  @Type(() => WebSocketSettingsDto)
  @IsOptional()
  websocket?: WebSocketSettingsDto;

  @ValidateNested()
  @Type(() => RabbitMQSettingsDto)
  @IsOptional()
  rabbitmq?: RabbitMQSettingsDto;

  @ValidateNested()
  @Type(() => SQSSettingsDto)
  @IsOptional()
  sqs?: SQSSettingsDto;

  @ValidateNested()
  @Type(() => TypebotSettingsDto)
  @IsOptional()
  typebot?: TypebotSettingsDto;

  @ValidateNested()
  @Type(() => N8nSettingsDto)
  @IsOptional()
  n8n?: N8nSettingsDto;

  @ValidateNested()
  @Type(() => ChatwootSettingsDto)
  @IsOptional()
  chatwoot?: ChatwootSettingsDto;
}


export class SharedTokenDto {
  @IsString()
  @IsNotEmpty()
  instanceId: string;

  @IsNumber()
  @IsOptional()
  expiresInHours?: number;

  @IsOptional()
  permissions?: string[];
}
