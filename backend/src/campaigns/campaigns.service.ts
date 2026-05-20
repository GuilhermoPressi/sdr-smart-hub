import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignRecipient } from './entities/campaign-recipient.entity';
import { EvolutionService } from '../evolution/evolution.service';
import { EvolutionInstance } from '../evolution/entities/evolution-instance.entity';

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
  mediaUrl?: string;
  mediaFileName?: string;
  mediaMimeType?: string;
  caption?: string;
  recipients: { phone: string; name?: string; company?: string; city?: string; segment?: string }[];
}

@Injectable()
export class CampaignsService implements OnModuleInit {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignRecipient)
    private readonly recipientRepo: Repository<CampaignRecipient>,
    @InjectRepository(EvolutionInstance)
    private readonly instanceRepo: Repository<EvolutionInstance>,
    private readonly evoSvc: EvolutionService,
  ) {}

  async findAll(companyId: string): Promise<Campaign[]> {
    return this.campaignRepo.find({ 
      where: { companyId },
      order: { createdAt: 'DESC' } 
    });
  }

  async findById(id: string, companyId: string): Promise<Campaign | null> {
    return this.campaignRepo.findOneBy({ id, companyId });
  }

  async findRecipients(campaignId: string, companyId: string): Promise<CampaignRecipient[]> {
    // Primeiro garante que a campanha pertence à empresa
    const campaign = await this.findById(campaignId, companyId);
    if (!campaign) throw new BadRequestException('Campanha não encontrada para esta empresa');

    return this.recipientRepo.find({
      where: { campaignId },
      order: { createdAt: 'ASC' },
    });
  }

  async create(dto: CreateCampaignDto, user: any): Promise<Campaign> {
    const isText = dto.messageType === 'text' || !dto.messageType;
    if (isText && !dto.message?.trim()) {
      throw new BadRequestException('Mensagem obrigatória para disparos de texto');
    }
    if (!isText && !dto.mediaUrl) {
      throw new BadRequestException('Arquivo de mídia é obrigatório para este tipo de disparo');
    }
    if (!dto.recipients || dto.recipients.length === 0) throw new BadRequestException('Nenhum destinatário');

    const companyId = user.companyId;
    const userId = user.sub || user.id;

    // Tentar selecionar uma instância automática se não informada
    let instanceName = dto.instanceName;
    if (!instanceName) {
      const instance = await this.instanceRepo.findOne({
        where: { companyId, status: 'connected' },
        order: { updatedAt: 'DESC' }
      });
      
      if (!instance) {
        throw new BadRequestException('Nenhuma instância do WhatsApp conectada encontrada para sua empresa.');
      }
      instanceName = instance.instanceName;
      this.logger.log(`🤖 Instância selecionada automaticamente: ${instanceName} (Empresa: ${companyId})`);
    }

    // Create campaign
    const campaign = this.campaignRepo.create({
      name: dto.name || `Disparo ${new Date().toLocaleDateString('pt-BR')}`,
      message: dto.message,
      messageType: dto.messageType || 'text',
      instanceName,
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
      mediaUrl: dto.mediaUrl,
      mediaFileName: dto.mediaFileName,
      mediaMimeType: dto.mediaMimeType,
      caption: dto.caption,
      delaySeconds: Math.max(3, dto.delaySeconds || 8),
      limitPerMinute: Math.min(30, Math.max(5, dto.limitPerMinute || 15)),
      simulateHuman: dto.simulateHuman !== false,
      total: dto.recipients.length,
      status: 'pending',
      companyId,
      userId,
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

  async start(id: string, companyId: string): Promise<Campaign> {
    const campaign = await this.findById(id, companyId);
    if (!campaign) throw new BadRequestException('Campanha não encontrada');
    if (campaign.status === 'sending') throw new BadRequestException('Campanha já está em andamento');

    await this.campaignRepo.update({ id, companyId }, { status: 'sending' });
    this.logger.log(`🚀 Disparo iniciado: "${campaign.name}" (Empresa: ${companyId})`);

    // Start async processing — don't await
    this.processAsync(id).catch(err => {
      this.logger.error(`❌ Erro fatal na campanha ${id}: ${err.message}`);
    });

    return { ...campaign, status: 'sending' };
  }

  async pause(id: string, companyId: string): Promise<Campaign> {
    await this.campaignRepo.update({ id, companyId }, { status: 'paused' });
    this.logger.log(`⏸️ Campanha pausada: ${id} (Empresa: ${companyId})`);
    return this.findById(id, companyId);
  }

  async onModuleInit() {
    // Retoma campanhas que ficaram presas em 'sending' após reinicialização
    const interrupted = await this.campaignRepo.find({ where: { status: 'sending' } });
    if (interrupted.length > 0) {
      this.logger.log(`♻️ Retomando ${interrupted.length} campanhas interrompidas...`);
      for (const c of interrupted) {
        this.processAsync(c.id).catch(err => {
          this.logger.error(`❌ Erro ao retomar campanha ${c.id}: ${err.message}`);
        });
      }
    }
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

      // 1. Validar formato básico do número
      const cleanPhone = recipient.phone.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        failedCount++;
        await this.recipientRepo.update(recipient.id, { 
          status: 'failed', 
          error: `Número inválido ou mal formatado (${cleanPhone.length} dígitos)` 
        });
        await this.campaignRepo.update(campaignId, { failed: failedCount });
        this.logger.warn(`🚫 Número inválido ignorado: ${cleanPhone}`);
        continue;
      }

      // 2. Verificar se a instância ainda está conectada antes de tentar enviar
      try {
        const stateData = await this.evoSvc.getConnectionState(campaign.instanceName);
        const state = stateData?.instance?.state || stateData?.state || 'disconnected';
        if (state !== 'open' && state !== 'connected') {
          this.logger.error(`❌ Instância ${campaign.instanceName} desconectada (${state}). Pausando campanha.`);
          await this.campaignRepo.update(campaignId, { status: 'paused' });
          break;
        }
      } catch (err) {
        this.logger.warn(`⚠️ Não foi possível verificar status da instância: ${err.message}`);
      }

      // 3. Send with Retry Logic (3 attempts)
      let attempts = 0;
      let success = false;
      let lastError = '';

      while (attempts < 3 && !success) {
        try {
          if (campaign.messageType === 'text' || !campaign.messageType) {
            const text = this.replaceVariables(campaign.message, recipient);
            await this.evoSvc.sendText(campaign.instanceName, recipient.phone, text);
          } else {
            const caption = this.replaceVariables(campaign.caption || '', recipient);
            await this.evoSvc.sendMedia(
              campaign.instanceName,
              recipient.phone,
              campaign.mediaUrl,
              caption,
              campaign.messageType as any,
              campaign.mediaFileName
            );
          }
          success = true;
        } catch (err) {
          attempts++;
          // Tenta pegar a mensagem de erro do corpo da resposta da Evolution
          const evoError = err.response?.data?.message || err.response?.data?.error || err.message;
          lastError = evoError;
          
          if (attempts < 3) {
            this.logger.warn(`⚠️ Tentativa ${attempts} falhou para ${recipient.phone}: ${evoError}. Retentando em 2s...`);
            await this.sleep(2000);
          }
        }
      }

      if (success) {
        sentCount++;
        sentThisMinute++;
        await this.recipientRepo.update(recipient.id, { status: 'sent', sentAt: new Date(), error: null });
        await this.campaignRepo.update(campaignId, { sent: sentCount });
        this.logger.log(`✅ Mensagem (${campaign.messageType}) enviada para ${recipient.name || recipient.phone} (${sentCount}/${campaign.total})`);
      } else {
        failedCount++;
        await this.recipientRepo.update(recipient.id, { status: 'failed', error: lastError.substring(0, 200) });
        await this.campaignRepo.update(campaignId, { failed: failedCount });
        this.logger.error(`❌ Erro definitivo ao enviar para ${recipient.phone}: ${lastError}`);
      }

      // Delay between messages
      let delay = campaign.delaySeconds * 1000;
      if (campaign.simulateHuman) {
        const variation = 0.7 + Math.random() * 0.8;
        delay = Math.round(delay * variation);
      }
      delay = Math.max(3000, delay);
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
