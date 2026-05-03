import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConfig } from './entities/ai-config.entity';

function isValidUuid(v: any): boolean {
  if (!v || typeof v !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function sanitize(data: Partial<AiConfig>): Partial<AiConfig> {
  const clean: any = { ...data };
  // Remove id vazio — nunca enviar id="" para o banco
  if (!isValidUuid(clean.id)) delete clean.id;
  // UUID opcionais: companyId, userId
  if (!isValidUuid(clean.companyId)) clean.companyId = null;
  if (!isValidUuid(clean.userId)) clean.userId = null;
  // Remove campos que não existem na entity
  const allowed = [
    'id','internalName','displayName','company','segment','product','audience',
    'problem','benefit','tone','qualifiedCriteria','discovery','neverPromise',
    'neverAsk','instructions','goal','formality','responseLength','differentials',
    'pricingFactors','region','initialMessage',
    'conversationFlow','behaviorRules','knowledge','autoRules',
    'flow','evolutionInstance','companyId','userId','active',
  ];
  Object.keys(clean).forEach(k => { if (!allowed.includes(k)) delete clean[k]; });
  return clean;
}

@Injectable()
export class AiConfigService {
  private readonly logger = new Logger(AiConfigService.name);

  constructor(
    @InjectRepository(AiConfig)
    private readonly repo: Repository<AiConfig>,
  ) {}

  async findAll(): Promise<AiConfig[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<AiConfig | null> {
    if (!isValidUuid(id)) return null;
    return this.repo.findOneBy({ id });
  }

  async findActive(): Promise<AiConfig | null> {
    return this.repo.findOneBy({ active: true });
  }

  async save(data: Partial<AiConfig>): Promise<AiConfig> {
    const clean = sanitize(data);

    if (clean.id && isValidUuid(clean.id)) {
      // UPDATE
      await this.repo.update(clean.id, clean);
      return this.repo.findOneBy({ id: clean.id });
    }
    // INSERT
    const entity = this.repo.create(clean);
    return this.repo.save(entity);
  }

  async activate(id: string): Promise<AiConfig> {
    if (!isValidUuid(id)) throw new BadRequestException('ID inválido');
    await this.repo.update({ active: true }, { active: false });
    await this.repo.update(id, { active: true });
    return this.repo.findOneBy({ id });
  }

  async deactivate(id: string): Promise<AiConfig> {
    if (!isValidUuid(id)) throw new BadRequestException('ID inválido');
    await this.repo.update(id, { active: false });
    return this.repo.findOneBy({ id });
  }

  async delete(id: string): Promise<void> {
    if (!isValidUuid(id)) throw new BadRequestException('ID inválido');
    const result = await this.repo.delete(id);
    this.logger.log(`🗑️ IA deletada com id ${id} (affected: ${result.affected})`);
  }
}
