import { IsString, IsArray, IsBoolean, IsOptional } from 'class-validator';

export class CreateWebhookDto {
  @IsString() url: string;
  @IsArray() @IsString({ each: true }) events: string[];
}

export class UpdateWebhookDto {
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) events?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}
