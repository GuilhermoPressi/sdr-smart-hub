import { Controller, Get, Post, Delete, Param, Body, Logger, NotFoundException, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EvolutionService } from './evolution.service';
import { MessagesService } from '../messages/messages.service';
import { Contact } from '../contacts/entities/contact.entity';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EvolutionInstance } from './entities/evolution-instance.entity';
import { ConversationsService } from '../conversations/conversations.service';

import { TenantHelper } from '../common/utils/tenant.utils';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('evolution')
export class EvolutionController {
  private readonly logger = new Logger(EvolutionController.name);

  constructor(
    private readonly evo: EvolutionService,
    private readonly messagesSvc: MessagesService,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(EvolutionInstance)
    private readonly instanceRepo: Repository<EvolutionInstance>,
    private readonly convSvc: ConversationsService,
  ) {}

  private getCompanyId(req: any): string {
    return TenantHelper.getCompanyIdOrThrow(req.user);
  }

  @Post('instances')
  async createInstance(@Req() req, @Body() body: { instanceName: string; webhookUrl?: string }) {
    const companyId = this.getCompanyId(req);
    // instanceName from body is actually the "name" they want to display
    return this.evo.createInstance(body.instanceName, companyId, body.webhookUrl);
  }

  @Get('instances')
  async listInstances(@Req() req) {
    const companyId = this.getCompanyId(req);
    return this.evo.listInstances(companyId);
  }

  @Get('instances/:name/qrcode')
  async getQrCode(@Req() req, @Param('name') name: string) {
    const companyId = req.user.companyId;
    if (companyId) {
      const instance = await this.instanceRepo.findOneBy({ instanceName: name, companyId });
      if (!instance) throw new NotFoundException('Instância não encontrada para este cliente.');
    }
    return this.evo.getQrCode(name);
  }

  @Get('instances/:name/status')
  async getStatus(@Req() req, @Param('name') name: string) {
    const companyId = req.user.companyId;
    if (companyId) {
      const instance = await this.instanceRepo.findOneBy({ instanceName: name, companyId });
      if (!instance) throw new NotFoundException('Instância não encontrada para este cliente.');
    }
    return this.evo.getConnectionState(name);
  }

  @Delete('instances/:name')
  async deleteInstance(@Req() req, @Param('name') name: string) {
    const companyId = req.user.companyId;
    return this.evo.deleteInstance(name, companyId);
  }

  /**
   * POST /api/v1/evolution/send-text
   * Envia mensagem E salva no banco para aparecer no histórico
   */
  @Post('send-text')
  async sendText(@Req() req, @Body() body: { instanceName?: string; phone: string; text: string; contactId?: string }) {
    const companyId = this.getCompanyId(req);
    const { instanceName, phone, text } = body;

    let targetInstanceName = instanceName;

    // Busca a instância correta (se não for passada, busca a primeira conectada do cliente)
    if (!targetInstanceName) {
      const instance = await this.instanceRepo.findOne({ 
        where: { companyId, status: 'connected' },
        order: { updatedAt: 'DESC' }
      });
      if (instance) {
        targetInstanceName = instance.instanceName;
      }
    }

    if (!targetInstanceName) {
      throw new NotFoundException('Nenhuma instância conectada encontrada para este envio.');
    }

    // Garante que a instância pertence à empresa
    const instanceOwner = await this.instanceRepo.findOneBy({ instanceName: targetInstanceName, companyId });
    if (!instanceOwner) {
      throw new UnauthorizedException('Você não tem permissão para usar esta instância.');
    }

    // 1. Envia via Evolution
    const result = await this.evo.sendText(targetInstanceName, phone, text);

    // 2. Busca o contato pelo telefone (e companyId) para salvar a mensagem
    const normalizedPhone = phone.replace(/\D/g, '');
    const contact = await this.contactRepo.findOne({
      where: [
        { phone: normalizedPhone, companyId },
        { phone: `55${normalizedPhone}`, companyId },
      ],
    });

    if (contact) {
      // Localiza ou cria a conversa
      const conversation = await this.convSvc.findOrCreate(companyId, contact.id, targetInstanceName);

      await this.messagesSvc.create({
        contactId: contact.id,
        conversationId: conversation.id,
        text,
        sender: 'human',
        instanceName: targetInstanceName,
        status: 'sent',
      });

      // Atualiza metadados da conversa
      await this.convSvc.update(conversation.id, {
        lastMessageAt: new Date(),
        waitingHumanReply: false,
        unreadCount: 0,
      }, companyId);

      // Atualiza lastInteraction no CRM
      await this.contactRepo.update(contact.id, { lastInteraction: new Date() });

      this.logger.log(`Mensagem humana salva → contato ${contact.name} (${phone}) na conversa ${conversation.id}`);
    }

    return result;
  }
}
