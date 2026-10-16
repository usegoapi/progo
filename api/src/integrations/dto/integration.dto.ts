import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ChatwootSettingsDto, N8nSettingsDto, TypebotSettingsDto } from '../../instances/dto/instance.dto';

export class CreateTypebotDto extends TypebotSettingsDto {
  @IsOptional() @IsString() @MaxLength(255) description?: string;
}

export class CreateN8nDto extends N8nSettingsDto {
  @IsOptional() @IsString() @MaxLength(255) description?: string;
}

export class CreateChatwootDto extends ChatwootSettingsDto {
  @IsOptional() @IsBoolean() sqs?: boolean;
}

export class UpdateIntegrationDto {
  @IsOptional() @IsObject() config?: Record<string, unknown>;
  @IsOptional() @IsBoolean() active?: boolean;
}
