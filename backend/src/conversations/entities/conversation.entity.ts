import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Contact } from '../../contacts/entities/contact.entity';

@Entity('conversations')
@Index(['companyId', 'contactId', 'instanceName'], { unique: true })
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contact_id' })
  contactId: string;

  @ManyToOne(() => Contact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ default: 'whatsapp' })
  channel: string;

  @Column({ name: 'instance_name', nullable: true })
  instanceName: string;

  @Column({ default: 'open' }) // 'open', 'closed'
  status: string;

  @Column({ name: 'ai_enabled', default: true })
  aiEnabled: boolean;

  @Column({ name: 'current_stage', nullable: true })
  currentStage: string;

  @Column({ name: 'unread_count', default: 0 })
  unreadCount: number;

  @Column({ name: 'last_message_at', nullable: true })
  lastMessageAt: Date;

  @Column({ name: 'waiting_human_reply', default: false })
  waitingHumanReply: boolean;

  @Column({ name: 'handoff_reason', nullable: true })
  handoffReason: string;

  @Column({ name: 'handoff_at', nullable: true })
  handoffAt: Date;

  @Column({ name: 'next_ai_reply_at', nullable: true })
  nextAiReplyAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
