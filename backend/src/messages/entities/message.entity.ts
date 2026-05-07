import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Contact } from '../../contacts/entities/contact.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'contact_id', nullable: true })
  contactId: string;

  @ManyToOne(() => Contact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;

  @Index()
  @Column({ name: 'conversation_id', nullable: true })
  conversationId: string;

  @ManyToOne('Conversation', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: any;

  @Column({ type: 'text' })
  text: string;

  /** 'lead' | 'ia' | 'humano' */
  @Column({ default: 'lead' })
  sender: string;

  /** 'sent' | 'delivered' | 'read' */
  @Column({ default: 'sent' })
  status: string;

  /** Which Evolution instance sent/received this */
  @Column({ name: 'instance_name', nullable: true })
  instanceName: string;

  /** WhatsApp message ID for dedup */
  @Column({ name: 'wa_message_id', nullable: true })
  waMessageId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
