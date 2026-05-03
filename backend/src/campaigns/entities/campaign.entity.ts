import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name: string;

  /** pending | sending | paused | completed | failed */
  @Column({ default: 'pending' })
  status: string;

  /** free_text | template (future) */
  @Column({ name: 'message_type', default: 'free_text' })
  messageType: string;

  @Column({ type: 'text' })
  message: string;

  /** Template fields for future API oficial */
  @Column({ name: 'template_name', nullable: true })
  templateName: string;

  @Column({ name: 'template_variables', type: 'jsonb', nullable: true })
  templateVariables: string[];

  /** Evolution instance to send from */
  @Column({ name: 'instance_name', default: 'Gpressi' })
  instanceName: string;

  /** Source: crm | list | tag | csv */
  @Column({ name: 'source_type', nullable: true })
  sourceType: string;

  @Column({ name: 'source_id', nullable: true })
  sourceId: string;

  @Column({ default: 0 })
  total: number;

  @Column({ default: 0 })
  sent: number;

  @Column({ default: 0 })
  failed: number;

  /** Delay between messages in seconds */
  @Column({ name: 'delay_seconds', default: 8 })
  delaySeconds: number;

  /** Max messages per minute */
  @Column({ name: 'limit_per_minute', default: 15 })
  limitPerMinute: number;

  /** Randomize delay for human-like behavior */
  @Column({ name: 'simulate_human', default: true })
  simulateHuman: boolean;

  @Column({ name: 'company_id', nullable: true })
  companyId: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
