import { IsString, IsObject, IsBoolean, IsOptional } from 'class-validator';

export class CreateTypebotDto {
  @IsString() webhookUrl: string;
  @IsOptional() @IsString() botId?: string;
}

export class CreateN8nDto {
  @IsString() webhookUrl: string;
  @IsOptional() @IsString() apiKey?: string;
}

export class CreateChatwootDto {
  @IsString() apiUrl: string;
  @IsString() apiKey: string;
  @IsString() accountId: string;
  @IsOptional() @IsString() inboxId?: string;
}

export class UpdateIntegrationDto {
  @IsOptional() @IsObject() config?: any;
  @IsOptional() @IsBoolean() active?: boolean;
}
