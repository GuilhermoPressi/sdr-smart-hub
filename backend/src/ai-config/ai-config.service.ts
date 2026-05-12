import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConfig } from './entities/ai-config.entity';

function isValidUuid(v: any): boolean {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

const ALLOWED_COLUMNS = new Set([
  'internalName','displayName','company','segment','product',
  'audience','problem','benefit','tone','qualifiedCriteria','discovery',
  'neverPromise','neverAsk','instructions','flow','evolutionInstance',
  'companyId','userId','conversationFlow','behaviorRules','knowledge',
  'autoRules','extra','active',
]);

function sanitize(data: any): Partial<AiConfig> {
  const clean: any = {};
  const extras: any = {};
  for (const [key, val] of Object.entries(data)) {
    if (key === 'id') continue;
    if ((key === 'companyId' || key === 'userId') && !isValidUuid(val as any)) {
      clean[key] = null; continue;
    }
    if (ALLOWED_COLUMNS.has(key)) { clean[key] = val; }
    else { extras[key] = val; }
  }
  if (Object.keys(extras).length > 0) {
    clean.extra = { ...(clean.extra || {}), ...extras };
  }
  return clean as Partial<AiConfig>;
}

@Injectable()
export class AiConfigService {
  constructor(
    @InjectRepository(AiConfig)
    private readonly repo: Repository<AiConfig>,
  ) {}

  findAll(companyId?: string): Promise<AiConfig[]> {
    const where = isValidUuid(companyId) ? { companyId } : {};
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  findById(id: string, companyId?: string): Promise<AiConfig | null> {
    if (!isValidUuid(id)) return Promise.resolve(null);
    const where: any = { id };
    if (isValidUuid(companyId)) where.companyId = companyId;
    return this.repo.findOneBy(where);
  }

  findActive(companyId?: string): Promise<AiConfig | null> {
    const where: any = { active: true };
    if (isValidUuid(companyId)) where.companyId = companyId;
    return this.repo.findOneBy(where);
  }

  async save(data: any): Promise<AiConfig> {
    const rawId = data?.id;
    const clean = sanitize(data);
    if (isValidUuid(rawId)) {
      await this.repo.update(rawId, clean);
      return this.repo.findOneBy({ id: rawId });
    }
    // Usa insert() para evitar SELECT com id vazio que causa erro uuid
    const result = await this.repo.insert(clean);
    const newId = result.identifiers[0]?.id;
    return this.repo.findOneBy({ id: newId });
  }

  async activate(id: string, companyId?: string): Promise<AiConfig> {
    if (!isValidUuid(id)) throw new BadRequestException('ID inválido');
    const where: any = { active: true };
    if (isValidUuid(companyId)) where.companyId = companyId;
    await this.repo.update(where, { active: false });
    await this.repo.update(id, { active: true });
    return this.repo.findOneBy({ id });
  }

  async deactivate(id: string, companyId?: string): Promise<AiConfig> {
    if (!isValidUuid(id)) throw new BadRequestException('ID inválido');
    await this.repo.update(id, { active: false });
    return this.repo.findOneBy({ id });
  }

  async delete(id: string, companyId?: string): Promise<void> {
    if (!isValidUuid(id)) throw new BadRequestException('ID inválido');
    await this.repo.delete(id);
  }

  async testChat(id: string, companyId: string, body: { message: string; history: any[]; stage: string }): Promise<any> {
    const config = await this.findById(id, companyId);
    if (!config) throw new BadRequestException('Configuração não encontrada');
    return { reply: 'Funcionalidade de teste em desenvolvimento.', config: config.displayName };
  }
}
