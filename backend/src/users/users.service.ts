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

  async countAll(companyId?: string): Promise<number> {
    const where = companyId ? { companyId } : {};
    return this.usersRepository.count({ where });
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

  async findAll(companyId: string): Promise<Omit<User, 'passwordHash'>[]> {
    const users = await this.usersRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' }
    });
    return users.map(u => {
      const { passwordHash, ...rest } = u;
      return rest as any;
    });
  }

  async findOne(id: string, companyId?: string): Promise<User> {
    const where: any = { id };
    if (companyId) where.companyId = companyId;

    const user = await this.usersRepository.findOne({ where });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async findByEmail(email: string, companyId?: string): Promise<User | null> {
    const where: any = { email };
    if (companyId) where.companyId = companyId;
    return this.usersRepository.findOne({ where });
  }

  async update(id: string, data: Partial<User>, companyId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findOne(id, companyId);
    
    if (data.passwordHash) {
      data.passwordHash = PasswordUtil.hashPassword(data.passwordHash);
    }

    Object.assign(user, data);
    const saved = await this.usersRepository.save(user);
    const { passwordHash, ...result } = saved;
    return result as any;
  }

  async deactivate(id: string, companyId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findOne(id, companyId);
    user.active = !user.active; // toggle
    const saved = await this.usersRepository.save(user);
    const { passwordHash, ...result } = saved;
    return result as any;
  }

  async resetPassword(email: string, newPassword: string): Promise<void> {
    const user = await this.findByEmail(email);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    
    user.passwordHash = PasswordUtil.hashPassword(newPassword);
    await this.usersRepository.save(user);
  }
}
