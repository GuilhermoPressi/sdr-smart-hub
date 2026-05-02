import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    const startTime = Date.now();

    this.logger.log(`=== BUSCA INICIADA ===`);
    this.logger.log(`Source: ${source} | Query: "${query}" | Limit: ${limit}`);

    const record = this.searchRepo.create({ userId, companyId, source, query, status: SearchStatus.RUNNING });
    await this.searchRepo.save(record);

    try {
      const leads = await this.apifyService.runAndWait(source, query, limit);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`Actor finalizado em ${elapsed}s | ${leads.length} leads`);

      // Deduplica e importa
      const results = await this.processLeads(leads, userId, companyId, source);

      const totalImported = results.filter((l) => l.imported).length;
      const totalDuplicates = results.filter((l) => l.duplicate).length;
      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      this.logger.log(`=== CONCLUÍDO em ${totalElapsed}s | Encontrados: ${leads.length} | Importados: ${totalImported} | Duplicados: ${totalDuplicates} ===`);

      record.apifyRunId = record.apifyRunId || 'done';
      record.totalFound = leads.length;
      record.totalImported = totalImported;
      record.status = SearchStatus.COMPLETED;
      await this.searchRepo.save(record);

      return {
        searchId: record.id,
        source,
        query,
        totalFound: leads.length,
        totalImported,
        totalDuplicates,
        duration: parseFloat(totalElapsed),
        results,
      };
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.error(`=== FALHOU em ${elapsed}s: ${err.message} ===`);
      record.status = SearchStatus.FAILED;
      record.error = err.message;
      await this.searchRepo.save(record);
      throw err;
    }
  }

  private async processLeads(
    leads: NormalizedLead[],
    userId: string,
    companyId: string,
    source: string,
  ): Promise<NormalizedLead[]> {
    const seen = new Set<string>(); // dedup em memória dentro do batch

    for (const lead of leads) {
      // Chave de deduplicação em memória
      const keys = [
        lead.phone ? `phone:${lead.phone}` : null,
        lead.email ? `email:${lead.email}` : null,
        lead.profileUrl ? `url:${lead.profileUrl}` : null,
        lead.username ? `user:${lead.username}:${source}` : null,
      ].filter(Boolean);

      const isDupInBatch = keys.some((k) => seen.has(k));
      if (isDupInBatch) {
        lead.duplicate = true;
        lead.imported = false;
        continue;
      }

      // Sem nenhum identificador — pula
      if (!lead.phone && !lead.email && !lead.profileUrl && !lead.username) {
        lead.duplicate = false;
        lead.imported = false;
        continue;
      }

      // Verifica duplicado no banco
      const conditions: any[] = [];
      if (lead.phone) conditions.push({ phone: lead.phone });
      if (lead.email) conditions.push({ email: lead.email });
      if (lead.profileUrl) conditions.push({ profileUrl: lead.profileUrl });

      const existing = conditions.length > 0
        ? await this.contactRepo.findOne({ where: conditions })
        : null;

      if (existing) {
        lead.duplicate = true;
        lead.imported = false;
        continue;
      }

      // Salva no CRM
      const contact = this.contactRepo.create({
        name: lead.name || lead.companyName || lead.username || null,
        companyName: lead.companyName || null,
        email: lead.email || null,
        phone: lead.phone || null,
        profileUrl: lead.profileUrl || null,
        website: lead.website || null,
        address: lead.address || null,
        source: 'apify',
        userId,
        companyId,
        metadata: {
          apifySource: lead.source,
          jobTitle: lead.jobTitle,
          category: lead.category,
          city: lead.city,
          state: lead.state,
          score: lead.score,
          reviewsCount: lead.reviewsCount,
          username: lead.username,
          importedAt: new Date().toISOString(),
          rawData: lead.rawData,
        },
      });
      await this.contactRepo.save(contact);

      lead.imported = true;
      lead.duplicate = false;
      keys.forEach((k) => seen.add(k));
    }

    return leads;
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
    return this.searchRepo.findOne({ where: { id, userId } });
  }
}
