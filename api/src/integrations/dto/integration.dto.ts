import { IsString, IsBoolean, IsOptional, IsNumber, IsObject } from 'class-validator';

// ==================== TYPEBOT ====================
export class CreateTypebotDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() apiUrl?: string;
  @IsOptional() @IsString() publicName?: string;
  @IsOptional() @IsString() triggerType?: string; // keyword | all | advanced | none
  @IsOptional() @IsString() triggerOperator?: string; // contains | equals | startsWith | endsWith | regex
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsNumber() expireMinutes?: number;
  @IsOptional() @IsString() keywordFinish?: string;
  @IsOptional() @IsNumber() delayMessage?: number;
  @IsOptional() @IsString() unknownMessage?: string;
  @IsOptional() @IsBoolean() listeningFromMe?: boolean;
  @IsOptional() @IsBoolean() stopBotFromMe?: boolean;
  @IsOptional() @IsBoolean() keepOpen?: boolean;
  @IsOptional() @IsNumber() debounceTime?: number;
}

// ==================== N8N ====================
export class CreateN8nDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() webhookUrl?: string;
  @IsOptional() @IsString() basicAuthUser?: string;
  @IsOptional() @IsString() basicAuthPassword?: string;
  @IsOptional() @IsString() triggerType?: string; // keyword | all | advanced | none
  @IsOptional() @IsString() triggerOperator?: string; // contains | equals | startsWith | endsWith | regex
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsNumber() expireMinutes?: number;
  @IsOptional() @IsString() keywordFinish?: string;
  @IsOptional() @IsNumber() delayMessage?: number;
  @IsOptional() @IsString() unknownMessage?: string;
  @IsOptional() @IsBoolean() listeningFromMe?: boolean;
  @IsOptional() @IsBoolean() stopBotFromMe?: boolean;
  @IsOptional() @IsBoolean() keepOpen?: boolean;
  @IsOptional() @IsNumber() debounceTime?: number;
  @IsOptional() @IsBoolean() splitMessages?: boolean;
}

// ==================== CHATWOOT ====================
export class CreateChatwootDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() sqs?: boolean;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsString() token?: string;
  @IsOptional() @IsBoolean() signMessages?: boolean;
  @IsOptional() @IsString() signDelimiter?: string;
  @IsOptional() @IsString() nameInbox?: string;
  @IsOptional() @IsString() organization?: string;
  @IsOptional() @IsString() logo?: string;
  @IsOptional() @IsBoolean() conversationPending?: boolean;
  @IsOptional() @IsBoolean() reopenConversation?: boolean;
  @IsOptional() @IsBoolean() importContacts?: boolean;
  @IsOptional() @IsBoolean() importMessages?: boolean;
  @IsOptional() @IsNumber() daysLimitImport?: number;
  @IsOptional() @IsString() ignoreJids?: string;
  @IsOptional() @IsBoolean() autoCreate?: boolean;
}

// ==================== UPDATE ====================
export class UpdateIntegrationDto {
  @IsOptional() @IsObject() config?: any;
  @IsOptional() @IsBoolean() active?: boolean;
}
