import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Unique, Index } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity()
@Unique('UQ_review_user', ['user'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('int')
  rating: number;

  @Column('text')
  comment: string;

  @ManyToOne(() => User)
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
