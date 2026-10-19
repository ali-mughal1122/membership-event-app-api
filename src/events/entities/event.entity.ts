import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index } from 'typeorm';
import { EventRegistration } from './event-registration.entity';

@Entity()
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Index()
  @Column()
  date: Date;

  @Column()
  location: string;

  @Index()
  @Column({ default: 'Published' })
  status: string;

  @Column({ nullable: true })
  time: string;

  @Column({ nullable: true })
  banner: string;

  @Index()
  @Column({ nullable: true })
  slug: string;

  @Column({ type: 'jsonb', nullable: true, default: [] })
  agenda: any[];

  @Column({ default: true })
  membershipRequired: boolean;

  @Column({ type: 'timestamp', nullable: true })
  registrationDeadline: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  publishedNotificationSentAt: Date | null;

  @OneToMany(() => EventRegistration, registration => registration.event)
  registrants: EventRegistration[];
}
