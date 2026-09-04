import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Plan } from '../../plans/entities/plan.entity';

@Entity()
export class Member {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Plan)
  plan: Plan;

  @Column()
  startDate: Date;

  @Column()
  endDate: Date;

  @Column({ default: 'ACTIVE' })
  status: string;
}
