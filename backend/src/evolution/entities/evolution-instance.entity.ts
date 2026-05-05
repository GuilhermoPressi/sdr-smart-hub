import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('evolution_instances')
export class EvolutionInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Index({ unique: true })
  @Column({ name: 'instance_name', unique: true })
  instanceName: string;

  @Column({ name: 'phone_number', nullable: true })
  phoneNumber: string;

  @Column({ default: 'disconnected' })
  status: string;

  @Column({ name: 'qr_code', type: 'text', nullable: true })
  qrCode: string;

  @Index()
  @Column({ name: 'company_id', nullable: true })
  companyId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
