import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ example: 'We checked your registration. Please try again now.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;
}
