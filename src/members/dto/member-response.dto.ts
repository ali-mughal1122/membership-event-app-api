import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../auth/entities/user.entity';
import { Plan } from '../../plans/entities/plan.entity';

export class MemberResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6' })
  id: string;

  @ApiProperty({ type: () => User })
  user: User;

  @ApiProperty({ type: () => Plan })
  plan: Plan;

  @ApiProperty({ example: '2026-07-01T00:00:00Z' })
  startDate: Date;

  @ApiProperty({ example: '2027-07-01T00:00:00Z' })
  endDate: Date;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;
}
