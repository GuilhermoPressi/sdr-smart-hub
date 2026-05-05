import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { parse } from 'csv-parse/sync';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly repo: Repository<Contact>,
  ) {}

  findAll(companyId: string) {
    return this.repo.find({ 
      where: { companyId },
      order: { updatedAt: 'DESC' } 
    });
  }

  findOne(id: string) {
    return this.repo.findOneBy({ id });
  }

  create(data: Partial<Contact>) {
    const contact = this.repo.create(data);
    return this.repo.save(contact);
  }

  update(id: string, data: Partial<Contact>) {
    return this.repo.update(id, data);
  }

  // Retorna apenas contatos com mensagens, incluindo prévia da última mensagem
  async findConversations(companyId: string): Promise<any[]> {
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
      WHERE c.company_id = $1
      GROUP BY c.id, m.text, m.sender, m.created_at
      ORDER BY m.created_at DESC
    `, [companyId]);

    return result.map((r: any) => ({
      ...r,
      unreadCount: parseInt(r.unreadCount || '0', 10),
    }));
  }

  async getDashboardMetrics(companyId: string) {
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
        (SELECT COUNT(DISTINCT contact_id) FROM messages m JOIN contacts c2 ON m.contact_id = c2.id WHERE c2.company_id = $1 AND m.sender = 'lead' AND LENGTH(trim(m.text)) >= 3) AS "totalResponded"
      FROM contacts
      WHERE company_id = $1
    `, [companyId]);

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

  async importContacts(
    buffer: Buffer,
    mapping: Record<string, string>,
    config: {
      companyId: string;
      tag?: string;
      stage?: string;
      ignoreDuplicates: boolean;
      updateExisting: boolean;
      createWithoutName: boolean;
    },
  ) {
    const startTime = Date.now();
    
    // 1. Parse CSV
    const records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: [',', ';', '\t'], // Suporta múltiplos delimitadores
    });

    const stats = {
      total: records.length,
      imported: 0,
      duplicates: 0,
      invalid: 0,
    };

    if (records.length === 0) return stats;

    // 2. Coletar todos os telefones para busca em lote
    const phoneField = Object.entries(mapping).find(([sys, csv]) => sys === 'phone')?.[1];
    if (!phoneField) throw new Error('Mapeamento de telefone é obrigatório.');

    const normalizedPhones = records
      .map(r => this.normalizePhone(r[phoneField]))
      .filter(p => p.length >= 10);

    // 3. Buscar contatos existentes da empresa
    const existingContacts = await this.repo.find({
      where: {
        companyId: config.companyId,
        phone: In(normalizedPhones),
      },
    });

    const existingMap = new Map(existingContacts.map(c => [c.phone, c]));
    const toSave: Contact[] = [];

    // 4. Processar cada registro
    for (const record of records) {
      const rawPhone = record[phoneField];
      const phone = this.normalizePhone(rawPhone);

      if (phone.length < 10) {
        stats.invalid++;
        continue;
      }

      const existing = existingMap.get(phone);
      if (existing) {
        if (config.ignoreDuplicates) {
          stats.duplicates++;
          continue;
        }
        if (!config.updateExisting) {
          stats.duplicates++;
          continue;
        }
        // Preparar para atualização
        this.mapRecordToContact(record, mapping, existing);
        this.applyConfigToContact(config, existing);
        toSave.push(existing);
      } else {
        // Novo contato
        const nameField = Object.entries(mapping).find(([sys, csv]) => sys === 'name')?.[1];
        const name = nameField ? record[nameField] : '';
        
        if (!name && !config.createWithoutName) {
          stats.invalid++;
          continue;
        }

        const newContact = this.repo.create({
          phone,
          companyId: config.companyId,
          source: 'import',
        });
        this.mapRecordToContact(record, mapping, newContact);
        this.applyConfigToContact(config, newContact);
        toSave.push(newContact);
      }
    }

    // 5. Salvar em lote
    if (toSave.length > 0) {
      // TypeORM save lida com insert/update baseado no ID
      await this.repo.save(toSave, { chunk: 100 });
      stats.imported = toSave.length;
    }

    const duration = Date.now() - startTime;
    console.log(`[ContactsService] Importação concluída em ${duration}ms.`, stats);

    return stats;
  }

  private mapRecordToContact(record: any, mapping: Record<string, string>, contact: Contact) {
    for (const [sysField, csvField] of Object.entries(mapping)) {
      if (!csvField || sysField === 'phone') continue; // phone já tratado
      
      const value = record[csvField];
      if (value === undefined || value === null) continue;

      switch (sysField) {
        case 'name': contact.name = value; break;
        case 'email': contact.email = value; break;
        case 'companyName': contact.companyName = value; break;
        case 'jobTitle': contact.jobTitle = value; break;
        default:
          // Campos personalizados no metadata
          if (!contact.metadata) contact.metadata = {};
          contact.metadata[sysField] = value;
      }
    }
  }

  private applyConfigToContact(config: any, contact: Contact) {
    if (config.tag) {
      if (!contact.tags) contact.tags = [];
      if (!contact.tags.includes(config.tag)) {
        contact.tags.push(config.tag);
      }
    }
    if (config.stage) {
      contact.stage = config.stage;
    }
  }

  private normalizePhone(phone: string | any): string {
    if (!phone) return '';
    const str = String(phone);
    let digits = str.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('55')) {
      digits = '55' + digits;
    }
    return digits;
  }

  async deleteBulk(ids: string[], companyId: string) {
    console.log(`[ContactsService] Iniciando deleteBulk: companyId=${companyId} | Qtd IDs=${ids.length}`);
    
    // Contagem antes
    const beforeCount = await this.repo.count({ where: { companyId } });
    
    const result = await this.repo.delete({
      id: In(ids),
      companyId: companyId,
    });
    
    // Contagem depois
    const afterCount = await this.repo.count({ where: { companyId } });
    
    console.log(`[ContactsService] Delete concluído. Antes: ${beforeCount} | Depois: ${afterCount} | Afetados: ${result.affected}`);
    
    return { 
      deleted: result.affected || 0,
      before: beforeCount,
      after: afterCount
    };
  }
}
