import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Or } from 'typeorm';
import { ApifyLeadSearch, SearchStatus } from './entities/apify-lead-search.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { ApifyService, NormalizedLead } from './apify.service';
import { SearchLeadsDto } from './dto/search-leads.dto';

@Injectable()
export class ApifyLeadsService {
  private readonly logger = new Logger(ApifyLeadsService.name);

  constructor(
    @InjectRepository(ApifyLeadSearch)
    private searchRepo: Repository<ApifyLeadSearch>,
    @InjectRepository(Contact)
    private contactRepo: Repository<Contact>,
    private apifyService: ApifyService,
  ) {}

  async search(dto: SearchLeadsDto, user: any) {
    const { source, query, limit } = dto;
    const userId = user?.sub || user?.id || null;
    const companyId = user?.companyId || null;

    // Registra a busca
    const record = this.searchRepo.create({
      userId,
      companyId,
      source,
      query,
      status: SearchStatus.RUNNING,
    });
    await this.searchRepo.save(record);

    try {
      const { runId, leads } = await this.apifyService.runAndWait(source, query, limit);
      record.apifyRunId = runId;
      record.totalFound = leads.length;

      const imported = await this.importLeads(leads, userId, companyId);
      record.totalImported = imported;
      record.status = SearchStatus.COMPLETED;
      await this.searchRepo.save(record);

      return {
        searchId: record.id,
        source,
        query,
        totalFound: leads.length,
        totalImported: imported,
        status: SearchStatus.COMPLETED,
      };
    } catch (err) {
      record.status = SearchStatus.FAILED;
      record.error = err.message;
      await this.searchRepo.save(record);
      throw err;
    }
  }

  private async importLeads(leads: NormalizedLead[], userId: string, companyId: string): Promise<number> {
    let count = 0;

    for (const lead of leads) {
      // Filtra leads sem nenhum identificador
      if (!lead.email && !lead.phone && !lead.profileUrl) continue;

      // Verifica duplicados
      const existing = await this.contactRepo.findOne({
        where: [
          lead.email ? { email: lead.email } : null,
          lead.phone ? { phone: lead.phone } : null,
          lead.profileUrl ? { profileUrl: lead.profileUrl } : null,
        ].filter(Boolean) as any,
      });

      if (existing) {
        this.logger.debug(`Lead duplicado ignorado: ${lead.email || lead.phone || lead.profileUrl}`);
        continue;
      }

      const contact = this.contactRepo.create({
        name: lead.name,
        companyName: lead.companyName,
        email: lead.email || null,
        phone: lead.phone || null,
        profileUrl: lead.profileUrl || null,
        website: lead.website || null,
        source: 'apify',
        userId,
        companyId,
        metadata: {
          apifySource: lead.source,
          rawData: lead.rawData,
        },
      });

      await this.contactRepo.save(contact);
      count++;
    }

    this.logger.log(`${count} contatos importados de ${leads.length} leads`);
    return count;
  }

  async getSearches(user: any) {
    const userId = user?.sub || user?.id || null;
    return this.searchRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getSearchById(id: string, user: any) {
    const userId = user?.sub || user?.id || null;
    const record = await this.searchRepo.findOne({ where: { id, userId } });
    if (!record) return null;
    return record;
  }
}
