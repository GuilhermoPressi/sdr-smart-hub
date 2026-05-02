import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export enum SearchStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('apify_lead_searches')
export class ApifyLeadSearch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', nullable: true })
  companyId: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column()
  source: string;

  @Column()
  query: string;

  @Column({ type: 'enum', enum: SearchStatus, default: SearchStatus.PENDING })
  status: SearchStatus;

  @Column({ name: 'total_found', default: 0 })
  totalFound: number;

  @Column({ name: 'total_imported', default: 0 })
  totalImported: number;

  @Column({ name: 'apify_run_id', nullable: true })
  apifyRunId: string;

  @Column({ nullable: true, type: 'text' })
  error: string;

  // Leads crus armazenados para importação posterior
  @Column({ type: 'jsonb', nullable: true })
  leads: any[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
