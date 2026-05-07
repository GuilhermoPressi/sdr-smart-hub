import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationsService } from './conversations.service';
import { OpenaiService } from '../openai/openai.service';
import { AiConfigService } from '../ai-config/ai-config.service';
import { EvolutionService } from '../evolution/evolution.service';
import { MessagesService } from '../messages/messages.service';
import { Contact } from '../contacts/entities/contact.entity';

@Injectable()
export class AiReplyService implements OnModuleInit {
  private readonly logger = new Logger(AiReplyService.name);
  private isProcessing = false;

  constructor(
    private readonly convSvc: ConversationsService,
    private readonly openaiSvc: OpenaiService,
    private readonly aiConfigSvc: AiConfigService,
    private readonly evoSvc: EvolutionService,
    private readonly messagesSvc: MessagesService,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
  ) {}

  onModuleInit() {
    // Polling a cada 5 segundos
    setInterval(() => this.processPendingReplies(), 5000);
    this.logger.log('🚀 Serviço de Resposta Adiada (Debounce) iniciado.');
  }

  async processPendingReplies() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pending = await this.convSvc.findPendingReplies();
      if (pending.length === 0) {
        this.isProcessing = false;
        return;
      }

      this.logger.log(`🤖 Processando ${pending.length} respostas agendadas...`);

      for (const conv of pending) {
        await this.handleAiReply(conv);
      }
    } catch (err) {
      this.logger.error(`❌ Erro no loop de respostas: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async handleAiReply(conv: Conversation) {
    try {
      // 1. Limpar o agendamento imediatamente para evitar duplicidade
      await this.convRepo.update(conv.id, { nextAiReplyAt: null });

      const contact = await this.contactRepo.findOneBy({ id: conv.contactId });
      if (!contact) return;

      const aiConfig = await this.aiConfigSvc.findActive(conv.companyId);
      if (!aiConfig) return;

      // 2. Chamar OpenAI
      const virtualContact = { 
        ...contact, 
        conversationStage: conv.currentStage,
        iaStatus: conv.aiEnabled ? 'Ativa' : 'Pausada'
      } as any;

      const history = await this.messagesSvc.findByContact(contact.id, 20);
      
      const aiPayload = await this.openaiSvc.generateResponse(aiConfig, virtualContact, history);
      if (!aiPayload || !aiPayload.reply) return;

      const aiResponse = aiPayload.reply;

      // 3. Atualizar Etapa se sugerido
      if (aiPayload.suggestedNextStage) {
        const suggested = aiPayload.suggestedNextStage;
        const validStep = aiConfig.conversationFlow?.find(s => s.id === suggested);
        if (validStep && suggested !== conv.currentStage) {
          await this.convSvc.update(conv.id, { currentStage: suggested });
          conv.currentStage = suggested;
        }
      }

      // 4. Enviar Mensagem
      await this.evoSvc.sendText(conv.instanceName, contact.phone, aiResponse);
      
      // 5. Salvar Mensagem no Banco
      await this.messagesSvc.create({
        contactId: contact.id,
        conversationId: conv.id,
        text: aiResponse,
        sender: 'ia',
        instanceName: conv.instanceName,
        status: 'sent',
      });

      // 6. Verificar Handoff
      const isHandoff = conv.currentStage === 'handoff' || conv.currentStage === 'atendimento_humano';
      if (isHandoff) {
        await this.convSvc.update(conv.id, {
          aiEnabled: false,
          currentStage: 'atendimento_humano',
          waitingHumanReply: true,
          handoffReason: 'IA sugeriu handoff',
          handoffAt: new Date(),
        });
        await this.contactRepo.update(contact.id, { stage: 'atendimento_humano' });
      }

      this.logger.log(`✅ Resposta enviada para ${contact.name} (${contact.phone})`);
    } catch (err) {
      this.logger.error(`❌ Falha ao processar resposta para Conv=${conv.id}: ${err.message}`);
    }
  }
}
