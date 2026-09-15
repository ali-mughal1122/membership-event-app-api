import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Vehicle breakdown' })
  name: string;

  @ApiProperty({ example: 'Taxi is out of service and needs immediate assistance.' })
  description: string;

  @ApiProperty({ example: 'CRITICAL' })
  urgency: string;

  @ApiProperty()
  createdAt: Date;
}
