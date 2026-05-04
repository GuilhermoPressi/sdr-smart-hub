import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConfig } from './entities/ai-config.entity';
import { OpenaiService } from '../openai/openai.service';
import { Contact } from '../contacts/entities/contact.entity';
import { Message } from '../messages/entities/message.entity';

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
    private readonly openaiService: OpenaiService,
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

  async testChat(id: string, body: { message: string; history: any[]; stage: string }) {
    const config = await this.findById(id);
    if (!config) throw new NotFoundException('IA não encontrada');

    this.logger.log(`[TESTE DE IA] Iniciado para IA ${config.displayName || config.internalName}`);

    // Cria um contato mockado
    const fakeContact = new Contact();
    fakeContact.id = 'test-contact-id';
    fakeContact.name = 'Lead Teste';
    fakeContact.phone = '5511999999999';
    fakeContact.conversationStage = body.stage;
    fakeContact.temperature = 'Frio';

    // Mapeia o histórico para o formato Message
    const fakeHistory: Message[] = (body.history || []).map((msg, index) => {
      const m = new Message();
      m.id = `fake-msg-${index}`;
      m.text = msg.content;
      m.sender = msg.role === 'user' ? 'lead' : 'ia';
      m.createdAt = new Date();
      return m;
    });

    // Adiciona a nova mensagem ao histórico
    if (body.message) {
      const newMsg = new Message();
      newMsg.id = 'fake-msg-new';
      newMsg.text = body.message;
      newMsg.sender = 'lead';
      newMsg.createdAt = new Date();
      fakeHistory.push(newMsg);
    }

    this.logger.log(`[TESTE DE IA] Enviando ${fakeHistory.length} mensagens para OpenAI | Stage: ${body.stage || 'nenhum'}`);
    
    const response = await this.openaiService.generateResponse(config, fakeContact, fakeHistory);
    
    if (!response) {
      this.logger.warn(`[TESTE DE IA] Resposta falhou ou vazia.`);
      return { reply: 'Desculpe, ocorreu um erro ao simular a resposta da IA.', stage: body.stage, suggestedNextStage: null };
    }

    this.logger.log(`[TESTE DE IA] Resposta gerada com sucesso.`);
    return {
      reply: response.reply,
      stage: response.suggestedNextStage || body.stage, // Simula a atualização de etapa local
      suggestedNextStage: response.suggestedNextStage,
    };
  }
}
