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
    const finalCompanyId = companyId || 'default-company';
    const where: any[] = [{ companyId: finalCompanyId }];
    
    // Se for a empresa padrão, também mostra órfãos (para retrocompatibilidade)
    if (finalCompanyId === 'default-company') {
      where.push({ companyId: IsNull() });
      where.push({ companyId: '' });
    }

    return this.repo.find({ 
      where,
      order: { updatedAt: 'DESC' } 
    });
  }

  findOne(id: string) {
    return this.repo.findOneBy({ id });
  }

  create(data: Partial<Contact>) {
    if (data.phone) {
      data.phone = this.normalizePhone(data.phone);
    }
    if (!data.companyId) {
      data.companyId = 'default-company';
    }
    const contact = this.repo.create(data);
    return this.repo.save(contact);
  }

  async update(id: string, data: Partial<Contact>) {
    if (data.phone) {
      data.phone = this.normalizePhone(data.phone);
    }
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  // Retorna apenas contatos com mensagens, incluindo prévia da última mensagem
  async findConversations(companyId: string): Promise<any[]> {
    const finalCompanyId = companyId || 'default-company';
    console.log(`[ContactsService] findConversations solicitado para companyId: ${finalCompanyId}`);
    
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
        (SELECT text FROM messages WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) AS "lastMessageText",
        (SELECT sender FROM messages WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) AS "lastMessageSender",
        (SELECT created_at FROM messages WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) AS "lastMessageAt",
        (SELECT COUNT(*) FROM messages WHERE contact_id = c.id AND status != 'read' AND sender = 'lead') AS "unreadCount"
      FROM contacts c
      WHERE (c.company_id = $1 OR (c.company_id IS NULL AND $1 = 'default-company') OR (c.company_id = '' AND $1 = 'default-company'))
      AND EXISTS (SELECT 1 FROM messages WHERE contact_id = c.id)
      ORDER BY (SELECT created_at FROM messages WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) DESC NULLS LAST
    `, [finalCompanyId]);

    return result.map((r: any) => ({
      ...r,
      unreadCount: parseInt(r.unreadCount || '0', 10),
    }));
  }

  async getDashboardMetrics(companyId: string) {
    const finalCompanyId = companyId || 'default-company';
    const startTime = Date.now();

    // Contatos Totais (CRM)
    const contactsMetrics = await this.repo.query(`
      SELECT
        COUNT(*) AS "totalContacts",
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS "leadsToday",
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS "leadsLast7Days",
        COUNT(*) FILTER (WHERE stage = 'qualificado') AS "totalQualified",
        COUNT(*) FILTER (WHERE stage = 'ganho') AS "totalConverted",
        COUNT(*) FILTER (WHERE stage = 'perdido') AS "totalLost"
      FROM contacts
      WHERE (company_id = $1 OR (company_id IS NULL AND $1 = 'default-company') OR (company_id = '' AND $1 = 'default-company'))
    `, [finalCompanyId]);

    // Conversas e IA (Inbox)
    const convMetrics = await this.repo.query(`
      SELECT
        COUNT(*) AS "totalConversations",
        COUNT(*) FILTER (WHERE ai_enabled = true) AS "totalAiActive",
        COUNT(*) FILTER (WHERE current_stage = 'atendimento_humano' OR waiting_human_reply = true) AS "totalHuman",
        COUNT(*) FILTER (WHERE handoff_at IS NOT NULL) AS "aiHandoffs"
      FROM conversations
      WHERE (company_id = $1 OR (company_id IS NULL AND $1 = 'default-company') OR (company_id = '' AND $1 = 'default-company'))
    `, [finalCompanyId]);

    const m = contactsMetrics[0];
    const c = convMetrics[0];

    const totalContacts = parseInt(m.totalContacts || '0', 10);
    const totalConversations = parseInt(c.totalConversations || '0', 10);
    const totalQualified = parseInt(m.totalQualified || '0', 10);
    const totalConverted = parseInt(m.totalConverted || '0', 10);

    return {
      totalContacts,
      leadsToday: parseInt(m.leadsToday || '0', 10),
      leadsLast7Days: parseInt(m.leadsLast7Days || '0', 10),
      totalConversations,
      totalAiActive: parseInt(c.totalAiActive || '0', 10),
      totalQualified,
      totalHuman: parseInt(c.totalHuman || '0', 10),
      totalConverted,
      totalLost: parseInt(m.totalLost || '0', 10),
      aiHandoffs: parseInt(c.aiHandoffs || '0', 10),
      responseRate: totalContacts > 0 ? Math.round((totalConversations / totalContacts) * 100) : 0,
      qualificationRate: totalConversations > 0 ? Math.round((totalQualified / totalConversations) * 100) : 0,
      conversionRate: totalQualified > 0 ? Math.round((totalConverted / totalQualified) * 100) : 0,
      queryTimeMs: Date.now() - startTime,
      debug: {
        companyId: finalCompanyId,
        totalContactsRaw: m.totalContacts
      }
    };
  }

  async findByPhone(phone: string, companyId: string) {
    const finalCompanyId = companyId || 'default-company';
    const cleanPhone = phone.replace(/\D/g, '');
    return this.repo.findOne({
      where: [
        { phone: cleanPhone, companyId: finalCompanyId },
        { phone: cleanPhone.startsWith('55') ? cleanPhone.slice(2) : `55${cleanPhone}`, companyId: finalCompanyId },
      ],
    });
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
    // Detecção manual de delimitador para maior precisão
    const firstLine = buffer.toString().split('\n')[0];
    const counts = {
      ',': (firstLine.match(/,/g) || []).length,
      ';': (firstLine.match(/;/g) || []).length,
      '\t': (firstLine.match(/\t/g) || []).length,
    };
    let delimiter = ',';
    if (counts[';'] > counts[','] && counts[';'] > counts['\t']) delimiter = ';';
    else if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) delimiter = '\t';

    const records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter,
    });

    const stats = {
      total: records.length,
      imported: 0,
      updated: 0,
      recovered: 0,
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

    // 3. Buscar contatos existentes: da empresa atual OU órfãos (para recuperação)
    const existingContacts = await this.repo.find({
      where: [
        { companyId: config.companyId, phone: In(normalizedPhones) },
        { companyId: IsNull(), phone: In(normalizedPhones) },
        { companyId: '', phone: In(normalizedPhones) },
        { companyId: 'undefined', phone: In(normalizedPhones) }
      ]
    });

    const existingMap = new Map(existingContacts.map(c => [c.phone, c]));
    const toSave: Contact[] = [];

    for (const record of records) {
      const phone = this.normalizePhone(record[phoneField]);
      if (!phone) {
        stats.invalid++;
        continue;
      }

      const existing = existingMap.get(phone);
      if (existing) {
        // Lógica de Recuperação: se o contato existe mas está sem empresa ou em 'default-company' (e o usuário for de outra), ou se estava invisível
        const isInvisible = !existing.companyId || existing.companyId === '' || existing.companyId === 'undefined';
        
        if (isInvisible) {
          existing.companyId = config.companyId;
          this.mapRecordToContact(record, mapping, existing);
          this.applyConfigToContact(config, existing);
          toSave.push(existing);
          stats.recovered++;
          continue;
        }

        if (config.updateExisting) {
          this.mapRecordToContact(record, mapping, existing);
          this.applyConfigToContact(config, existing);
          toSave.push(existing);
          stats.updated++;
        } else {
          stats.duplicates++;
        }
        continue;
      }

      const name = record[mapping['name']] || (config.createWithoutName ? `Contato ${phone.slice(-4)}` : '');
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
      stats.imported++;
    }

    // 5. Salvar em lote
    if (toSave.length > 0) {
      await this.repo.save(toSave, { chunk: 100 });
    }

    console.log(`[ContactsService] Importação finalizada. Totais:`, stats);
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

  async updateBulk(ids: string[], patch: Partial<Contact>, companyId: string) {
    const contacts = await this.repo.find({
      where: { id: In(ids), companyId }
    });

    for (const contact of contacts) {
      if (patch.tags) {
        const currentTags = contact.tags || [];
        const newTags = Array.from(new Set([...currentTags, ...patch.tags]));
        contact.tags = newTags;
      }
      if (patch.stage) contact.stage = patch.stage;
      if (patch.status) contact.status = patch.status;
      if (patch.crm) contact.crm = patch.crm;
    }

    await this.repo.save(contacts);
    return { affected: contacts.length };
  }

  async deleteBulk(ids: string[], companyId: string) {
    const finalCompanyId = companyId || 'default-company';
    console.log(`[ContactsService] DELETE_BULK | UserCompany: ${finalCompanyId} | IDs: ${ids.length}`);
    console.log(`[ContactsService] IDs solicitados: ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? '...' : ''}`);
    
    // Contagem por empresa antes
    const beforeCount = await this.repo.count({ where: { companyId: finalCompanyId } });
    
    // Busca os contatos antes para logar
    const targets = await this.repo.find({
      where: { id: In(ids) },
      select: ['id', 'name', 'phone', 'companyId']
    });
    
    console.log(`[ContactsService] Alvos encontrados no DB: ${targets.length}`);
    targets.forEach(t => {
      console.log(`  - ID: ${t.id} | Nome: ${t.name} | Phone: ${t.phone} | DB_Company: ${t.companyId}`);
    });
 
    // Exclusão robusta: tenta deletar pelo ID + companyId OU ID + NULL (retrocompatibilidade)
    const result = await this.repo.createQueryBuilder()
      .delete()
      .where("id IN (:...ids)", { ids })
      .andWhere("(company_id = :companyId OR company_id IS NULL)", { companyId: finalCompanyId })
      .execute();
    
    // Contagem por empresa depois
    const afterCount = await this.repo.count({ where: { companyId: finalCompanyId } });
    
    console.log(`[ContactsService] Resultado: Afetados=${result.affected} | Antes=${beforeCount} | Depois=${afterCount}`);
    
    return { 
      deleted: result.affected || 0,
      before: beforeCount,
      after: afterCount,
      found: targets.length
    };
  }
}
