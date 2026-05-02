import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);
  private readonly client: AxiosInstance;

  constructor() {
    const baseURL = (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/$/, '');
    const apiKey = process.env.EVOLUTION_API_KEY || '';

    this.client = axios.create({
      baseURL,
      headers: { apikey: apiKey },
    });

    this.logger.log(`Evolution API configurada: ${baseURL}`);
  }

  // ─── Instance Management ──────────────────────────────────

  async createInstance(instanceName: string, webhookUrl?: string) {
    const { data } = await this.client.post('/instance/create', {
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
      reject_call: false,
      webhook: webhookUrl
        ? {
            url: webhookUrl,
            enabled: true,
            events: [
              'messages.upsert',
              'connection.update',
              'messages.update',
            ],
          }
        : undefined,
    });
    this.logger.log(`Instância "${instanceName}" criada.`);
    return data;
  }

  async getConnectionState(instanceName: string) {
    const { data } = await this.client.get(
      `/instance/connectionState/${instanceName}`,
    );
    return data;
  }

  async getQrCode(instanceName: string) {
    const { data } = await this.client.get(
      `/instance/connect/${instanceName}`,
    );
    return data;
  }

  async deleteInstance(instanceName: string) {
    const { data } = await this.client.delete(
      `/instance/delete/${instanceName}`,
    );
    return data;
  }

  async listInstances() {
    const { data } = await this.client.get('/instance/fetchInstances');
    return data;
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
    mediatype: 'image' | 'video' | 'document' = 'document',
  ) {
    const number = phone.replace(/\D/g, '');
    const { data } = await this.client.post(
      `/message/sendMedia/${instanceName}`,
      {
        number,
        mediatype,
        media: mediaUrl,
        caption: caption || '',
      },
    );
    return data;
  }

  // ─── Webhook Settings ─────────────────────────────────────

  async setWebhook(instanceName: string, webhookUrl: string, events: string[]) {
    const { data } = await this.client.post(`/webhook/set/${instanceName}`, {
      enabled: true,
      url: webhookUrl,
      events,
    });
    this.logger.log(`Webhook configurado para "${instanceName}" → ${webhookUrl}`);
    return data;
  }
}
