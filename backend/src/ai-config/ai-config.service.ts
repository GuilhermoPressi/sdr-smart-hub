import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AiConfig, ConversationStep } from './entities/ai-config.entity';
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

  async findAll(companyId: string): Promise<AiConfig[]> {
    return this.repo.find({ 
      where: { companyId },
      order: { createdAt: 'DESC' } 
    });
  }

  async findById(id: string, companyId: string): Promise<AiConfig | null> {
    if (!isValidUuid(id)) return null;
    return this.repo.findOneBy({ id, companyId });
  }

  async findActive(companyId: string): Promise<AiConfig | null> {
    return this.repo.findOneBy({ active: true, companyId });
  }

  async save(data: Partial<AiConfig>): Promise<AiConfig> {
    const clean = sanitize(data);

    if (clean.id && isValidUuid(clean.id)) {
      // UPDATE
      const existing = await this.repo.preload(clean);
      if (existing) {
        const saved = await this.repo.save(existing);
        this.logger.log(`[AiConfigService] IA atualizada: ${saved.id}`);
        return saved;
      }
    }
    // INSERT
    const entity = this.repo.create(clean);
    const savedEntity = await this.repo.save(entity);
    this.logger.log(`[AiConfigService] Nova IA criada: ${savedEntity.id}`);
    return savedEntity;
  }

  async activate(id: string, companyId: string): Promise<AiConfig> {
    if (!isValidUuid(id)) throw new BadRequestException('ID inválido');
    await this.repo.update({ active: true, companyId }, { active: false });
    await this.repo.update({ id, companyId }, { active: true });
    return this.repo.findOneBy({ id, companyId });
  }

  async deactivate(id: string, companyId: string): Promise<AiConfig> {
    if (!isValidUuid(id)) throw new BadRequestException('ID inválido');
    await this.repo.update({ id, companyId }, { active: false });
    return this.repo.findOneBy({ id, companyId });
  }

  async delete(id: string, companyId: string): Promise<void> {
    if (!isValidUuid(id)) throw new BadRequestException('ID inválido');
    const result = await this.repo.delete({ id, companyId });
    this.logger.log(`🗑️ IA deletada com id ${id} na empresa ${companyId} (affected: ${result.affected})`);
  }

  async testChat(id: string, companyId: string, body: { message: string; history: any[]; stage: string }) {
    const config = await this.findById(id, companyId);
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
      
      // ── VERIFICAR REGRAS AUTOMÁTICAS (Handoff) ──
      if (config.autoRules?.transferKeywords && config.autoRules.transferKeywords.length > 0) {
        const lowerText = body.message.toLowerCase();
        const matched = config.autoRules.transferKeywords.find(kw => lowerText.includes(kw.toLowerCase()));
        if (matched) {
          this.logger.log(`[TESTE DE IA] 🔀 Simulação de Handoff ativada por keyword: "${matched}"`);
          return {
            reply: `[SIMULAÇÃO DE HANDOFF]\nPalavra-chave "${matched}" detectada.\nA IA pararia de responder e o contato seria movido para "Aguardando Atendente".`,
            stage: 'atendimento_humano',
            suggestedNextStage: 'atendimento_humano',
          };
        }
      }

      // ── VERIFICAR CONDIÇÕES DE SAÍDA TEXTUAL (Igual Webhook) ──
      if (config.conversationFlow && config.conversationFlow.length > 0) {
        const currentStageId = fakeContact.conversationStage || config.conversationFlow[0].id;
        const currentStep = config.conversationFlow.find(s => s.id === currentStageId);
        
        if (currentStep) {
          const shouldAdvance = this.checkExitConditions(currentStep, body.message);
          if (shouldAdvance && currentStep.nextStep) {
            this.logger.log(`[TESTE DE IA] 📍 Condição de saída atingida. Avançando etapa: ${currentStep.id} → ${currentStep.nextStep} antes da OpenAI`);
            fakeContact.conversationStage = currentStep.nextStep;
          }
        }
      }
    }

    this.logger.log(`[TESTE DE IA] Enviando ${fakeHistory.length} mensagens para OpenAI | Stage: ${fakeContact.conversationStage || 'nenhum'}`);
    
    const response = await this.openaiService.generateResponse(config, fakeContact, fakeHistory);
    
    if (!response) {
      this.logger.warn(`[TESTE DE IA] Resposta falhou ou vazia.`);
      return { reply: 'Desculpe, ocorreu um erro ao simular a resposta da IA.', stage: body.stage, suggestedNextStage: null };
    }

    this.logger.log(`[TESTE DE IA] Resposta gerada com sucesso.`);
    return {
      reply: response.reply,
      stage: response.suggestedNextStage || fakeContact.conversationStage, // Atualiza etapa baseada no AI ou ExitCondition
      suggestedNextStage: response.suggestedNextStage,
    };
  }

  // ── FUNÇÃO AUXILIAR PARA TESTE: MESMA LÓGICA DO WEBHOOK ──
  private checkExitConditions(step: ConversationStep, lastMessage: string): boolean {
    if (!step.exitConditions || step.exitConditions.length === 0) return false;

    const lowerMsg = lastMessage.toLowerCase();

    for (const condition of step.exitConditions) {
      const keywords = condition.toLowerCase()
        .replace(/[.,!?]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3); // ignore short words

      const matched = keywords.filter(kw => lowerMsg.includes(kw));
      if (keywords.length > 0 && matched.length / keywords.length >= 0.5) {
        this.logger.log(`[TESTE DE IA] ✅ Exit condition matched: "${condition}"`);
        return true;
      }
    }

    return false;
  }
}
