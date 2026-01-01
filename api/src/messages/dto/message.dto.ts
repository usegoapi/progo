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

export class SendLocationDto {
  @IsString() instanceId: string;
  @IsString() to: string;
  @IsNumber() latitude: number;
  @IsNumber() longitude: number;
}

export class ButtonDto {
  @IsString() text: string;
}

export class SendButtonsDto {
  @IsString() instanceId: string;
  @IsString() to: string;
  @IsString() text: string;
  @IsOptional() @IsString() footer?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ButtonDto)
  buttons: ButtonDto[];
}

export class CarouselButtonDto {
  @IsString() type: string;
  @IsString() displayText: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() id?: string;
}

export class CarouselCardDto {
  @IsString() imageUrl: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CarouselButtonDto)
  buttons: CarouselButtonDto[];
}

export class SendCarouselDto {
  @IsString() instanceId: string;
  @IsString() to: string;
  @IsString() bodyText: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CarouselCardDto)
  cards: CarouselCardDto[];
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

export class InteractiveButtonDto {
  @IsString() type: string;
  @IsString() displayText: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() phoneNumber?: string;
  @IsOptional() @IsString() copyCode?: string;
  @IsOptional() @IsString() id?: string;
}

export class SendInteractiveButtonsDto {
  @IsString() instanceId: string;
  @IsString() to: string;
  @IsString() text: string;
  @IsOptional() @IsString() footer?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => InteractiveButtonDto)
  buttons: InteractiveButtonDto[];
}
