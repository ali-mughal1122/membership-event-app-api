import { Entity, PrimaryGeneratedColumn, Column, DeleteDateColumn } from 'typeorm';

@Entity()
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('decimal')
  price: number;

  @Column('int')
  durationMonths: number;

  @Column('simple-array', { nullable: true })
  features: string[];

  @DeleteDateColumn()
  deletedAt?: Date;
}
