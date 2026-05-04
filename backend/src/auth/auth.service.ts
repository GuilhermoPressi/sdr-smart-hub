import { Injectable, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PasswordUtil } from './password.util';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async onModuleInit() {
    // Seed first admin if no users exist
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

    const payload = { sub: user.id, email: user.email, role: user.role };
    
    const { passwordHash, ...result } = user;
    
    return {
      token: await this.jwtService.signAsync(payload),
      user: result,
    };
  }
}
