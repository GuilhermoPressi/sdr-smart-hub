import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConfig } from './entities/ai-config.entity';

@Injectable()
export class AiConfigService {
  constructor(
    @InjectRepository(AiConfig)
    private readonly repo: Repository<AiConfig>,
  ) {}

  async findAll(): Promise<AiConfig[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<AiConfig | null> {
    return this.repo.findOneBy({ id });
  }

  async findActive(): Promise<AiConfig | null> {
    return this.repo.findOneBy({ active: true });
  }

  async save(data: Partial<AiConfig>): Promise<AiConfig> {
    if (data.id) {
      await this.repo.update(data.id, data);
      return this.repo.findOneBy({ id: data.id });
    }
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async activate(id: string): Promise<AiConfig> {
    // Desativa todas as outras
    await this.repo.update({ active: true }, { active: false });
    // Ativa esta
    await this.repo.update(id, { active: true });
    return this.repo.findOneBy({ id });
  }

  async deactivate(id: string): Promise<AiConfig> {
    await this.repo.update(id, { active: false });
    return this.repo.findOneBy({ id });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
