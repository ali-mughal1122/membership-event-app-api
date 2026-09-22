import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: '8f4c2e...' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
