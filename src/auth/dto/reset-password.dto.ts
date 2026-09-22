import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: '8f4c2e...' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^])[A-Za-z\d@$!%*?&#^]{8,}$/, {
    message:
      'Password must be at least 8 characters long, contain at least 1 uppercase letter, 1 lowercase letter, 1 number, 1 special character (@$!%*?&#^), and have no spaces.',
  })
  newPassword: string;
}
