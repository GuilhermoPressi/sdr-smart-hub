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
    return this.repo.find({
      where: { companyId },
      relations: ['contact'],
      order: { lastMessageAt: 'DESC' },
    });
  }

  async findOrCreate(companyId: string, contactId: string, instanceName: string): Promise<Conversation> {
    let conv = await this.repo.findOneBy({
      companyId,
      contactId,
      instanceName,
    });

    if (!conv) {
      conv = this.repo.create({
        companyId,
        contactId,
        instanceName,
        aiEnabled: true,
        status: 'open',
      });
      conv = await this.repo.save(conv);
      this.logger.log(`🆕 Nova conversa criada: Contact=${contactId} | Instance=${instanceName} | Company=${companyId}`);
    }

    return conv;
  }

  async update(id: string, data: Partial<Conversation>, companyId: string) {
    await this.repo.update({ id, companyId }, data);
    return this.repo.findOneBy({ id, companyId });
  }

  async incrementUnread(id: string, companyId: string) {
    await this.repo.increment({ id, companyId }, 'unreadCount', 1);
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

  async resetUnread(id: string, companyId: string) {
    await this.repo.update({ id, companyId }, { unreadCount: 0 });
  }
}
