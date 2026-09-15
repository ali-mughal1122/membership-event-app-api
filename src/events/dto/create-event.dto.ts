import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'Tech Conference 2026' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'A conference about technology.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: '2026-10-15T10:00:00Z' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'San Francisco, CA' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ example: 'Published', required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ example: '10:00 AM', required: false })
  @IsString()
  @IsOptional()
  time?: string;

  @ApiProperty({ example: 'https://images.unsplash.com/...', required: false })
  @IsString()
  @IsOptional()
  banner?: string;

  @ApiProperty({ example: '/events/tech-conf', required: false })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiProperty({ required: false })
  @IsArray()
  @IsOptional()
  agenda?: any[];

  @ApiProperty({ example: true, required: false, description: 'When true, only active members can register.' })
  @IsBoolean()
  @IsOptional()
  membershipRequired?: boolean;

  @ApiProperty({ example: '2026-10-01T00:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  registrationDeadline?: string;
}
