import { ApiProperty } from '@nestjs/swagger';

export class WhatsAppSettingPublicResponseDto {
  @ApiProperty({ description: 'Whether the WhatsApp floating icon should be displayed', example: true })
  isEnabled: boolean;

  @ApiProperty({ description: 'Full WhatsApp Click-to-Chat URL', example: 'https://wa.me/4512345678', nullable: true })
  whatsappUrl: string | null;

  @ApiProperty({ description: 'Formatted international phone number for display', example: '+45 12345678', nullable: true })
  formattedNumber: string | null;
}

export class WhatsAppSettingAdminResponseDto {
  @ApiProperty({ example: 'b947cbe9-8134-45e3-a6d1-4475479be96d' })
  id: string;

  @ApiProperty({ example: '+45' })
  countryCode: string;

  @ApiProperty({ example: '12345678' })
  phoneNumber: string;

  @ApiProperty({ example: true })
  isEnabled: boolean;

  @ApiProperty({ example: 'https://wa.me/4512345678', nullable: true })
  whatsappUrl: string | null;

  @ApiProperty({ example: '+45 12345678', nullable: true })
  formattedNumber: string | null;

  @ApiProperty()
  updatedAt: Date;
}

