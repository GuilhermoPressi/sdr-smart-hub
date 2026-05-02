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
  @Column({ name: 'contact_id' })
  contactId: string;

  @ManyToOne(() => Contact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;

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
