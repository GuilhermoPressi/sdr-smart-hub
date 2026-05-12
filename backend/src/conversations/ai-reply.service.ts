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
    this.logger.log('🚀 AiReply worker iniciado');
    // Polling a cada 2 segundos para maior responsividade
    setInterval(() => this.processPendingReplies(), 2000);
  }

  async processPendingReplies() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = new Date();
      const pending = await this.convSvc.findPendingReplies(now);
      
      if (pending.length > 0) {
        this.logger.log(`🤖 Pendências encontradas: ${pending.length}`);
      }

      for (const conv of pending) {
        // 1. Marcar como processando imediatamente para evitar que outro worker pegue
        await this.convRepo.update(conv.id, { nextAiReplyStatus: 'processing' });
        
        this.logger.log(`⏳ Processando pending reply Conv=${conv.id}`);
        await this.handleAiReply(conv);
        
        // 2. Marcar como finalizado
        await this.convRepo.update(conv.id, { 
          nextAiReplyAt: null, 
          nextAiReplyStatus: 'none' 
        });
        this.logger.log(`✅ Pending reply concluído para Conv=${conv.id}`);
      }
    } catch (err) {
      this.logger.error(`❌ Erro no loop de respostas: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  async scheduleReply(conversationId: string, delaySeconds = 15) {
    const executeAt = new Date(Date.now() + delaySeconds * 1000);
    
    const conv = await this.convRepo.findOneBy({ id: conversationId });
    if (!conv) return;

    if (!conv.nextAiReplyAt) {
      this.logger.log(`🕒 Primeira mensagem recebida, agendando resposta IA para Conv=${conversationId} em ${delaySeconds}s`);
    } else {
      this.logger.log(`🕒 Resposta IA reagendada para Conv=${conversationId} (debounce)`);
    }

    await this.convRepo.update(conversationId, { 
      nextAiReplyAt: executeAt,
      nextAiReplyStatus: 'pending' 
    });
  }

  private async handleAiReply(conv: Conversation) {
    try {
      const contact = await this.contactRepo.findOneBy({ id: conv.contactId });
      if (!contact) return;

      const aiConfig = await this.aiConfigSvc.findActive();
      if (!aiConfig) {
        this.logger.warn(`⚠️ IA ignorada: Nenhuma configuração ativa para empresa ${conv.companyId}`);
        return;
      }

      // 2. Chamar OpenAI
      const virtualContact = { 
        ...contact, 
        conversationStage: conv.currentStage,
        iaStatus: conv.aiEnabled ? 'Ativa' : 'Pausada'
      } as any;

      // Busca histórico real (as últimas 20 mensagens em ordem cronológica correta)
      const history = await this.messagesSvc.findByConversation(conv.id, conv.companyId, 20);
      
      // Adiciona instrução de continuidade se houver histórico
      if (history.length > 1) {
        const continuityInstruction = "\nIMPORTANTE: A conversa já está em andamento. NÃO cumprimente o lead novamente nem diga 'Olá'. Responda diretamente ao que ele disse por último no histórico.";
        if (aiConfig.instructions) {
          aiConfig.instructions += continuityInstruction;
        } else {
          aiConfig.instructions = continuityInstruction;
        }
      }

      const aiPayload = await this.openaiSvc.generateResponse(aiConfig, virtualContact, history);
      if (!aiPayload || !aiPayload.reply) return;

      const aiResponse = aiPayload.reply;

      // 3. Atualizar Etapa se sugerido
      if (aiPayload.suggestedNextStage) {
        const suggested = aiPayload.suggestedNextStage;
        const validStep = aiConfig.conversationFlow?.find(s => s.id === suggested);
        if (validStep && suggested !== conv.currentStage) {
          await this.convSvc.update(conv.id, { currentStage: suggested }, conv.companyId);
          conv.currentStage = suggested;
        }
      }

      // 4. Enviar Mensagem
      await this.evoSvc.sendText(conv.instanceName, contact.phone, aiResponse);
      
      // 5. Salvar Mensagem no Banco
      await this.messagesSvc.create({
        contactId: contact.id,
        conversationId: conv.id,
        companyId: conv.companyId,
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
        }, conv.companyId);
        await this.contactRepo.update({ id: contact.id, companyId: conv.companyId }, { stage: 'atendimento_humano' });
      }

      this.logger.log(`✅ Resposta enviada para ${contact.name} (${contact.phone})`);
    } catch (err) {
      this.logger.error(`❌ Falha ao processar resposta para Conv=${conv.id}: ${err.message}`);
    }
  }
}
