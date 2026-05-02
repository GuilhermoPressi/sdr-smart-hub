import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
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

  // ── BUSCA: apenas Apify, não salva no CRM ────────────────────────────────

  async search(dto: SearchLeadsDto, user: any) {
    const { query, limit } = dto;
    const userId = user?.sub || user?.id || null;
    const startTime = Date.now();

    this.logger.log(`=== BUSCA: "${query}" | limit: ${limit} ===`);

    const record = this.searchRepo.create({
      userId, source: 'google', query, status: SearchStatus.RUNNING,
    });
    await this.searchRepo.save(record);

    try {
      const leads = await this.apifyService.runAndWait(query, limit);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`=== BUSCA CONCLUÍDA ${elapsed}s | ${leads.length} leads com telefone ===`);

      // Salva leads crus na busca para importação posterior
      record.totalFound = leads.length;
      record.totalImported = 0;
      record.status = SearchStatus.COMPLETED;
      record.leads = leads;
      await this.searchRepo.save(record);

      return {
        searchId: record.id,
        query,
        totalFound: leads.length,
        totalImported: 0,
        totalDuplicates: 0,
        duration: parseFloat(elapsed),
        results: leads.map((l) => this.serializeLead(l)),
      };
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.error(`=== FALHOU ${elapsed}s: ${err.message} ===`);
      record.status = SearchStatus.FAILED;
      record.error = err.message;
      await this.searchRepo.save(record);
      throw err;
    }
  }

  // ── IMPORTAR: salva leads da busca no CRM ────────────────────────────────

  async importLeads(searchId: string, user: any) {
    const userId = user?.sub || user?.id || null;

    const record = await this.searchRepo.findOne({ where: { id: searchId } });
    if (!record) throw new NotFoundException('Busca não encontrada.');
    if (!record.leads || record.leads.length === 0) {
      throw new BadRequestException('Nenhum lead disponível para importar nesta busca.');
    }

    this.logger.log(`=== IMPORTANDO ${record.leads.length} leads da busca ${searchId} ===`);
    const startTime = Date.now();

    const seen = new Set<string>();
    let imported = 0;
    let duplicates = 0;

    for (const lead of record.leads as NormalizedLead[]) {
      const keys = [
        lead.phone_normalized ? `phone:${lead.phone_normalized}` : null,
        lead.email ? `email:${lead.email}` : null,
        lead.profileUrl ? `url:${lead.profileUrl}` : null,
      ].filter(Boolean) as string[];

      if (keys.some((k) => seen.has(k))) { duplicates++; continue; }

      const conditions: any[] = [];
      if (lead.phone_normalized) conditions.push({ phone: lead.phone_normalized });
      if (lead.email) conditions.push({ email: lead.email });
      if (lead.profileUrl) conditions.push({ profileUrl: lead.profileUrl });

      const existing = conditions.length > 0
        ? await this.contactRepo.findOne({ where: conditions })
        : null;

      if (existing) { duplicates++; continue; }

      await this.contactRepo.save(this.contactRepo.create({
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
        source: 'google',
        userId,
        metadata: {
          phone_raw: lead.phone,
          phone_normalized: lead.phone_normalized,
          has_whatsapp: lead.has_whatsapp,
          score: lead.score,
          reviewsCount: lead.reviewsCount,
          searchId: record.id,
          importedAt: new Date().toISOString(),
        },
      }));

      imported++;
      keys.forEach((k) => seen.add(k));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    this.logger.log(`=== IMPORTAÇÃO CONCLUÍDA ${elapsed}s | ${imported} criados | ${duplicates} duplicados ===`);

    record.totalImported = imported;
    await this.searchRepo.save(record);

    return { searchId, totalImported: imported, totalDuplicates: duplicates };
  }

  async getSearches(user: any) {
    const userId = user?.sub || user?.id || null;
    return this.searchRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
      select: ['id', 'query', 'source', 'status', 'totalFound', 'totalImported', 'error', 'createdAt'],
    });
  }

  async getSearchById(id: string, user: any) {
    const userId = user?.sub || user?.id || null;
    return this.searchRepo.findOne({ where: { id, userId } });
  }

  private serializeLead(l: NormalizedLead) {
    return {
      name: l.name,
      phone: l.phone,
      phone_normalized: l.phone_normalized,
      has_whatsapp: l.has_whatsapp,
      email: l.email,
      website: l.website,
      city: l.city,
      state: l.state,
      address: l.address,
      category: l.category,
      score: l.score,
      reviewsCount: l.reviewsCount,
      profileUrl: l.profileUrl,
    };
  }
}
