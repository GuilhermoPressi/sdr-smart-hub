import { Controller, Get, Post, Delete, Param, Body, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EvolutionService } from './evolution.service';
import { MessagesService } from '../messages/messages.service';
import { Contact } from '../contacts/entities/contact.entity';

@Controller('evolution')
export class EvolutionController {
  private readonly logger = new Logger(EvolutionController.name);

  constructor(
    private readonly evo: EvolutionService,
    private readonly messagesSvc: MessagesService,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
  ) {}

  @Post('instances')
  async createInstance(@Body() body: { instanceName: string; webhookUrl?: string }) {
    return this.evo.createInstance(body.instanceName, body.webhookUrl);
  }

  @Get('instances')
  async listInstances() {
    return this.evo.listInstances();
  }

  @Get('instances/:name/qrcode')
  async getQrCode(@Param('name') name: string) {
    return this.evo.getQrCode(name);
  }

  @Get('instances/:name/status')
  async getStatus(@Param('name') name: string) {
    return this.evo.getConnectionState(name);
  }

  @Delete('instances/:name')
  async deleteInstance(@Param('name') name: string) {
    return this.evo.deleteInstance(name);
  }

  /**
   * POST /api/v1/evolution/send-text
   * Envia mensagem E salva no banco para aparecer no histórico
   */
  @Post('send-text')
  async sendText(@Body() body: { instanceName: string; phone: string; text: string }) {
    const { instanceName, phone, text } = body;

    // 1. Envia via Evolution
    const result = await this.evo.sendText(instanceName, phone, text);

    // 2. Busca o contato pelo telefone para salvar a mensagem
    const normalizedPhone = phone.replace(/\D/g, '');
    const contact = await this.contactRepo.findOne({
      where: [
        { phone: normalizedPhone },
        { phone: `55${normalizedPhone}` },
        { phone },
      ],
    });

    if (contact) {
      await this.messagesSvc.create({
        contactId: contact.id,
        text,
        sender: 'human',
        instanceName,
        status: 'sent',
      });

      // Atualiza lastInteraction
      await this.contactRepo.update(contact.id, { lastInteraction: new Date() });

      this.logger.log(`Mensagem humana salva → contato ${contact.name} (${phone})`);
    } else {
      this.logger.warn(`Contato não encontrado para phone ${phone} — mensagem enviada mas não salva no histórico`);
    }

    return result;
  }
}
