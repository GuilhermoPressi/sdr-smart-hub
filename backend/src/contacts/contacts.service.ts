import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly repo: Repository<Contact>,
  ) {}

  findAll() {
    return this.repo.find({ order: { updatedAt: 'DESC' } });
  }

  findOne(id: string) {
    return this.repo.findOneBy({ id });
  }

  update(id: string, data: Partial<Contact>) {
    return this.repo.update(id, data);
  }

  // Retorna apenas contatos com mensagens, incluindo prévia da última mensagem
  async findConversations(): Promise<any[]> {
    const result = await this.repo.query(`
      SELECT
        c.id,
        c.name,
        c.phone,
        c.email,
        c.source,
        c.stage,
        c.status,
        c.ia_status AS "iaStatus",
        c.temperature,
        c.waiting_human_reply AS "waitingHumanReply",
        c.handoff_reason AS "handoffReason",
        c.handoff_at AS "handoffAt",
        c.updated_at AS "updatedAt",
        m.text AS "lastMessageText",
        m.sender AS "lastMessageSender",
        m.created_at AS "lastMessageAt",
        COUNT(m2.id) FILTER (WHERE m2.status != 'read' AND m2.sender = 'lead') AS "unreadCount"
      FROM contacts c
      INNER JOIN LATERAL (
        SELECT text, sender, created_at
        FROM messages
        WHERE contact_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) m ON true
      LEFT JOIN messages m2 ON m2.contact_id = c.id
      GROUP BY c.id, m.text, m.sender, m.created_at
      ORDER BY m.created_at DESC
    `);

    return result.map((r: any) => ({
      ...r,
      unreadCount: parseInt(r.unreadCount || '0', 10),
    }));
  }
}
