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

  async getDashboardMetrics() {
    const startTime = Date.now();

    const [metrics] = await this.repo.query(`
      SELECT
        COUNT(*) AS "totalContacts",
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS "leadsToday",
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS "leadsLast7Days",
        COUNT(*) FILTER (WHERE stage = 'atendimento_ia' OR ia_status = 'Em qualificação') AS "totalAiActive",
        COUNT(*) FILTER (WHERE stage = 'qualificado') AS "totalQualified",
        COUNT(*) FILTER (WHERE stage = 'atendimento_humano') AS "totalHuman",
        COUNT(*) FILTER (WHERE stage = 'ganho') AS "totalConverted",
        COUNT(*) FILTER (WHERE stage = 'perdido') AS "totalLost",
        COUNT(*) FILTER (WHERE handoff_at IS NOT NULL) AS "aiHandoffs",
        (SELECT COUNT(DISTINCT contact_id) FROM messages WHERE sender = 'lead' AND LENGTH(trim(text)) >= 3) AS "totalResponded"
      FROM contacts
    `);

    const totalContacts = parseInt(metrics.totalContacts || '0', 10);
    const leadsToday = parseInt(metrics.leadsToday || '0', 10);
    const leadsLast7Days = parseInt(metrics.leadsLast7Days || '0', 10);
    const totalResponded = parseInt(metrics.totalResponded || '0', 10);
    const totalAiActive = parseInt(metrics.totalAiActive || '0', 10);
    const totalQualified = parseInt(metrics.totalQualified || '0', 10);
    const totalHuman = parseInt(metrics.totalHuman || '0', 10);
    const totalConverted = parseInt(metrics.totalConverted || '0', 10);
    const totalLost = parseInt(metrics.totalLost || '0', 10);
    const aiHandoffs = parseInt(metrics.aiHandoffs || '0', 10);

    const responseRate = totalContacts > 0 ? (totalResponded / totalContacts) * 100 : 0;
    const qualificationRate = totalResponded > 0 ? (totalQualified / totalResponded) * 100 : 0;
    const conversionRate = totalContacts > 0 ? (totalConverted / totalContacts) * 100 : 0;

    const result = {
      totalContacts,
      leadsToday,
      leadsLast7Days,
      totalResponded,
      totalAiActive,
      totalQualified,
      totalHuman,
      totalConverted,
      totalLost,
      aiHandoffs,
      responseRate: parseFloat(responseRate.toFixed(1)),
      qualificationRate: parseFloat(qualificationRate.toFixed(1)),
      conversionRate: parseFloat(conversionRate.toFixed(1)),
    };

    const duration = Date.now() - startTime;
    console.log('[ContactsService] Dashboard metrics solicitado. Tempo da query:', duration, 'ms');
    console.log('[ContactsService] Totais:', result);

    return result;
  }
}
