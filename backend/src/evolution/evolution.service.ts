import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import { EvolutionInstance } from './entities/evolution-instance.entity';

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);
  private readonly client: AxiosInstance;

  constructor(
    @InjectRepository(EvolutionInstance)
    private readonly instanceRepo: Repository<EvolutionInstance>,
  ) {
    const baseURL = (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/$/, '');
    const apiKey = process.env.EVOLUTION_API_KEY || '';

    this.client = axios.create({
      baseURL,
      headers: { apikey: apiKey },
    });

    this.logger.log(`Evolution API configurada: ${baseURL}`);
  }

  // ─── Instance Management ──────────────────────────────────

  async createInstance(name: string, companyId: string, webhookUrl?: string) {
    const finalWebhookUrl = webhookUrl || process.env.WEBHOOK_PUBLIC_URL;
    
    // Gerar um instanceName único baseado no nome + hash/random
    let slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    
    // SEGURANÇA: Se o slug for "gpressi" ou vazio, forçamos um nome neutro
    if (!slug || slug.includes('gpressi')) {
      slug = 'instancia';
    }

    const randomId = Math.random().toString(36).substring(2, 8);
    const instanceName = `${slug}_${randomId}`;

    this.logger.log(`[AUDITORIA] Criando instância Evolution: displayName=${name} | finalInstanceName=${instanceName} | companyId=${companyId}`);

    const { data } = await this.client.post('/instance/create', {
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
      reject_call: false,
      webhook: finalWebhookUrl
        ? {
            url: finalWebhookUrl,
            enabled: true,
            events: [
              'MESSAGES_UPSERT',
              'CONNECTION_UPDATE',
              'MESSAGES_UPDATE',
            ],
          }
        : undefined,
    });

    const qrCodeBase64 = data?.qrcode?.base64 || data?.base64;
    
    // Salva no banco de dados
    const newInstance = this.instanceRepo.create({
      name,
      instanceName,
      companyId,
      status: 'pending',
      qrCode: qrCodeBase64,
    });
    const saved = await this.instanceRepo.save(newInstance);

    this.logger.log(`[SUCESSO] Instância técnica "${instanceName}" (Display: ${name}) salva no banco para empresa ${companyId}.`);
    return saved;
  }

  async getConnectionState(instanceName: string) {
    try {
      const { data } = await this.client.get(
        `/instance/connectionState/${instanceName}`,
      );
      
      const state = data?.instance?.state || data?.state;
      // Atualiza o banco
      await this.instanceRepo.update({ instanceName }, { status: state === 'open' ? 'connected' : state });
      
      return data;
    } catch (error) {
      if (error.response?.status === 404) {
        await this.instanceRepo.update({ instanceName }, { status: 'disconnected' });
        return { instance: { state: 'disconnected' } };
      }
      throw error;
    }
  }

  async getQrCode(instanceName: string) {
    try {
      const { data } = await this.client.get(
        `/instance/connect/${instanceName}`,
      );
      
      const qrCodeBase64 = data?.qrcode?.base64 || data?.base64 || data?.code;
      if (qrCodeBase64) {
        await this.instanceRepo.update({ instanceName }, { qrCode: qrCodeBase64 });
      }

      return data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new NotFoundException(`Instância ${instanceName} não encontrada na Evolution.`);
      }
      throw error;
    }
  }

  async deleteInstance(instanceName: string, companyId?: string) {
    try {
      if (companyId) {
        const instance = await this.instanceRepo.findOneBy({ instanceName, companyId });
        if (!instance) throw new NotFoundException('Instância não encontrada para este cliente.');
      }

      const { data } = await this.client.delete(
        `/instance/delete/${instanceName}`,
      );
      
      await this.instanceRepo.delete({ instanceName });
      this.logger.log(`Instância deletada: ${instanceName}`);
      
      return data;
    } catch (error) {
      if (error.response?.status === 404) {
        await this.instanceRepo.delete({ instanceName });
        return { message: 'Instance already deleted' };
      }
      throw error;
    }
  }

  async listInstances(companyId?: string) {
    const where = companyId ? { companyId } : {};
    return this.instanceRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  // ─── Messaging ────────────────────────────────────────────

  async sendText(instanceName: string, phone: string, text: string) {
    const number = phone.replace(/\D/g, '');
    const { data } = await this.client.post(
      `/message/sendText/${instanceName}`,
      {
        number,
        text,
      },
    );
    this.logger.log(`Mensagem enviada → ${number} via ${instanceName}`);
    return data;
  }

  async sendMedia(
    instanceName: string,
    phone: string,
    mediaUrl: string,
    caption?: string,
    mediatype: 'image' | 'video' | 'audio' | 'document' = 'document',
    fileName?: string,
  ) {
    const number = phone.replace(/\D/g, '');
    const { data } = await this.client.post(
      `/message/sendMedia/${instanceName}`,
      {
        number,
        mediatype,
        media: mediaUrl,
        caption: caption || '',
        fileName: fileName || undefined,
      },
    );
    return data;
  }

  async sendImage(instanceName: string, phone: string, mediaUrl: string, caption?: string) {
    return this.sendMedia(instanceName, phone, mediaUrl, caption, 'image');
  }

  async sendVideo(instanceName: string, phone: string, mediaUrl: string, caption?: string) {
    return this.sendMedia(instanceName, phone, mediaUrl, caption, 'video');
  }

  async sendAudio(instanceName: string, phone: string, mediaUrl: string) {
    return this.sendMedia(instanceName, phone, mediaUrl, undefined, 'audio');
  }

  async sendDocument(instanceName: string, phone: string, mediaUrl: string, fileName: string, caption?: string) {
    return this.sendMedia(instanceName, phone, mediaUrl, caption, 'document', fileName);
  }

  // ─── Webhook Settings ─────────────────────────────────────

  async setWebhook(instanceName: string, webhookUrl: string, events: string[]) {
    const { data } = await this.client.post(`/webhook/set/${instanceName}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events,
      },
    });
    this.logger.log(`Webhook configurado para "${instanceName}" → ${webhookUrl}`);
    return data;
  }
}
