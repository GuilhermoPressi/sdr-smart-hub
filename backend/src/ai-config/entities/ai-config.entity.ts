import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// ── Types ────────────────────────────────────────────────────────────────

export interface ConversationStep {
  id: string;
  name: string;
  initialMessage: string;
  questions: string[];
  objective: string;
  nextStep: string;
  exitConditions: string[];
  requiredAnswers?: string[];
}

export interface KnowledgeBase {
  faq: { question: string; answer: string }[];
  urls: string[];
  files: { name: string; uploadedAt: string }[];
  priority?: 'faq_first' | 'ai_first';
}

export interface AutoRules {
  transferKeywords: string[];
  followUpEnabled: boolean;
  followUpHours: number;
  moveOnQualify: boolean;
  qualifyStage: string;
  pauseOnHumanReply: boolean;
}

// ── Entity ───────────────────────────────────────────────────────────────

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

  /** Discovery questions stored as JSON (legacy) */
  @Column({ type: 'jsonb', nullable: true })
  discovery: Record<string, string>;

  @Column({ name: 'never_promise', type: 'text', nullable: true })
  neverPromise: string;

  @Column({ name: 'never_ask', type: 'text', nullable: true })
  neverAsk: string;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  @Column({ type: 'text', nullable: true })
  goal: string;

  @Column({ nullable: true })
  formality: string;

  @Column({ name: 'response_length', nullable: true })
  responseLength: string;

  @Column({ type: 'text', nullable: true })
  differentials: string;

  @Column({ name: 'pricing_factors', type: 'text', nullable: true })
  pricingFactors: string;

  @Column({ nullable: true })
  region: string;

  @Column({ name: 'initial_message', type: 'text', nullable: true })
  initialMessage: string;

  // ── NEW: 4 Abas ────────────────────────────────────────────────────────

  /** Aba 1: Fluxo de Atendimento — etapas com controle de estado */
  @Column({ name: 'conversation_flow', type: 'jsonb', nullable: true })
  conversationFlow: ConversationStep[];

  /** Aba 2: Comportamento — regras de conduta da IA */
  @Column({ name: 'behavior_rules', type: 'jsonb', nullable: true })
  behaviorRules: string[];

  /** Aba 3: Conhecimento — FAQ, URLs, Arquivos */
  @Column({ type: 'jsonb', nullable: true })
  knowledge: KnowledgeBase;

  /** Aba 4: Regras Automáticas — gatilhos e automações */
  @Column({ name: 'auto_rules', type: 'jsonb', nullable: true })
  autoRules: AutoRules;

  // ── Existing fields ────────────────────────────────────────────────────

  /** Legacy flow configuration */
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
