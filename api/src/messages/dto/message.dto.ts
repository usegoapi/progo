import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class SendTextDto {
  @IsString() instanceId: string;
  @IsString() to: string;
  @IsString() text: string;
}

export class SendImageDto {
  @IsString() instanceId: string;
  @IsString() to: string;
  @IsString() imageUrl: string;
  @IsOptional() @IsString() caption?: string;
}

export class SendAudioDto {
  @IsString() instanceId: string;
  @IsString() to: string;
  @IsString() audioUrl: string;
  @IsOptional() @IsBoolean() ptt?: boolean;
}

export class SendVideoDto {
  @IsString() instanceId: string;
  @IsString() to: string;
  @IsString() videoUrl: string;
  @IsOptional() @IsString() caption?: string;
}

export class SendDocumentDto {
  @IsString() instanceId: string;
  @IsString() to: string;
  @IsString() documentUrl: string;
  @IsOptional() @IsString() filename?: string;
  @IsOptional() @IsString() caption?: string;
}

export class SendContactDto {
  @IsString() instanceId: string;
  @IsString() to: string;
  @IsString() contactName: string;
  @IsString() contactPhone: string;
  @IsOptional() @IsString() organization?: string;
}

export class SendLocationDto {
  @IsString() instanceId: string;
  @IsString() to: string;
  @IsNumber() latitude: number;
  @IsNumber() longitude: number;
}

export class SendPixDto {
  @IsString() instanceId: string;
  @IsString() to: string;
  @IsString() text: string;
  @IsOptional() @IsString() footer?: string;
  @IsOptional() @IsString() title?: string;
  @IsNumber() amount: number;
  @IsString() merchantName: string;
  @IsString() pixKey: string;
  @IsString() pixKeyType: string;
  @IsOptional() @IsString() productName?: string;
}

export class ListRowDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsString() rowId: string;
}

export class ListSectionDto {
  @IsString() title: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ListRowDto)
  rows: ListRowDto[];
}

export class SendListDto {
  @IsString() instanceId: string;
  @IsString() to: string;
  @IsString() text: string;
  @IsString() buttonText: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() footer?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ListSectionDto)
  sections: ListSectionDto[];
}

export class SendPollDto {
  @IsString() instanceId: string;
  @IsString() to: string;
  @IsString() question: string;
  @IsArray() @IsString({ each: true }) options: string[];
  @IsOptional() @IsNumber() selectableCount?: number;
}
