import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ai_configs')
export class AiConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Internal slug: "NOME_IA - EMPRESA - PRODUTO" */
  @Column({ name: 'internal_name', nullable: true })
  internalName: string;

  @Column({ name: 'display_name', nullable: true })
  displayName: string;

  @Column({ nullable: true })
  company: string;

  @Column({ nullable: true })
  segment: string;

  @Column({ nullable: true })
  product: string;

  @Column({ nullable: true })
  audience: string;

  @Column({ type: 'text', nullable: true })
  problem: string;

  @Column({ type: 'text', nullable: true })
  benefit: string;

  @Column({ type: 'text', nullable: true })
  tone: string;

  @Column({ name: 'qualified_criteria', type: 'text', nullable: true })
  qualifiedCriteria: string;

  /** Discovery questions stored as JSON */
  @Column({ type: 'jsonb', nullable: true })
  discovery: Record<string, string>;

  @Column({ name: 'never_promise', type: 'text', nullable: true })
  neverPromise: string;

  @Column({ name: 'never_ask', type: 'text', nullable: true })
  neverAsk: string;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  /** Objetivo principal da IA na conversa */
  @Column({ type: 'text', nullable: true })
  goal: string;

  /** Nível de formalidade: Informal, Equilibrado, Formal */
  @Column({ nullable: true })
  formality: string;

  /** Tamanho das respostas: Curtas, Médias, Detalhadas */
  @Column({ name: 'response_length', nullable: true })
  responseLength: string;

  /** Diferenciais do produto/serviço */
  @Column({ type: 'text', nullable: true })
  differentials: string;

  /** Fatores que influenciam o preço */
  @Column({ name: 'pricing_factors', type: 'text', nullable: true })
  pricingFactors: string;

  /** Região de atendimento */
  @Column({ nullable: true })
  region: string;

  /** Mensagem inicial personalizada */
  @Column({ name: 'initial_message', type: 'text', nullable: true })
  initialMessage: string;

  /** Flow configuration (templates, timeouts) as JSON */
  @Column({ type: 'jsonb', nullable: true })
  flow: Record<string, any>;

  /** Which Evolution instance is linked */
  @Column({ name: 'evolution_instance', nullable: true })
  evolutionInstance: string;

  @Column({ name: 'company_id', nullable: true })
  companyId: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
