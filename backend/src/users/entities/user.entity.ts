import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  ATTENDANT = 'attendant',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({
    type: 'varchar',
    enum: UserRole,
    default: UserRole.ATTENDANT,
  })
  role: UserRole;

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'company_id', nullable: true })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.users)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
