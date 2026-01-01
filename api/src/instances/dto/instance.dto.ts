import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

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
}
