import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UpdateWhatsAppSettingDto {
  @ApiProperty({ description: 'Country calling code (e.g. +45, +1, +44)', example: '+45' })
  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @ApiProperty({ description: 'Phone number without country code', example: '12345678' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({ description: 'Whether the WhatsApp floating icon is enabled', example: true })
  @IsBoolean()
  isEnabled: boolean;
}

