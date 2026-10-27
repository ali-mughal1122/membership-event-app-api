import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Plan } from '../../plans/entities/plan.entity';

@Entity()
@Index(['status', 'endDate'])
@Index(['user'])
export class Member {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Plan)
  plan: Plan;

  @Column()
  startDate: Date;

  @Index()
  @Column()
  endDate: Date;

  @Index()
  @Column({ default: 'ACTIVE' })
  status: string;
}
