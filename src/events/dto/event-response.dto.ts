import { ApiProperty } from '@nestjs/swagger';

export class EventResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6' })
  id: string;

  @ApiProperty({ example: 'Tech Conference 2026' })
  title: string;

  @ApiProperty({ example: 'A conference about technology.' })
  description: string;

  @ApiProperty({ example: '2026-10-15T10:00:00Z' })
  date: Date;

  @ApiProperty({ example: 'San Francisco, CA' })
  location: string;
}
