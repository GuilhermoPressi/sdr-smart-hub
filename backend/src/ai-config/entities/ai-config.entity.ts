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
  @Column({ name: 'internal_name' })
  internalName: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column()
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
