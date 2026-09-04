import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMemberDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6', required: false })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6' })
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ example: '2026-07-01T00:00:00Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2027-07-01T00:00:00Z' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 'ACTIVE', required: false })
  @IsString()
  @IsOptional()
  status?: string;
}
