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
    // 1. Log Bruto para Auditoria
    console.log('[WEBHOOK RAW]', JSON.stringify(payload).slice(0, 5000));

    const event = payload?.event;
    const instanceName = payload?.instance;

    if (event === 'CONNECTION_UPDATE' || event === 'connection.update') {
      this.logger.log(`[${instanceName}] Conexão atualizada: ${JSON.stringify(payload?.data?.state || payload?.state)}`);
      return { received: true };
    }

    // Aceita múltiplos formatos de evento de mensagem
    const isMessageEvent = [
      'MESSAGES_UPSERT', 
      'messages.upsert', 
      'MESSAGES_UPDATE', 
      'messages.update',
      'SEND_MESSAGE',
      'send.message'
    ].includes(event);

    if (!isMessageEvent) {
      this.logger.debug(`[${instanceName}] Webhook ignorado: Evento "${event}" não é de mensagem.`);
      return { received: true, ignored: true, reason: 'unsupported_event' };
    }

    const data = payload?.data || payload;
    if (!data) {
      this.logger.warn(`[${instanceName}] Webhook descartado: Payload sem dados (data/payload vazio).`);
      return { received: true, ignored: true, reason: 'no_data' };
    }

    // Suporte para mensagens em array (Evolution pode mandar assim em upsert)
    const messageObj = Array.isArray(data.messages) ? data.messages[0] : (data.message || data);
    const key = messageObj?.key || data?.key;

    if (!key) {
      this.logger.warn(`[${instanceName}] Webhook descartado: Não foi possível localizar "key" da mensagem.`);
      return { received: true, ignored: true, reason: 'no_key' };
    }

    if (key.fromMe) {
      this.logger.debug(`[${instanceName}] Webhook ignorado: Mensagem enviada por nós (fromMe: true).`);
      return { received: true, ignored: true, reason: 'from_me' };
    }

    const remoteJid = key.remoteJid;
    if (!remoteJid || remoteJid.includes('@g.us')) {
      this.logger.debug(`[${instanceName}] Webhook ignorado: Mensagem de grupo ou sem JID (${remoteJid}).`);
      return { received: true, ignored: true, reason: 'group_or_no_jid' };
    }

    // Extração de Telefone robusta
    let phone: string;
    if (remoteJid.includes('@lid')) {
      const senderPn = key.senderPn || data.senderPn || messageObj.pushName || '';
      phone = senderPn.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    } else {
      phone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    }

    if (!phone) {
      this.logger.warn(`[${instanceName}] Webhook descartado: Telefone não identificado.`);
      return { received: true, ignored: true, reason: 'no_phone' };
    }

    // Extração de Texto Multi-formato
    const msg = messageObj.message || messageObj;
    const text = (
      msg.conversation ||
      msg.extendedTextMessage?.text ||
      msg.imageMessage?.caption ||
      msg.videoMessage?.caption ||
      msg.buttonsResponseMessage?.selectedDisplayText ||
      msg.listResponseMessage?.title ||
      msg.templateButtonReplyMessage?.selectedDisplayText ||
      data.body ||
      ''
    ).trim();

    const waMessageId = key.id;

    if (!text) {
      this.logger.debug(`[${instanceName}] Webhook ignorado: Mensagem sem conteúdo de texto extraível.`);
      return { received: true, ignored: true, reason: 'no_text' };
    }

    this.logger.log(`📩 [${instanceName}] Mensagem de ${phone}: "${text.substring(0, 50)}..."`);

    // Busca a instância
    const instance = await this.instanceRepo.findOneBy({ instanceName });
    if (!instance) {
      this.logger.error(`❌ [${instanceName}] Instância não encontrada no banco. Mensagem de ${phone} descartada.`);
      return { received: true, ignored: true, reason: 'instance_not_found' };
    }

    const companyId = instance.companyId;

    // Deduplicação
    if (await this.messagesSvc.existsByWaId(waMessageId)) {
      this.logger.debug(`[${instanceName}] Webhook ignorado: Mensagem duplicada (ID: ${waMessageId}).`);
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

    const pushName = data.pushName || messageObj.pushName || phone;

    if (!contact) {
      this.logger.log(`🆕 [${instanceName}] Criando novo contato para ${phone} (PushName: ${pushName})`);
      contact = this.contactRepo.create({
        phone: cleanPhone,
        name: pushName,
        source: 'whatsapp',
        origin: 'WhatsApp Evolution',
        stage: 'novo',
        companyId,
      });
      contact = await this.contactRepo.save(contact);
    } else {
      this.logger.log(`👤 [${instanceName}] Contato encontrado: ${contact.name} (${phone})`);
      await this.contactRepo.update(contact.id, { lastInteraction: new Date() });
    }

    // Localiza ou cria a conversa para este canal/instância
    let conversation = await this.convSvc.findOrCreate(companyId, contact.id, instanceName);
    
    // Salva mensagem recebida
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
    
    // Reload para estado atualizado
    conversation = await this.convSvc.update(conversation.id, {});

    // ── 2. Check blocked stages/statuses ─────────────────────────────────
    const blockedStages = ['atendimento_humano', 'ganho', 'perdido', 'finalizado'];
    if (blockedStages.includes(conversation.currentStage)) {
      this.logger.log(`⏸️ [${instanceName}] IA ignorada: Stage "${conversation.currentStage}" está bloqueado para ${contact.name}`);
      return { received: true, iaSkipped: true, reason: 'blocked_stage' };
    }

    if (!conversation.aiEnabled) {
      this.logger.log(`⏸️ [${instanceName}] IA ignorada: IA desativada manualmente para ${contact.name}`);
      return { received: true, iaSkipped: true, reason: 'ai_disabled' };
    }

    // ── 3. Get AI config ─────────────────────────────────────────────────
    const aiConfig = await this.aiConfigSvc.findActive(companyId);
    if (!aiConfig) {
      this.logger.warn(`⚠️ [${instanceName}] IA ignorada: Nenhuma configuração ativa para empresa ${companyId}.`);
      return { received: true, noConfig: true };
    }

    // ── 4. Check auto rules BEFORE scheduling ────────────────────────────
    if (aiConfig.autoRules) {
      const rules = aiConfig.autoRules;
      if (rules.transferKeywords?.length > 0) {
        const lowerText = text.toLowerCase();
        const matched = rules.transferKeywords.find(kw => lowerText.includes(kw.toLowerCase()));
        if (matched) {
          this.logger.log(`🔀 [${instanceName}] Keyword detectada: "${matched}". Transferindo ${contact.name}...`);

          const handoffMsg = 'Perfeito, vou te encaminhar agora para um dos nossos especialistas.';
          try {
            await this.evoSvc.sendText(instanceName, phone, handoffMsg);
          } catch (err) {
            this.logger.error(`❌ Erro ao enviar handoff: ${err.message}`);
          }

          await this.messagesSvc.create({
            contactId: contact.id,
            conversationId: conversation.id,
            text: handoffMsg,
            sender: 'ia',
            instanceName,
            status: 'sent',
          });

          await this.convSvc.update(conversation.id, {
            aiEnabled: false,
            currentStage: 'atendimento_humano',
            waitingHumanReply: true,
            handoffReason: matched,
            handoffAt: new Date(),
          });

          await this.contactRepo.update(contact.id, { stage: 'atendimento_humano' });
          return { received: true, transferred: true, keyword: matched };
        }
      }
    }

    // ── 5. Schedule AI Reply (Debounce) ─────────────────────────────────
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
