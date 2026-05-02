import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import axios from 'axios';
import { LeadSource } from './dto/search-leads.dto';

// Actor IDs reais na Apify Store
const ACTOR_MAP: Record<LeadSource, string> = {
  [LeadSource.GOOGLE]:    'compass/crawler-google-places',
  [LeadSource.LINKEDIN]:  'dev_fusion/Linkedin-Profile-Scraper',
  [LeadSource.INSTAGRAM]: 'apify/instagram-scraper',
  [LeadSource.WEBSITE]:   'apify/website-content-crawler',
};

export interface NormalizedLead {
  name: string;
  phone: string;
  email: string;
  companyName: string;
  jobTitle: string;
  website: string;
  address: string;
  city: string;
  state: string;
  profileUrl: string;
  sourceUrl: string;
  category: string;
  score: number | null;
  reviewsCount: number | null;
  username: string;
  source: LeadSource;
  imported: boolean;
  duplicate: boolean;
  rawData: Record<string, any>;
}

@Injectable()
export class ApifyService {
  private readonly logger = new Logger(ApifyService.name);

  private getClient() {
    const token = process.env.APIFY_API_TOKEN;
    if (!token || token === 'seu_token_apify_aqui') {
      throw new BadRequestException('APIFY_API_TOKEN não configurado nas variáveis de ambiente.');
    }
    return axios.create({
      baseURL: 'https://api.apify.com/v2',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 180000,
    });
  }

  // ── Iniciar actor e aguardar ──────────────────────────────────────────────

  async runActor(actorId: string, input: Record<string, any>) {
    const client = this.getClient();
    const urlActorId = actorId.replace('/', '~');
    this.logger.log(`▶ Actor: ${actorId} | URL: ${urlActorId}`);
    this.logger.log(`  Input: ${JSON.stringify(input)}`);

    try {
      const res = await client.post(`/acts/${urlActorId}/runs`, input, {
        params: { waitForFinish: 120 },
      });
      const run = res.data?.data;
      this.logger.log(`  Run: ${run?.id} | Status: ${run?.status} | Dataset: ${run?.defaultDatasetId}`);

      if (run?.status === 'RUNNING' || run?.status === 'READY') {
        return this.pollRunUntilFinished(run.id, run.defaultDatasetId);
      }
      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(run?.status)) {
        throw new InternalServerErrorException(`Actor falhou: ${run?.status}`);
      }
      return { runId: run?.id, datasetId: run?.defaultDatasetId };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof InternalServerErrorException) throw err;
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err.message;
      const status = err?.response?.status;
      this.logger.error(`Erro Apify [${status}]: ${msg}`);
      if (status === 401) throw new BadRequestException('Token Apify inválido.');
      if (status === 404) throw new BadRequestException(`Actor "${actorId}" não encontrado.`);
      if (status === 400) throw new BadRequestException(`Input inválido: ${msg}`);
      if (status === 429) throw new BadRequestException('Rate limit Apify atingido.');
      throw new InternalServerErrorException(`Erro Apify: ${msg}`);
    }
  }

  private async pollRunUntilFinished(runId: string, datasetId: string) {
    const client = this.getClient();
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 10000));
      try {
        const res = await client.get(`/actor-runs/${runId}`);
        const run = res.data?.data;
        this.logger.log(`  Polling ${runId}: ${run?.status} (${i + 1}/30)`);
        if (run?.status === 'SUCCEEDED') {
          return { runId, datasetId: run?.defaultDatasetId || datasetId };
        }
        if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(run?.status)) {
          throw new InternalServerErrorException(`Actor falhou no polling: ${run?.status}`);
        }
      } catch (err) {
        if (err instanceof InternalServerErrorException) throw err;
        this.logger.warn(`Polling erro (${i + 1}): ${err.message}`);
      }
    }
    throw new InternalServerErrorException('Timeout: actor demorou mais de 5 minutos.');
  }

  async getDatasetItems(datasetId: string, limit: number): Promise<any[]> {
    const client = this.getClient();
    this.logger.log(`📦 Dataset: ${datasetId} (limit: ${limit})`);
    try {
      const res = await client.get(`/datasets/${datasetId}/items`, {
        params: { limit, clean: true, format: 'json' },
      });
      const items = Array.isArray(res.data) ? res.data : [];
      this.logger.log(`  ✅ ${items.length} itens`);
      if (items.length > 0) {
        this.logger.log(`  CAMPOS: ${Object.keys(items[0]).join(', ')}`);
      }
      return items;
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err.message;
      throw new InternalServerErrorException(`Erro ao buscar dataset: ${msg}`);
    }
  }

  // ── Orquestrador ─────────────────────────────────────────────────────────

  async runAndWait(source: LeadSource, query: string, limit: number): Promise<NormalizedLead[]> {
    const actorId = ACTOR_MAP[source];
    if (!actorId) throw new BadRequestException(`Source "${source}" sem actor configurado.`);

    const input = this.buildInput(source, query, limit);
    const { datasetId } = await this.runActor(actorId, input);
    const items = await this.getDatasetItems(datasetId, limit);

    return this.normalizeItems(source, query, items);
  }

  // ── Build de input por source ─────────────────────────────────────────────

  private buildInput(source: LeadSource, query: string, limit: number): Record<string, any> {
    switch (source) {
      case LeadSource.GOOGLE:
        return {
          searchStringsArray: [query],
          maxCrawledPlacesPerSearch: limit,
        };

      case LeadSource.LINKEDIN: {
        // query pode ser URLs separadas por vírgula ou nova linha
        const urls = query
          .split(/[\n,]+/)
          .map((u) => u.trim())
          .filter((u) => u.startsWith('http'));
        if (urls.length === 0) {
          throw new BadRequestException(
            'Para LinkedIn, informe URLs de perfil (ex: https://linkedin.com/in/fulano). Separe múltiplas por vírgula.',
          );
        }
        return { profileUrls: urls };
      }

      case LeadSource.INSTAGRAM: {
        const isUrl = query.startsWith('http');
        return isUrl
          ? { directUrls: [query], resultsLimit: limit, resultsType: 'posts' }
          : { search: query, searchType: 'hashtag', resultsLimit: limit };
      }

      case LeadSource.WEBSITE:
        return {
          startUrls: [{ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` }],
          maxCrawlPages: limit,
          maxCrawlDepth: 2,
        };
    }
  }

  // ── Normalizador universal ─────────────────────────────────────────────────

  private normalizeItems(source: LeadSource, _query: string, items: any[]): NormalizedLead[] {
    const leads: NormalizedLead[] = [];

    for (const item of items) {
      if (source === LeadSource.INSTAGRAM) {
        // Dono do post
        if (item.ownerUsername) {
          leads.push(this.normalizeInstagramOwner(item));
        }
        // Comentaristas
        if (Array.isArray(item.latestComments)) {
          for (const comment of item.latestComments) {
            if (comment.ownerUsername) {
              leads.push(this.normalizeInstagramComment(comment, item));
            }
          }
        }
      } else {
        leads.push(this.normalizeItem(source, item));
      }
    }

    return leads;
  }

  private normalizeItem(source: LeadSource, item: any): NormalizedLead {
    switch (source) {
      case LeadSource.GOOGLE:
        return {
          name: item.title || item.name || '',
          phone: item.phone || item.phoneUnformatted || item.phoneNumber || '',
          email: item.email || this.extractEmail(item.description) || '',
          companyName: item.title || item.name || '',
          jobTitle: '',
          website: item.website || item.webUrl || '',
          address: item.address || item.street || '',
          city: item.city || '',
          state: item.state || '',
          profileUrl: item.url || '',
          sourceUrl: item.url || '',
          category: item.categoryName || item.category || '',
          score: item.totalScore ?? null,
          reviewsCount: item.reviewsCount ?? null,
          username: '',
          source,
          imported: false,
          duplicate: false,
          rawData: item,
        };

      case LeadSource.LINKEDIN:
        return {
          name: item.fullName || `${item.firstName || ''} ${item.lastName || ''}`.trim() || '',
          phone: item.mobileNumber || item.phone || '',
          email: item.email || '',
          companyName: item.companyName || item.currentCompany || '',
          jobTitle: item.jobTitle || item.currentPosition || '',
          website: item.companyWebsite || item.website || '',
          address: item.addressWithoutCountry || item.addressWithCountry || item.location || '',
          city: item.city || '',
          state: item.state || '',
          profileUrl: item.linkedinPublicUrl || item.linkedinUrl || item.url || '',
          sourceUrl: item.linkedinPublicUrl || item.linkedinUrl || item.url || '',
          category: item.companyIndustry || item.industry || '',
          score: null,
          reviewsCount: null,
          username: item.username || '',
          source,
          imported: false,
          duplicate: false,
          rawData: item,
        };

      case LeadSource.WEBSITE:
        return {
          name: item.title || '',
          phone: this.extractPhone(item.text) || '',
          email: this.extractEmail(item.text) || '',
          companyName: item.title || '',
          jobTitle: '',
          website: item.url || '',
          address: '',
          city: '',
          state: '',
          profileUrl: item.url || '',
          sourceUrl: item.url || '',
          category: '',
          score: null,
          reviewsCount: null,
          username: '',
          source,
          imported: false,
          duplicate: false,
          rawData: item,
        };

      default:
        return this.emptyLead(source, item);
    }
  }

  private normalizeInstagramOwner(item: any): NormalizedLead {
    return {
      name: item.ownerFullName || item.ownerUsername || '',
      phone: '',
      email: '',
      companyName: '',
      jobTitle: '',
      website: '',
      address: '',
      city: '',
      state: '',
      profileUrl: `https://instagram.com/${item.ownerUsername}`,
      sourceUrl: item.url || '',
      category: 'Instagram profile',
      score: null,
      reviewsCount: null,
      username: item.ownerUsername || '',
      source: LeadSource.INSTAGRAM,
      imported: false,
      duplicate: false,
      rawData: item,
    };
  }

  private normalizeInstagramComment(comment: any, post: any): NormalizedLead {
    return {
      name: comment.ownerUsername || '',
      phone: '',
      email: '',
      companyName: '',
      jobTitle: '',
      website: '',
      address: '',
      city: '',
      state: '',
      profileUrl: `https://instagram.com/${comment.ownerUsername}`,
      sourceUrl: post.url || '',
      category: 'Instagram commenter',
      score: null,
      reviewsCount: null,
      username: comment.ownerUsername || '',
      source: LeadSource.INSTAGRAM,
      imported: false,
      duplicate: false,
      rawData: { comment, post },
    };
  }

  private emptyLead(source: LeadSource, item: any): NormalizedLead {
    return {
      name: item.name || '',
      phone: item.phone || '',
      email: item.email || '',
      companyName: '',
      jobTitle: '',
      website: item.website || '',
      address: '',
      city: '',
      state: '',
      profileUrl: item.url || '',
      sourceUrl: item.url || '',
      category: '',
      score: null,
      reviewsCount: null,
      username: '',
      source,
      imported: false,
      duplicate: false,
      rawData: item,
    };
  }

  // ── Utils ─────────────────────────────────────────────────────────────────

  extractEmail(text: string): string {
    if (!text) return '';
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0].toLowerCase() : '';
  }

  extractPhone(text: string): string {
    if (!text) return '';
    const match = text.match(/(\+55[\s-]?)?(\(?\d{2}\)?[\s-]?)(9?\d{4}[\s-]?\d{4})/);
    return match ? match[0].replace(/\s/g, '').trim() : '';
  }
}
