import { Injectable, UnauthorizedException, OnModuleInit, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PasswordUtil } from './password.util';
import { UserRole } from '../users/entities/user.entity';

import { DataSource } from 'typeorm';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    // 1. Reparo de dados (Migração interna)
    try {
      this.logger.log('--- [AuthService] INICIANDO REPARO MULTI-TENANT ---');
      
      const defaultCompany = 'default-company';

      // 1. Garantir que a empresa padrão existe
      await this.dataSource.query(`
        INSERT INTO companies (id, name, slug, active, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'Default Company', $1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (slug) DO NOTHING
      `, [defaultCompany]);

      const companies = await this.dataSource.query(`SELECT id FROM companies WHERE slug = $1 LIMIT 1`, [defaultCompany]);
      const defaultCompanyId = companies[0]?.id;

      if (!defaultCompanyId) {
        throw new Error('Falha ao criar/recuperar empresa padrão');
      }

      // 2. Garantir Empresa B para testes (Tenant B) - MOVIDO PARA O TOPO PARA GARANTIR EXECUÇÃO
      try {
        this.logger.log('--- [AuthService] SEEDING EMPRESA B ---');
        const tenantBName = 'Empresa B';
        const tenantBSlug = 'empresa-b';
        
        await this.dataSource.query(`
          INSERT INTO companies (id, name, slug, active, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (slug) DO NOTHING
        `, [tenantBName, tenantBSlug]);

        const companiesB = await this.dataSource.query(`SELECT id FROM companies WHERE slug = $1 LIMIT 1`, [tenantBSlug]);
        const tenantBId = companiesB[0]?.id;

        if (tenantBId) {
          const gestorEmail = 'gestor@empresa-b.com';
          const gestor = await this.usersService.findByEmail(gestorEmail);
          if (!gestor) {
            this.logger.log(`[AuthService] Criando gestor para Empresa B: ${gestorEmail}`);
            await this.usersService.create({
              name: 'Gestor B',
              email: gestorEmail,
              passwordHash: 'admin123',
              role: UserRole.ADMIN,
              active: true,
              companyId: tenantBId
            });
          } else {
            this.logger.log(`[AuthService] Resetando senha e empresa do gestor B: ${gestorEmail}`);
            await this.usersService.resetPassword(gestorEmail, 'admin123');
            await this.dataSource.query(`UPDATE users SET company_id = $1::uuid, active = true WHERE email = $2`, [tenantBId, gestorEmail]);
          }
        }
      } catch (seedErr) {
        this.logger.error(`[AuthService] FALHA NO SEEDING DA EMPRESA B: ${seedErr.message}`);
      }
      
      // 3. Tabelas para reparar (Antigo Step 2)
      const configs = [
        { table: 'users', col: 'company_id' },
        { table: 'contacts', col: 'company_id' },
        { table: 'evolution_instances', col: 'company_id' },
        { table: 'conversations', col: 'company_id' },
        { table: 'ai_configs', col: 'company_id' },
        { table: 'campaigns', col: 'company_id' },
        { table: 'messages', col: 'company_id' }
      ];

      for (const config of configs) {
        try {
          await this.dataSource.query(
            `UPDATE ${config.table} SET ${config.col} = $1::uuid 
             WHERE ${config.col} IS NULL 
                OR ${config.col}::text = '' 
                OR ${config.col}::text = 'undefined' 
                OR ${config.col}::text = 'default-company'`,
            [defaultCompanyId]
          );
        } catch (e) {
          this.logger.warn(`[AuthService] Aviso ao reparar tabela "${config.table}": ${e.message}`);
        }
      }
      
      // 4. Migração de Mensagens para Conversas (Antigo Step 3)
      try {
        await this.dataSource.query(`
          UPDATE messages m
          SET company_id = c.company_id
          FROM contacts c
          WHERE m.contact_id = c.id AND (m.company_id IS NULL OR m.company_id::text = '')
        `);

        const orphanGroups = await this.dataSource.query(`
          SELECT DISTINCT m.contact_id, m.instance_name, COALESCE(c.company_id, $1::uuid) as company_id
          FROM messages m
          JOIN contacts c ON m.contact_id = c.id
          WHERE m.conversation_id IS NULL
        `, [defaultCompanyId]);

        if (orphanGroups.length > 0) {
          this.logger.log(`[AuthService] Migrando ${orphanGroups.length} grupos de mensagens órfãs...`);
          for (const group of orphanGroups) {
            const { contact_id, instance_name, company_id } = group;
            const convResult = await this.dataSource.query(`
              INSERT INTO conversations (id, contact_id, company_id, instance_name, channel, status, ai_enabled, created_at, updated_at)
              VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, 'whatsapp', 'open', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT (company_id, contact_id, instance_name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
              RETURNING id
            `, [contact_id, company_id, instance_name]);
            
            const conversationId = convResult[0].id;
            await this.dataSource.query(`
              UPDATE messages 
              SET conversation_id = $1::uuid 
              WHERE contact_id = $2::uuid AND instance_name = $3 AND conversation_id IS NULL
            `, [conversationId, contact_id, instance_name]);
          }
        }
      } catch (migErr) {
        this.logger.error(`[AuthService] Erro na migração de conversas: ${migErr.message}`);
      }
      
      this.logger.log('--- [AuthService] REPARO DE DADOS CONCLUÍDO ---');
    } catch (err) {
      this.logger.error(`[AuthService] FALHA CRÍTICA NO REPARO: ${err.message}`);
    }

    // 2. Seed first admin if no users exist
    const count = await this.usersService.countAll();
    if (count === 0) {
      console.log('Nenhum usuário encontrado. Criando primeiro admin...');
      await this.usersService.create({
        name: 'Admin',
        email: 'admin@leadflow.com',
        passwordHash: 'admin123',
        role: UserRole.ADMIN,
        active: true,
      });
      this.logger.log('Primeiro admin criado: admin@leadflow.com / admin123');
    }
  }

  async login(email: string, pass: string) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    this.logger.log(`[LOGIN] Tentativa para: ${normalizedEmail}`);
    const user = await this.usersService.findByEmail(normalizedEmail);
    
    if (!user) {
      this.logger.warn(`[LOGIN] Usuário não encontrado: ${email}`);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    this.logger.log(`[LOGIN] Usuário encontrado: ${user.email} | Active: ${user.active} | Role: ${user.role} | CompanyId: ${user.companyId}`);

    if (!user.active) {
      this.logger.warn(`[LOGIN] Usuário inativo: ${email}`);
      throw new UnauthorizedException('Usuário inativo');
    }
    
    const isPasswordValid = PasswordUtil.verifyPassword(pass, user.passwordHash);
    this.logger.log(`[LOGIN] Resultado senha: ${isPasswordValid ? 'OK' : 'FALHA'}`);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.companyId) {
      this.logger.error(`[LOGIN] Usuário SEM companyId: ${email}`);
      throw new UnauthorizedException('Usuário sem empresa vinculada');
    }

    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role, 
      companyId: user.companyId
    };
    
    const { passwordHash, ...result } = user;
    
    return {
      token: await this.jwtService.signAsync(payload),
      user: result,
    };
  }
}
