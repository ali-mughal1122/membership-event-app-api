import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Category } from '../../categories/entities/category.entity';
import { SupportMessage } from './support-message.entity';
import { SupportStatus } from '../support.constants';

@Entity()
export class SupportConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  categoryId: string;

  @ManyToOne(() => Category, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ length: 160 })
  subject: string;

  @Column({ default: SupportStatus.OPEN })
  status: string;

  @Column({ type: 'text' })
  lastMessage: string;

  @Column({ type: 'timestamptz' })
  lastMessageAt: Date;

  @Column({ type: 'varchar' })
  lastSenderType: string;

  @Column({ default: true })
  unreadForAdmin: boolean;

  @Column({ default: false })
  unreadForMember: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => SupportMessage, (message) => message.conversation)
  messages: SupportMessage[];
}
