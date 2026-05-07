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

  @Post('instances')
  async createInstance(@Req() req, @Body() body: { instanceName: string; webhookUrl?: string }) {
    const companyId = req.user.companyId || 'default-company';
    // instanceName from body is actually the "name" they want to display
    return this.evo.createInstance(body.instanceName, companyId, body.webhookUrl);
  }

  @Get('instances')
  async listInstances(@Req() req) {
    const companyId = req.user.companyId;
    if (!companyId && req.user.role !== UserRole.ADMIN) {
      return [];
    }
    // If it's a super admin without companyId, maybe list all or none. Let's list all if no companyId, else list by companyId
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
    const companyId = req.user.companyId;
    const { instanceName, phone, text, contactId } = body;

    let targetInstanceName = instanceName;

    // Busca a instância correta (se não for passada, busca a primeira do cliente)
    if (!targetInstanceName && companyId) {
      const instances = await this.instanceRepo.find({ where: { companyId, status: 'connected' } });
      if (instances.length > 0) {
        targetInstanceName = instances[0].instanceName;
      }
    }

    if (!targetInstanceName) {
      throw new NotFoundException('Nenhuma instância conectada encontrada para este envio.');
    }

    // 1. Envia via Evolution
    const result = await this.evo.sendText(targetInstanceName, phone, text);

    // 2. Busca o contato pelo telefone (e companyId) para salvar a mensagem
    const normalizedPhone = phone.replace(/\D/g, '');
    const contactWhere: any = [
      { phone: normalizedPhone },
      { phone: `55${normalizedPhone}` },
      { phone },
    ];
    
    // Adicionar filtro de companyId se houver
    const finalWhere = companyId 
      ? contactWhere.map(w => ({ ...w, companyId }))
      : contactWhere;

    const contact = await this.contactRepo.findOne({
      where: finalWhere,
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
      });

      // Atualiza lastInteraction no CRM
      await this.contactRepo.update(contact.id, { lastInteraction: new Date() });

      this.logger.log(`Mensagem humana salva → contato ${contact.name} (${phone}) na conversa ${conversation.id}`);
    } else {
      this.logger.warn(`Contato não encontrado para phone ${phone} — mensagem enviada mas não salva no histórico`);
    }

    return result;
  }
}
