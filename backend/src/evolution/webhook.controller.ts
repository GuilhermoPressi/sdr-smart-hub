import { Controller, Post, Body, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from '../contacts/entities/contact.entity';
import { MessagesService } from '../messages/messages.service';
import { OpenaiService } from '../openai/openai.service';
import { AiConfigService } from '../ai-config/ai-config.service';
import { EvolutionService } from './evolution.service';

/**
 * This controller receives webhook payloads from the Evolution API.
 * It is NOT protected by the API key guard because Evolution calls it directly.
 *
 * Flow:
 * 1. Evolution sends `messages.upsert` event when a lead sends a message
 * 2. We save the message in the database
 * 3. We check if the IA is active for this contact
 * 4. If active, we call OpenAI to generate a response
 * 5. We send the response back via Evolution
 */
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

    // Evolution v2 can put message data at different levels
    const data = payload?.data || payload;
    if (!data) return { received: true, ignored: true };

    // Ignore messages sent by us (fromMe)
    const key = data.key || data?.message?.key;
    const isFromMe = key?.fromMe;
    if (isFromMe) return { received: true, ignored: true };

    const remoteJid = key?.remoteJid;
    if (!remoteJid || remoteJid.includes('@g.us')) {
      return { received: true, ignored: true };
    }

    // LID format (@lid) = novo formato do WhatsApp — usar senderPn como fallback
    let phone: string;
    if (remoteJid.includes('@lid')) {
      const senderPn = key?.senderPn || data?.senderPn || '';
      phone = senderPn.replace('@s.whatsapp.net', '');
      this.logger.log(`JID @lid detectado. Usando senderPn: ${senderPn} → phone: ${phone}`);
    } else {
      phone = remoteJid.replace('@s.whatsapp.net', '');
    }

    if (!phone || phone.includes('@')) {
      this.logger.warn(`Não foi possível extrair telefone do JID: ${remoteJid}`);
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

    this.logger.log(`📩 Nova mensagem de ${phone}: "${text.substring(0, 60)}..."`);

    // Dedup check
    if (await this.messagesSvc.existsByWaId(waMessageId)) {
      this.logger.warn('Mensagem duplicada, ignorando.');
      return { received: true, duplicate: true };
    }

    // Find or create contact
    let contact = await this.contactRepo.findOneBy({ phone });
    if (!contact) {
      contact = this.contactRepo.create({
        phone,
        name: data.pushName || phone,
        source: 'whatsapp',
        origin: 'WhatsApp',
        stage: 'respondeu',
        iaStatus: 'Em qualificação',
        temperature: 'Morno',
        status: 'Em conversa',
        crm: 'Pipeline Comercial',
        tags: [],
      });
      contact = await this.contactRepo.save(contact);
      this.logger.log(`Novo contato criado: ${contact.name} (${phone})`);
    }

    // Save incoming message
    await this.messagesSvc.create({
      contactId: contact.id,
      text,
      sender: 'lead',
      instanceName,
      waMessageId,
    });

    // Update last interaction
    await this.contactRepo.update(contact.id, {
      lastInteraction: new Date(),
      status: 'Em conversa',
    });

    // Check if IA should respond
    if (
      contact.iaStatus === 'Pausado' ||
      contact.iaStatus === 'Vendedor assumiu' ||
      contact.iaStatus === 'Negócio fechado'
    ) {
      this.logger.log(`IA pausada para ${contact.name}, não respondendo.`);
      return { received: true, iaSkipped: true };
    }

    // Get AI config
    const aiConfig = await this.aiConfigSvc.findActive();
    if (!aiConfig) {
      this.logger.warn('Nenhuma configuração de IA ativa encontrada.');
      return { received: true, noConfig: true };
    }

    // Get conversation history
    const history = await this.messagesSvc.findByContact(contact.id, 20);

    // Generate IA response
    const aiResponse = await this.openaiSvc.generateResponse(
      aiConfig,
      contact,
      history,
    );

    if (!aiResponse) {
      this.logger.warn('OpenAI retornou vazio.');
      return { received: true, emptyResponse: true };
    }

    // Send via Evolution
    await this.evoSvc.sendText(instanceName, phone, aiResponse);

    // Save IA response in DB
    await this.messagesSvc.create({
      contactId: contact.id,
      text: aiResponse,
      sender: 'ia',
      instanceName,
      status: 'sent',
    });

    this.logger.log(`🤖 IA respondeu para ${contact.name}: "${aiResponse.substring(0, 60)}..."`);

    return { received: true, responded: true };
  }
}
