import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly repo: Repository<Message>,
  ) {}

  async findByContact(contactId: string, limit = 50): Promise<Message[]> {
    const msgs = await this.repo.find({
      where: { contactId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return msgs.reverse();
  }

  async findByConversation(conversationId: string, limit = 50): Promise<Message[]> {
    const msgs = await this.repo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return msgs.reverse();
  }

  async markAsRead(contactId: string): Promise<void> {
    await this.repo.update(
      { contactId, sender: 'lead', status: 'sent' } as any,
      { status: 'read' },
    );
  }

  async create(data: Partial<Message>): Promise<Message> {
    const msg = this.repo.create(data);
    return this.repo.save(msg);
  }

  async existsByWaId(waMessageId: string): Promise<boolean> {
    if (!waMessageId) return false;
    const count = await this.repo.count({ where: { waMessageId } });
    return count > 0;
  }
}
