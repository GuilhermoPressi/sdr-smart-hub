import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name: string;

  @Column({ name: 'company_name', nullable: true })
  companyName: string;

  @Column({ name: 'job_title', nullable: true })
  jobTitle: string;

  @Index()
  @Column({ nullable: true })
  email: string;

  @Index()
  @Column({ nullable: true })
  phone: string;

  @Index()
  @Column({ name: 'profile_url', nullable: true })
  profileUrl: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  username: string;

  @Column({ default: 'manual' })
  source: string;

  @Column({ default: 'novo' })
  stage: string;

  @Column({ name: 'ia_status', default: 'Aguardando' })
  iaStatus: string;

  @Column({ default: 'Frio' })
  temperature: string;

  @Column({ default: 'Novo' })
  status: string;

  @Column({ nullable: true })
  origin: string;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @Column({ nullable: true })
  crm: string;

  @Column({ name: 'last_interaction', nullable: true })
  lastInteraction: Date;

  @Column({ name: 'company_id', nullable: true })
  companyId: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  /** Etapa atual do fluxo de conversa (id do ConversationStep) */
  @Column({ name: 'conversation_stage', nullable: true })
  conversationStage: string;

  /** True quando IA fez handoff e aguarda atendente humano */
  @Column({ name: 'waiting_human_reply', default: false })
  waitingHumanReply: boolean;

  /** Motivo do handoff (keyword detectada) */
  @Column({ name: 'handoff_reason', nullable: true })
  handoffReason: string;

  /** Timestamp de quando o handoff aconteceu */
  @Column({ name: 'handoff_at', nullable: true })
  handoffAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
