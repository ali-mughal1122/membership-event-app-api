import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Unique, JoinColumn } from 'typeorm';
import { Event } from './event.entity';
import { User } from '../../auth/entities/user.entity';

export const RegistrationStatus = {
  REGISTERED: 'REGISTERED',
  CANCELLED: 'CANCELLED',
} as const;

@Entity()
@Unique('UQ_event_registration_event_user', ['eventId', 'userId'])
export class EventRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: RegistrationStatus.REGISTERED })
  status: string;

  @CreateDateColumn()
  timestamp: Date;

  @Column()
  eventId: string;

  @Column()
  userId: string;

  @ManyToOne(() => Event, event => event.registrants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
