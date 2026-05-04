import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { PasswordUtil } from '../auth/password.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async countAll(): Promise<number> {
    return this.usersRepository.count();
  }

  async create(data: Partial<User>): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new BadRequestException('Email já está em uso.');
    }
    
    const user = this.usersRepository.create({
      ...data,
      passwordHash: PasswordUtil.hashPassword(data.passwordHash || '123456'), // Usando a senha que veio no campo passwordHash provisoriamente
    });
    
    const saved = await this.usersRepository.save(user);
    const { passwordHash, ...result } = saved;
    return result as any;
  }

  async findAll(): Promise<Omit<User, 'passwordHash'>[]> {
    const users = await this.usersRepository.find({
      order: { createdAt: 'DESC' }
    });
    return users.map(u => {
      const { passwordHash, ...rest } = u;
      return rest as any;
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async update(id: string, data: Partial<User>): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findOne(id);
    
    if (data.passwordHash) {
      data.passwordHash = PasswordUtil.hashPassword(data.passwordHash);
    }

    Object.assign(user, data);
    const saved = await this.usersRepository.save(user);
    const { passwordHash, ...result } = saved;
    return result as any;
  }

  async deactivate(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findOne(id);
    user.active = !user.active; // toggle
    const saved = await this.usersRepository.save(user);
    const { passwordHash, ...result } = saved;
    return result as any;
  }
}
