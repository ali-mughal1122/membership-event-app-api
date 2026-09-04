import { ApiProperty } from '@nestjs/swagger';

export class PlanResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6' })
  id: string;

  @ApiProperty({ example: 'Premium Plan' })
  name: string;

  @ApiProperty({ example: 49.99 })
  price: number;

  @ApiProperty({ example: 12 })
  durationMonths: number;
}
