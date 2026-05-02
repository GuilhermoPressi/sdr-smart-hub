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
    const { query, limit, source } = dto as any;
    const userId = user?.sub || user?.id || null;
    const companyId = user?.companyId || null;
    const startTime = Date.now();

    this.logger.log(`=== BUSCA INICIADA: "${query}" | limit: ${limit} ===`);

    const record = this.searchRepo.create({
      userId, companyId, source: source || 'google', query, status: SearchStatus.RUNNING,
    });
    await this.searchRepo.save(record);

    try {
      const leads = await this.apifyService.runAndWait(source || 'google', query, limit);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`Actor finalizado em ${elapsed}s | ${leads.length} leads com telefone`);

      const results = await this.processLeads(leads, userId, companyId);

      const totalImported = results.filter((l) => l.imported).length;
      const totalDuplicates = results.filter((l) => l.duplicate).length;
      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      this.logger.log(`=== CONCLUÍDO em ${totalElapsed}s | Encontrados: ${leads.length} | Importados: ${totalImported} | Duplicados: ${totalDuplicates} ===`);

      record.totalFound = leads.length;
      record.totalImported = totalImported;
      record.status = SearchStatus.COMPLETED;
      await this.searchRepo.save(record);

      return {
        searchId: record.id,
        query,
        totalFound: leads.length,
        totalImported,
        totalDuplicates,
        duration: parseFloat(totalElapsed),
        results: results.map((l) => ({
          name: l.name,
          phone: l.phone,
          phone_normalized: l.phone_normalized,
          has_whatsapp: l.has_whatsapp,
          email: l.email,
          website: l.website,
          address: l.address,
          city: l.city,
          state: l.state,
          category: l.category,
          score: l.score,
          reviewsCount: l.reviewsCount,
          profileUrl: l.profileUrl,
          likes: (l as any).likes ?? null,
          rating: (l as any).rating ?? null,
          source: l.source,
          imported: l.imported,
          duplicate: l.duplicate,
        })),
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

  private async processLeads(leads: NormalizedLead[], userId: string, companyId: string): Promise<NormalizedLead[]> {
    const seen = new Set<string>();

    for (const lead of leads) {
      // Chaves de deduplicação
      const keys = [
        lead.phone_normalized ? `phone:${lead.phone_normalized}` : null,
        lead.email ? `email:${lead.email}` : null,
        lead.profileUrl ? `url:${lead.profileUrl}` : null,
      ].filter(Boolean) as string[];

      const isDupInBatch = keys.some((k) => seen.has(k));
      if (isDupInBatch) {
        lead.duplicate = true;
        lead.imported = false;
        continue;
      }

      // Verifica duplicado no banco
      const conditions: any[] = [];
      if (lead.phone_normalized) conditions.push({ phone: lead.phone_normalized });
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
        name: lead.name || null,
        companyName: lead.companyName || null,
        email: lead.email || null,
        phone: lead.phone_normalized || lead.phone || null,
        profileUrl: lead.profileUrl || null,
        website: lead.website || null,
        address: lead.address || null,
        city: lead.city || null,
        state: lead.state || null,
        category: lead.category || null,
        source: 'apify',
        userId,
        companyId,
        metadata: {
          phone_raw: lead.phone,
          phone_normalized: lead.phone_normalized,
          has_whatsapp: lead.has_whatsapp,
          score: lead.score,
          reviewsCount: lead.reviewsCount,
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
