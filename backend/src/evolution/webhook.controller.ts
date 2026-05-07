import { Controller, Post, Body, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from '../contacts/entities/contact.entity';
import { MessagesService } from '../messages/messages.service';
import { OpenaiService, AIResponsePayload } from '../openai/openai.service';
import { AiConfigService } from '../ai-config/ai-config.service';
import { AiConfig, ConversationStep } from '../ai-config/entities/ai-config.entity';
import { EvolutionInstance } from './entities/evolution-instance.entity';
import { EvolutionService } from './evolution.service';
import { ConversationsService } from '../conversations/conversations.service';
import { AiReplyService } from '../conversations/ai-reply.service';

@Controller('webhooks/evolution')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    private readonly messagesSvc: MessagesService,
    private readonly openaiSvc: OpenaiService,
    private readonly aiConfigSvc: AiConfigService,
    private readonly evoSvc: EvolutionService,
    @InjectRepository(EvolutionInstance)
    private readonly instanceRepo: Repository<EvolutionInstance>,
    private readonly convSvc: ConversationsService,
    private readonly aiReplySvc: AiReplyService,
  ) {}

  @Post()
  async handleWebhook(@Body() payload: any) {
    const event = payload?.event;

    if (event === 'CONNECTION_UPDATE' || event === 'connection.update') {
      this.logger.log(`Conexão atualizada: ${JSON.stringify(payload?.data?.state)}`);
      return { received: true };
    }

    if (event !== 'MESSAGES_UPSERT' && event !== 'messages.upsert') {
      return { received: true, ignored: true };
    }

    const data = payload?.data || payload;
    if (!data) return { received: true, ignored: true };

    const key = data.key || data?.message?.key;
    if (key?.fromMe) return { received: true, ignored: true };

    const remoteJid = key?.remoteJid;
    if (!remoteJid || remoteJid.includes('@g.us')) {
      return { received: true, ignored: true };
    }

    // Extract phone
    let phone: string;
    if (remoteJid.includes('@lid')) {
      const senderPn = key?.senderPn || data?.senderPn || '';
      phone = senderPn.replace('@s.whatsapp.net', '');
    } else {
      phone = remoteJid.replace('@s.whatsapp.net', '');
    }

    if (!phone || phone.includes('@')) {
      return { received: true, ignored: true };
    }

    const msgBody = data.message || {};
    const text = msgBody.conversation
      || msgBody.extendedTextMessage?.text
      || data.body
      || '';
    const waMessageId = key?.id;
    const instanceName = payload?.instance;

    if (!text.trim()) return { received: true, ignored: true };

    this.logger.log(`📩 Mensagem recebida | Instance: ${instanceName} | Phone: ${phone} | Text: "${text.substring(0, 40)}..."`);

    // Busca a instância
    const instance = await this.instanceRepo.findOneBy({ instanceName });
    if (!instance) {
      this.logger.error(`❌ Instância "${instanceName}" não encontrada no banco. Verifique se o nome da instância na Evolution bate com o banco.`);
      return { received: true, ignored: true, reason: 'instance_not_found' };
    }

    const companyId = instance.companyId;
    this.logger.log(`🏢 Empresa identificada: ${companyId}`);

    // Dedup
    if (await this.messagesSvc.existsByWaId(waMessageId)) {
      return { received: true, duplicate: true };
    }

    // ── 1. Contact & Conversation Orchestration ────────────────────────
    const cleanPhone = phone.replace(/\D/g, '');
    let contact = await this.contactRepo.findOne({
      where: [
        { phone: cleanPhone, companyId },
        { phone: cleanPhone.startsWith('55') ? cleanPhone.slice(2) : `55${cleanPhone}`, companyId },
      ],
    });

    if (!contact) {
      this.logger.log(`🆕 Criando novo contato para ${phone} na empresa ${companyId}`);
      contact = this.contactRepo.create({
        phone: cleanPhone,
        name: data.pushName || phone,
        source: 'whatsapp',
        origin: 'WhatsApp Evolution',
        stage: 'novo',
        companyId,
      });
      contact = await this.contactRepo.save(contact);
    } else {
      this.logger.log(`👤 Contato encontrado: ${contact.name} (ID: ${contact.id})`);
      // Atualiza apenas lastInteraction no CRM
      await this.contactRepo.update(contact.id, { lastInteraction: new Date() });
    }

    // Localiza ou cria a conversa para este canal/instância
    let conversation = await this.convSvc.findOrCreate(companyId, contact.id, instanceName);
    
    // Save incoming message
    await this.messagesSvc.create({
      contactId: contact.id,
      conversationId: conversation.id,
      text,
      sender: 'lead',
      instanceName,
      waMessageId,
    });

    // Atualiza metadados da conversa
    await this.convSvc.update(conversation.id, {
      lastMessageAt: new Date(),
      status: 'open',
    });
    await this.convSvc.incrementUnread(conversation.id);
    
    // Reload conversation to get fresh state
    conversation = await this.convSvc.update(conversation.id, {});

    // ── 2. Check blocked stages/statuses ─────────────────────────────────
    const blockedStages = ['atendimento_humano', 'ganho', 'perdido', 'finalizado'];
    if (blockedStages.includes(conversation.currentStage)) {
      this.logger.log(`⏸️ Conversa em stage bloqueado: ${conversation.currentStage} (${contact.name})`);
      return { received: true, iaSkipped: true };
    }

    if (!conversation.aiEnabled) {
      this.logger.log(`⏸️ IA desativada nesta conversa: ${contact.name}`);
      return { received: true, iaSkipped: true };
    }

    // ── 3. Get AI config ─────────────────────────────────────────────────
    const aiConfig = await this.aiConfigSvc.findActive(companyId);
    if (!aiConfig) {
      this.logger.warn(`⚠️ Nenhuma IA ativa para a empresa ${companyId}.`);
      return { received: true, noConfig: true };
    }
    this.logger.log(`🤖 IA Ativa: ${aiConfig.displayName || aiConfig.internalName} (ID: ${aiConfig.id})`);

    // ── 4. Check auto rules BEFORE calling OpenAI ────────────────────────
    if (aiConfig.autoRules) {
      const rules = aiConfig.autoRules;

      // Transfer keywords check
      if (rules.transferKeywords && rules.transferKeywords.length > 0) {
        const lowerText = text.toLowerCase();
        const matched = rules.transferKeywords.find(kw => lowerText.includes(kw.toLowerCase()));
        if (matched) {
          this.logger.log(`🔀 Keyword de transferência detectada: "${matched}"`);

          const handoffMsg = 'Perfeito, vou te encaminhar agora para um dos nossos especialistas. Ele já vai continuar o atendimento por aqui.';
          try {
            await this.evoSvc.sendText(instanceName, phone, handoffMsg);
          } catch (err) {
            this.logger.error(`❌ Erro ao enviar mensagem de handoff: ${err.message}`);
          }

          // Salva mensagem da IA vinculada à conversa
          await this.messagesSvc.create({
            contactId: contact.id,
            conversationId: conversation.id,
            text: handoffMsg,
            sender: 'ia',
            instanceName,
            status: 'sent',
          });

          // Handoff na Conversa
          await this.convSvc.update(conversation.id, {
            aiEnabled: false,
            currentStage: 'atendimento_humano',
            waitingHumanReply: true,
            handoffReason: matched,
            handoffAt: new Date(),
          });

          // Opcional: Atualiza o CRM (stage)
          await this.contactRepo.update(contact.id, { stage: 'atendimento_humano' });

          this.logger.log(`👤 Conversa ${contact.name} movida para atendimento humano (keyword: "${matched}")`);
          return { received: true, transferred: true, keyword: matched };
        }
      }
    }

    // ── 5. Check flow/stages ──────────────────────────────────────────────
    const hasFlow = aiConfig.conversationFlow && aiConfig.conversationFlow.length > 0;
    if (hasFlow) {
      if (!conversation.currentStage) {
        const firstStage = aiConfig.conversationFlow[0].id;
        await this.convSvc.update(conversation.id, { currentStage: firstStage });
        conversation.currentStage = firstStage;
      }

      const currentStep = aiConfig.conversationFlow.find(s => s.id === conversation.currentStage);
      if (currentStep) {
        const shouldAdvance = this.checkExitConditions(currentStep, text);
        if (shouldAdvance && currentStep.nextStep) {
          this.logger.log(`📍 Avançando etapa: ${currentStep.id} → ${currentStep.nextStep}`);
          await this.convSvc.update(conversation.id, { currentStage: currentStep.nextStep });
          conversation.currentStage = currentStep.nextStep;
        }
      }
    }

    // ── 6. Schedule AI Reply (Debounce) ─────────────────────────────────
    await this.aiReplySvc.scheduleReply(conversation.id, 15);

    return { received: true, scheduled: true };
  }

  // ── Exit Conditions Checker (Simpler) ───────────────────────────────

  private checkExitConditions(step: ConversationStep, lastMessage: string): boolean {
    if (!step.exitConditions || step.exitConditions.length === 0) return false;
    const lowerMsg = lastMessage.toLowerCase();

    for (const condition of step.exitConditions) {
      const keywords = condition.toLowerCase()
        .replace(/[.,!?]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);

      const matched = keywords.filter(kw => lowerMsg.includes(kw));
      if (keywords.length > 0 && matched.length / keywords.length >= 0.5) {
        return true;
      }
    }
    return false;
  }
}
