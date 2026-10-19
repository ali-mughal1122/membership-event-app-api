import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Jane Doe', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: '+4512345678', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(25)
  phone?: string;

  @ApiProperty({ example: 'Copenhagen, Denmark', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @ApiProperty({ example: 'data:image/png;base64,...', required: false })
  @IsString()
  @IsOptional()
  profileImage?: string;
}
