import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('whatsapp_settings')
export class WhatsAppSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10, default: '+45' })
  countryCode: string;

  @Column({ type: 'varchar', length: 30, default: '' })
  phoneNumber: string;

  @Column({ type: 'boolean', default: false })
  isEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

