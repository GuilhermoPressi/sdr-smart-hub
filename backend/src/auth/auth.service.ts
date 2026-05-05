import { Injectable, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PasswordUtil } from './password.util';
import { UserRole } from '../users/entities/user.entity';

import { DataSource } from 'typeorm';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    // 1. Reparo de dados (Migração interna)
    // Garante que todos os registros sem empresa recebam a empresa 'default-company'
    try {
      console.log('[AuthService] Iniciando reparo de dados (multi-tenant isolation)...');
      
      const defaultCompany = 'default-company';
      
      // Update users
      await this.dataSource.query(`UPDATE users SET company_id = $1 WHERE company_id IS NULL`, [defaultCompany]);
      
      // Update contacts
      await this.dataSource.query(`UPDATE contacts SET company_id = $1 WHERE company_id IS NULL`, [defaultCompany]);
      
      // Update evolution_instances
      await this.dataSource.query(`UPDATE evolution_instances SET company_id = $1 WHERE company_id IS NULL`, [defaultCompany]);
      
      console.log('[AuthService] Reparo de dados concluído.');
    } catch (err) {
      console.error('[AuthService] Erro ao reparar dados:', err.message);
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
      console.log('Primeiro admin criado: admin@leadflow.com / admin123');
    }
  }

  async login(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    if (!user.active) {
      throw new UnauthorizedException('Usuário inativo');
    }
    
    if (!PasswordUtil.verifyPassword(pass, user.passwordHash)) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role, 
      companyId: user.companyId || (user.role === UserRole.ADMIN ? 'default-company' : null) 
    };
    
    const { passwordHash, ...result } = user;
    
    return {
      token: await this.jwtService.signAsync(payload),
      user: result,
    };
  }
}
