import { IsEmail, IsString, MinLength, IsOptional, IsNumber, IsArray } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class SharedTokenDto {
  @IsString()
  instanceId: string;

  @IsNumber()
  @IsOptional()
  expiresInHours?: number;

  @IsArray()
  @IsOptional()
  permissions?: string[];
}
