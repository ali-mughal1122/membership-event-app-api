import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({ example: 'I cannot register for an event' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  subject: string;

  @ApiProperty({ example: 'I am having an issue with my event registration.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;
}
