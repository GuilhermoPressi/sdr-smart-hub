import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignRecipient } from './entities/campaign-recipient.entity';
import { EvolutionService } from '../evolution/evolution.service';

interface CreateCampaignDto {
  name?: string;
  message: string;
  messageType?: string;
  instanceName?: string;
  sourceType?: string;
  sourceId?: string;
  delaySeconds?: number;
  limitPerMinute?: number;
  simulateHuman?: boolean;
  recipients: { phone: string; name?: string; company?: string; city?: string; segment?: string }[];
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignRecipient)
    private readonly recipientRepo: Repository<CampaignRecipient>,
    private readonly evoSvc: EvolutionService,
  ) {}

  async findAll(): Promise<Campaign[]> {
    return this.campaignRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Campaign | null> {
    return this.campaignRepo.findOneBy({ id });
  }

  async findRecipients(campaignId: string): Promise<CampaignRecipient[]> {
    return this.recipientRepo.find({
      where: { campaignId },
      order: { createdAt: 'ASC' },
    });
  }

  async create(dto: CreateCampaignDto): Promise<Campaign> {
    if (!dto.message?.trim()) throw new BadRequestException('Mensagem obrigatória');
    if (!dto.recipients || dto.recipients.length === 0) throw new BadRequestException('Nenhum destinatário');

    // Create campaign
    const campaign = this.campaignRepo.create({
      name: dto.name || `Disparo ${new Date().toLocaleDateString('pt-BR')}`,
      message: dto.message,
      messageType: dto.messageType || 'free_text',
      instanceName: dto.instanceName || 'Gpressi',
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
      delaySeconds: Math.max(3, dto.delaySeconds || 8),
      limitPerMinute: Math.min(30, Math.max(5, dto.limitPerMinute || 15)),
      simulateHuman: dto.simulateHuman !== false,
      total: dto.recipients.length,
      status: 'pending',
    });
    const saved = await this.campaignRepo.save(campaign);
    this.logger.log(`📋 Campanha criada: "${saved.name}" (${saved.total} destinatários)`);

    // Create recipients
    const recipients = dto.recipients.map(r =>
      this.recipientRepo.create({
        campaignId: saved.id,
        phone: r.phone.replace(/\D/g, ''),
        name: r.name,
        company: r.company,
        city: r.city,
        segment: r.segment,
        status: 'pending',
      }),
    );
    await this.recipientRepo.save(recipients);

    return saved;
  }

  async start(id: string): Promise<Campaign> {
    const campaign = await this.campaignRepo.findOneBy({ id });
    if (!campaign) throw new BadRequestException('Campanha não encontrada');
    if (campaign.status === 'sending') throw new BadRequestException('Campanha já está em andamento');

    await this.campaignRepo.update(id, { status: 'sending' });
    this.logger.log(`🚀 Disparo iniciado: "${campaign.name}"`);

    // Start async processing — don't await
    this.processAsync(id).catch(err => {
      this.logger.error(`❌ Erro fatal na campanha ${id}: ${err.message}`);
    });

    return { ...campaign, status: 'sending' };
  }

  async pause(id: string): Promise<Campaign> {
    await this.campaignRepo.update(id, { status: 'paused' });
    this.logger.log(`⏸️ Campanha pausada: ${id}`);
    return this.campaignRepo.findOneBy({ id });
  }

  // ── Async Processing ─────────────────────────────────────────────────

  private async processAsync(campaignId: string): Promise<void> {
    const campaign = await this.campaignRepo.findOneBy({ id: campaignId });
    if (!campaign) return;

    const recipients = await this.recipientRepo.find({
      where: { campaignId, status: 'pending' },
      order: { createdAt: 'ASC' },
    });

    let sentCount = campaign.sent || 0;
    let failedCount = campaign.failed || 0;
    let sentThisMinute = 0;
    let minuteStart = Date.now();

    for (const recipient of recipients) {
      // Check if campaign was paused
      const current = await this.campaignRepo.findOneBy({ id: campaignId });
      if (!current || current.status !== 'sending') {
        this.logger.log(`⏸️ Campanha ${campaignId} não está mais em sending, parando.`);
        break;
      }

      // Rate limiting per minute
      if (Date.now() - minuteStart > 60_000) {
        sentThisMinute = 0;
        minuteStart = Date.now();
      }
      if (sentThisMinute >= campaign.limitPerMinute) {
        const waitMs = 60_000 - (Date.now() - minuteStart) + 1000;
        this.logger.log(`⏳ Rate limit atingido, aguardando ${Math.round(waitMs / 1000)}s`);
        await this.sleep(waitMs);
        sentThisMinute = 0;
        minuteStart = Date.now();
      }

      // Build message with variables
      const text = this.replaceVariables(campaign.message, recipient);

      // Send
      try {
        await this.evoSvc.sendText(campaign.instanceName, recipient.phone, text);
        sentCount++;
        sentThisMinute++;
        await this.recipientRepo.update(recipient.id, { status: 'sent', sentAt: new Date() });
        await this.campaignRepo.update(campaignId, { sent: sentCount });
        this.logger.log(`✅ Mensagem enviada para ${recipient.name || recipient.phone} (${sentCount}/${campaign.total})`);
      } catch (err) {
        failedCount++;
        await this.recipientRepo.update(recipient.id, { status: 'failed', error: err.message?.substring(0, 200) });
        await this.campaignRepo.update(campaignId, { failed: failedCount });
        this.logger.error(`❌ Erro ao enviar para ${recipient.phone}: ${err.message}`);
      }

      // Delay between messages
      let delay = campaign.delaySeconds * 1000;
      if (campaign.simulateHuman) {
        // Random variation: 70% to 150% of configured delay
        const variation = 0.7 + Math.random() * 0.8;
        delay = Math.round(delay * variation);
      }
      delay = Math.max(3000, delay); // Minimum 3 seconds
      await this.sleep(delay);
    }

    // Finalize
    const finalCampaign = await this.campaignRepo.findOneBy({ id: campaignId });
    if (finalCampaign && finalCampaign.status === 'sending') {
      await this.campaignRepo.update(campaignId, { status: 'completed' });
      this.logger.log(`🏁 Campanha concluída: "${campaign.name}" — ${sentCount} enviados, ${failedCount} falhas`);
    }
  }

  private replaceVariables(template: string, recipient: CampaignRecipient): string {
    return template
      .replace(/\{nome\}/gi, recipient.name || 'você')
      .replace(/\{empresa\}/gi, recipient.company || 'sua empresa')
      .replace(/\{cidade\}/gi, recipient.city || 'sua cidade')
      .replace(/\{segmento\}/gi, recipient.segment || 'seu segmento')
      .replace(/\{telefone\}/gi, recipient.phone || '');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
