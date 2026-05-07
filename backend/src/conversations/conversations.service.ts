import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly repo: Repository<Conversation>,
  ) {}

  async findAll(companyId: string) {
    const finalCompanyId = companyId || 'default-company';
    return this.repo.find({
      where: { companyId: finalCompanyId },
      relations: ['contact'],
      order: { lastMessageAt: 'DESC' },
    });
  }

  async findOrCreate(companyId: string, contactId: string, instanceName: string): Promise<Conversation> {
    const finalCompanyId = companyId || 'default-company';
    
    let conv = await this.repo.findOneBy({
      companyId: finalCompanyId,
      contactId,
      instanceName,
    });

    if (!conv) {
      conv = this.repo.create({
        companyId: finalCompanyId,
        contactId,
        instanceName,
        aiEnabled: true,
        status: 'open',
      });
      conv = await this.repo.save(conv);
      this.logger.log(`🆕 Nova conversa criada: Contact=${contactId} | Instance=${instanceName}`);
    }

    return conv;
  }

  async update(id: string, data: Partial<Conversation>) {
    await this.repo.update(id, data);
    return this.repo.findOneBy({ id });
  }

  async incrementUnread(id: string) {
    await this.repo.increment({ id }, 'unreadCount', 1);
  }

  async findPendingReplies(now: Date = new Date()) {
    return this.repo.createQueryBuilder('c')
      .where('c.next_ai_reply_at IS NOT NULL')
      .andWhere('c.next_ai_reply_at <= :now', { now })
      .andWhere('c.next_ai_reply_status = :status', { status: 'pending' })
      .andWhere('c.ai_enabled = true')
      .andWhere('c.waiting_human_reply = false')
      .getMany();
  }

  async resetUnread(id: string) {
    await this.repo.update(id, { unreadCount: 0 });
  }
}
