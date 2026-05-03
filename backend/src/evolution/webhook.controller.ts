import { Controller, Post, Body, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from '../contacts/entities/contact.entity';
import { MessagesService } from '../messages/messages.service';
import { OpenaiService, AIResponsePayload } from '../openai/openai.service';
import { AiConfigService } from '../ai-config/ai-config.service';
import { EvolutionService } from './evolution.service';
import { AiConfig, ConversationStep } from '../ai-config/entities/ai-config.entity';

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

    this.logger.log(`📩 Mensagem de ${phone}: "${text.substring(0, 60)}..."`);

    // Dedup
    if (await this.messagesSvc.existsByWaId(waMessageId)) {
      return { received: true, duplicate: true };
    }

    // ── 1. Find or create contact ───────────────────────────────────────
    let contact = await this.contactRepo.findOne({
      where: [
        { phone },
        { phone: phone.startsWith('55') ? phone.slice(2) : `55${phone}` },
      ],
    });

    if (!contact) {
      contact = this.contactRepo.create({
        phone,
        name: data.pushName || phone,
        source: 'whatsapp',
        origin: 'WhatsApp Evolution',
        stage: 'atendimento_ia',
        iaStatus: 'Em qualificação',
        temperature: 'Morno',
        status: 'Em conversa',
        crm: 'Pipeline Comercial',
        tags: ['whatsapp'],
        lastInteraction: new Date(),
      });
      contact = await this.contactRepo.save(contact);
      this.logger.log(`✅ Novo contato: ${contact.name} (${phone})`);
    } else {
      const updates: any = { lastInteraction: new Date(), status: 'Em conversa' };
      if (!contact.name || contact.name === contact.phone) {
        updates.name = data.pushName || contact.name;
      }
      if (['respondeu', 'novo', 'envio'].includes(contact.stage)) {
        updates.stage = 'atendimento_ia';
        updates.iaStatus = 'Em qualificação';
      }
      await this.contactRepo.update(contact.id, updates);
      contact = { ...contact, ...updates };
    }

    // Save incoming message
    await this.messagesSvc.create({
      contactId: contact.id,
      text,
      sender: 'lead',
      instanceName,
      waMessageId,
    });

    await this.contactRepo.update(contact.id, {
      lastInteraction: new Date(),
      status: 'Em conversa',
    });

    // ── 2. Check blocked stages/statuses ─────────────────────────────────
    const blockedStages = ['atendimento_humano', 'ganho', 'perdido'];
    if (blockedStages.includes(contact.stage)) {
      this.logger.log(`⏸️ Stage bloqueado: ${contact.stage} (${contact.name})`);
      return { received: true, iaSkipped: true };
    }

    const blockedStatuses = ['Pausado', 'Vendedor assumiu', 'Negócio fechado'];
    if (blockedStatuses.includes(contact.iaStatus)) {
      this.logger.log(`⏸️ IA pausada: ${contact.iaStatus} (${contact.name})`);
      return { received: true, iaSkipped: true };
    }

    // ── 3. Get AI config ─────────────────────────────────────────────────
    const aiConfig = await this.aiConfigSvc.findActive();
    if (!aiConfig) {
      this.logger.warn('⚠️ Nenhuma IA ativa.');
      return { received: true, noConfig: true };
    }

    // ── 4. Check auto rules BEFORE calling OpenAI ────────────────────────
    if (aiConfig.autoRules) {
      const rules = aiConfig.autoRules;

      // Transfer keywords check
      if (rules.transferKeywords && rules.transferKeywords.length > 0) {
        const lowerText = text.toLowerCase();
        const matched = rules.transferKeywords.find(kw => lowerText.includes(kw.toLowerCase()));
        if (matched) {
          this.logger.log(`🔀 Keyword de transferência detectada: "${matched}"`);

          // 1. Send handoff message BEFORE pausing
          const handoffMsg = 'Perfeito, vou te encaminhar agora para um dos nossos especialistas. Ele já vai continuar o atendimento por aqui.';
          try {
            await this.evoSvc.sendText(instanceName, phone, handoffMsg);
            this.logger.log(`📤 Mensagem de handoff enviada para ${phone}`);
          } catch (err) {
            this.logger.error(`❌ Erro ao enviar mensagem de handoff: ${err.message}`);
          }

          // 2. Save handoff message in history
          await this.messagesSvc.create({
            contactId: contact.id,
            text: handoffMsg,
            sender: 'ia',
            instanceName,
            status: 'sent',
          });

          // 3. Update contact: pause IA + set handoff tracking
          await this.contactRepo.update(contact.id, {
            iaStatus: 'Vendedor assumiu',
            stage: 'atendimento_humano',
            waitingHumanReply: true,
            handoffReason: matched,
            handoffAt: new Date(),
          });

          this.logger.log(`👤 Conversa ${contact.name} marcada como aguardando atendente (keyword: "${matched}")`);
          return { received: true, transferred: true, keyword: matched };
        }
      }

      // Pause on human reply check
      if (rules.pauseOnHumanReply) {
        // Check if last message before this one was from a human (not IA, not lead)
        const recentMsgs = await this.messagesSvc.findByContact(contact.id, 5);
        const lastNonLead = recentMsgs.filter(m => m.sender !== 'lead').pop();
        if (lastNonLead?.sender === 'human') {
          this.logger.log(`⏸️ Humano respondeu antes → IA não intervém`);
          return { received: true, iaSkipped: true, reason: 'human_replied' };
        }
      }
    }

    // ── 5. Check exit conditions + advance stage BEFORE OpenAI ───────────
    const hasFlow = aiConfig.conversationFlow && aiConfig.conversationFlow.length > 0;
    if (hasFlow) {
      // Initialize stage if not set
      if (!contact.conversationStage) {
        const firstStage = aiConfig.conversationFlow[0].id;
        await this.contactRepo.update(contact.id, { conversationStage: firstStage });
        contact.conversationStage = firstStage;
        this.logger.log(`📍 Etapa inicial definida: ${firstStage}`);
      }

      // Check exit conditions of current stage
      const currentStep = aiConfig.conversationFlow.find(s => s.id === contact.conversationStage);
      if (currentStep) {
        const shouldAdvance = this.checkExitConditions(currentStep, text, aiConfig, contact);
        if (shouldAdvance && currentStep.nextStep) {
          this.logger.log(`📍 Avançando etapa: ${currentStep.id} → ${currentStep.nextStep}`);
          await this.contactRepo.update(contact.id, { conversationStage: currentStep.nextStep });
          contact.conversationStage = currentStep.nextStep;

          // Check if advancing to a special stage triggers CRM move
          if (aiConfig.autoRules?.moveOnQualify) {
            const qualifyStage = aiConfig.autoRules.qualifyStage || 'qualificado';
            const newStep = aiConfig.conversationFlow.find(s => s.id === currentStep.nextStep);
            if (newStep?.id === 'handoff' || newStep?.id === 'fechamento') {
              await this.contactRepo.update(contact.id, { stage: qualifyStage });
              this.logger.log(`🏆 Lead qualificado → movido para ${qualifyStage}`);
            }
          }
        }
      }
    }

    // ── 6. Call OpenAI ───────────────────────────────────────────────────
    const history = await this.messagesSvc.findByContact(contact.id, 20);
    let aiPayload: AIResponsePayload | null;

    try {
      aiPayload = await this.openaiSvc.generateResponse(aiConfig, contact, history);
    } catch (err) {
      this.logger.error(`❌ Erro OpenAI: ${err.message}`);
      return { received: true, error: 'openai_failed' };
    }

    if (!aiPayload || !aiPayload.reply) {
      this.logger.warn('⚠️ Resposta vazia da IA.');
      return { received: true, emptyResponse: true };
    }

    const aiResponse = aiPayload.reply;

    // ── 7. Process suggested stage change (AI suggests, backend decides) ─
    if (hasFlow && aiPayload.suggestedNextStage) {
      const suggested = aiPayload.suggestedNextStage;
      const validStep = aiConfig.conversationFlow.find(s => s.id === suggested);
      if (validStep && suggested !== contact.conversationStage) {
        this.logger.log(`🤖 IA sugeriu etapa: ${suggested} — aplicando`);
        await this.contactRepo.update(contact.id, { conversationStage: suggested });
        contact.conversationStage = suggested;
      }
    }

    // ── 8. Send via Evolution ────────────────────────────────────────────
    try {
      await this.evoSvc.sendText(instanceName, phone, aiResponse);
    } catch (err) {
      this.logger.error(`❌ Erro Evolution: ${err.message}`);
      await this.messagesSvc.create({
        contactId: contact.id, text: aiResponse, sender: 'ia',
        instanceName, status: 'failed',
      });
      return { received: true, error: 'evolution_failed' };
    }

    // ── 9. Save response ────────────────────────────────────────────────
    await this.messagesSvc.create({
      contactId: contact.id, text: aiResponse, sender: 'ia',
      instanceName, status: 'sent',
    });

    this.logger.log(`🤖 IA respondeu ${contact.name} [stage: ${contact.conversationStage || '-'}]: "${aiResponse.substring(0, 80)}..."`);

    return { received: true, responded: true, stage: contact.conversationStage };
  }

  // ── Exit Conditions Checker ──────────────────────────────────────────

  private checkExitConditions(
    step: ConversationStep,
    lastMessage: string,
    config: AiConfig,
    contact: Contact,
  ): boolean {
    if (!step.exitConditions || step.exitConditions.length === 0) return false;

    const lowerMsg = lastMessage.toLowerCase();

    // Simple keyword/phrase matching on exit conditions
    // Each exit condition is a description — we check if the lead's message
    // contains keywords that suggest the condition was met
    for (const condition of step.exitConditions) {
      const keywords = condition.toLowerCase()
        .replace(/[.,!?]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3); // ignore short words

      // If at least 60% of meaningful keywords from the condition appear in the message
      const matched = keywords.filter(kw => lowerMsg.includes(kw));
      if (keywords.length > 0 && matched.length / keywords.length >= 0.5) {
        this.logger.log(`✅ Exit condition matched: "${condition}"`);
        return true;
      }
    }

    return false;
  }
}
