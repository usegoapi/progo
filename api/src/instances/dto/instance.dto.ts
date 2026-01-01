import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, ValidateNested } from 'class-validator';
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
