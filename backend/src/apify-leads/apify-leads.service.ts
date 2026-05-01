import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
    this.logger.log(`Source: ${source} | Query: "${query}" | Limit: ${limit} | User: ${userId}`);

    // Registra a busca com status RUNNING
    const record = this.searchRepo.create({ userId, companyId, source, query, status: SearchStatus.RUNNING });
    await this.searchRepo.save(record);

    try {
      // Executa o Actor na Apify e aguarda resultado
      const { runId, leads } = await this.apifyService.runAndWait(source, query, limit);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`Actor finalizado em ${elapsed}s | ${leads.length} leads encontrados`);

      record.apifyRunId = runId;
      record.totalFound = leads.length;

      // Importa para o CRM com deduplicação
      const totalImported = await this.importLeads(leads, userId, companyId);

      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`=== BUSCA CONCLUÍDA em ${totalElapsed}s ===`);
      this.logger.log(`  Encontrados: ${leads.length} | Importados: ${totalImported} | Duplicados ignorados: ${leads.length - totalImported}`);

      record.totalImported = totalImported;
      record.status = SearchStatus.COMPLETED;
      await this.searchRepo.save(record);

      return {
        searchId: record.id,
        source,
        query,
        totalFound: leads.length,
        totalImported,
        duplicatesIgnored: leads.length - totalImported,
        executionTimeSeconds: parseFloat(totalElapsed),
        status: SearchStatus.COMPLETED,
      };
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.error(`=== BUSCA FALHOU em ${elapsed}s: ${err.message} ===`);

      record.status = SearchStatus.FAILED;
      record.error = err.message;
      await this.searchRepo.save(record);
      throw err;
    }
  }

  private async importLeads(leads: NormalizedLead[], userId: string, companyId: string): Promise<number> {
    let count = 0;

    for (const lead of leads) {
      // Descarta leads sem nenhum identificador único
      if (!lead.email && !lead.phone && !lead.profileUrl) {
        this.logger.debug(`Lead sem identificador ignorado: ${lead.name}`);
        continue;
      }

      // Verifica duplicados por email, phone ou profileUrl
      const conditions: any[] = [];
      if (lead.email) conditions.push({ email: lead.email });
      if (lead.phone) conditions.push({ phone: lead.phone });
      if (lead.profileUrl) conditions.push({ profileUrl: lead.profileUrl });

      const existing = await this.contactRepo.findOne({ where: conditions });

      if (existing) {
        this.logger.debug(`Duplicado ignorado: ${lead.email || lead.phone || lead.profileUrl}`);
        continue;
      }

      const contact = this.contactRepo.create({
        name: lead.name || null,
        companyName: lead.companyName || null,
        email: lead.email || null,
        phone: lead.phone || null,
        profileUrl: lead.profileUrl || null,
        website: lead.website || null,
        source: 'apify',
        userId,
        companyId,
        metadata: {
          apifySource: lead.source,
          importedAt: new Date().toISOString(),
          rawData: lead.rawData,
        },
      });

      await this.contactRepo.save(contact);
      count++;
    }

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
    if (!record) throw new NotFoundException('Busca não encontrada');
    return record;
  }
}
