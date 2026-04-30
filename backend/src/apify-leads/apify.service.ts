import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { LeadSource } from './dto/search-leads.dto';

// Actors usados por source
const ACTOR_MAP: Record<LeadSource, string> = {
  [LeadSource.INSTAGRAM]: 'apify/instagram-scraper',
  [LeadSource.LINKEDIN]: 'curious_coder/linkedin-company-search-export',
  [LeadSource.WEBSITE]: 'apify/website-content-crawler',
  [LeadSource.GOOGLE]: 'compass/crawler-google-places',
};

export interface NormalizedLead {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  profileUrl: string;
  website: string;
  source: string;
  rawData: Record<string, any>;
}

@Injectable()
export class ApifyService {
  private readonly logger = new Logger(ApifyService.name);
  private readonly client: AxiosInstance;
  private readonly token: string;

  constructor() {
    this.token = process.env.APIFY_API_TOKEN;
    this.client = axios.create({
      baseURL: 'https://api.apify.com/v2',
      headers: { Authorization: `Bearer ${this.token}` },
      timeout: 120000,
    });
  }

  async runAndWait(source: LeadSource, query: string, limit: number): Promise<{ runId: string; leads: NormalizedLead[] }> {
    const actorId = ACTOR_MAP[source];
    const input = this.buildInput(source, query, limit);

    this.logger.log(`Iniciando actor ${actorId} para query: "${query}"`);

    let runId: string;
    try {
      const runRes = await this.client.post(`/acts/${actorId}/runs`, input, {
        params: { waitForFinish: 120 },
      });
      runId = runRes.data.data.id;
      this.logger.log(`Run iniciado: ${runId}`);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err.message;
      throw new InternalServerErrorException(`Erro ao iniciar actor Apify: ${msg}`);
    }

    // Busca o dataset do run
    let items: any[] = [];
    try {
      const datasetRes = await this.client.get(`/actor-runs/${runId}/dataset/items`, {
        params: { limit, clean: true },
      });
      items = datasetRes.data || [];
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err.message;
      throw new InternalServerErrorException(`Erro ao buscar resultados Apify: ${msg}`);
    }

    const leads = items.map((item) => this.normalize(item, source));
    this.logger.log(`${leads.length} leads normalizados de ${source}`);

    return { runId, leads };
  }

  private buildInput(source: LeadSource, query: string, limit: number): Record<string, any> {
    switch (source) {
      case LeadSource.INSTAGRAM:
        return {
          directUrls: [],
          resultsType: 'posts',
          searchType: 'hashtag',
          searchLimit: limit,
          query,
        };

      case LeadSource.LINKEDIN:
        return {
          searchUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(query)}`,
          maxResults: limit,
        };

      case LeadSource.GOOGLE:
        return {
          searchStringsArray: [query],
          maxCrawledPlacesPerSearch: limit,
          language: 'pt',
          countryCode: 'br',
        };

      case LeadSource.WEBSITE:
        return {
          startUrls: [{ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` }],
          maxCrawlPages: limit,
        };

      default:
        return { query, limit };
    }
  }

  private normalize(item: any, source: LeadSource): NormalizedLead {
    switch (source) {
      case LeadSource.GOOGLE:
        return {
          name: item.title || item.name || '',
          companyName: item.title || item.name || '',
          email: item.email || this.extractEmail(item.description) || '',
          phone: item.phone || item.phoneUnformatted || '',
          profileUrl: item.url || item.website || '',
          website: item.website || '',
          source,
          rawData: item,
        };

      case LeadSource.INSTAGRAM:
        return {
          name: item.ownerFullName || item.username || '',
          companyName: item.ownerFullName || '',
          email: this.extractEmail(item.biography) || '',
          phone: '',
          profileUrl: `https://instagram.com/${item.ownerUsername || item.username}`,
          website: item.externalUrl || '',
          source,
          rawData: item,
        };

      case LeadSource.LINKEDIN:
        return {
          name: item.name || item.firstName ? `${item.firstName} ${item.lastName}` : '',
          companyName: item.companyName || item.name || '',
          email: item.email || '',
          phone: item.phone || '',
          profileUrl: item.profileUrl || item.url || '',
          website: item.website || item.companyWebsite || '',
          source,
          rawData: item,
        };

      case LeadSource.WEBSITE:
        return {
          name: item.title || '',
          companyName: item.title || '',
          email: this.extractEmail(item.text) || '',
          phone: this.extractPhone(item.text) || '',
          profileUrl: item.url || '',
          website: item.url || '',
          source,
          rawData: item,
        };

      default:
        return {
          name: item.name || '',
          companyName: item.companyName || '',
          email: item.email || '',
          phone: item.phone || '',
          profileUrl: item.profileUrl || item.url || '',
          website: item.website || '',
          source,
          rawData: item,
        };
    }
  }

  private extractEmail(text: string): string {
    if (!text) return '';
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0] : '';
  }

  private extractPhone(text: string): string {
    if (!text) return '';
    const match = text.match(/(\+55|55)?[\s-]?\(?[1-9]{2}\)?[\s-]?[9]?[0-9]{4}[\s-]?[0-9]{4}/);
    return match ? match[0].trim() : '';
  }
}
