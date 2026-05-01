import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import axios from 'axios';
import { LeadSource } from './dto/search-leads.dto';

const ACTOR_MAP: Record<LeadSource, string> = {
  [LeadSource.GOOGLE]: 'compass/crawler-google-places',
  [LeadSource.INSTAGRAM]: 'apify/instagram-scraper',
  [LeadSource.LINKEDIN]: 'curious_coder/linkedin-company-search-export',
  [LeadSource.WEBSITE]: 'apify/website-content-crawler',
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

  async runActor(actorId: string, input: Record<string, any>) {
    const client = this.getClient();
    this.logger.log(`▶ Iniciando actor: ${actorId}`);
    this.logger.log(`  Input: ${JSON.stringify(input)}`);

    try {
      const res = await client.post(`/acts/${actorId}/runs`, input, {
        params: { waitForFinish: 120 },
      });
      const run = res.data?.data;
      this.logger.log(`  Run: ${run?.id} | Status: ${run?.status} | Dataset: ${run?.defaultDatasetId}`);

      if (run?.status === 'RUNNING' || run?.status === 'READY') {
        return this.pollRunUntilFinished(run.id, run.defaultDatasetId);
      }
      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(run?.status)) {
        throw new InternalServerErrorException(`Actor Apify falhou com status: ${run?.status}`);
      }
      return { runId: run?.id, datasetId: run?.defaultDatasetId, status: run?.status };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof InternalServerErrorException) throw err;
      const apifyMsg = err?.response?.data?.error?.message || err?.response?.data?.message;
      const httpStatus = err?.response?.status;
      this.logger.error(`Erro Apify [${httpStatus}]: ${apifyMsg || err.message}`);
      if (httpStatus === 401) throw new BadRequestException('Token Apify inválido ou sem permissão.');
      if (httpStatus === 404) throw new BadRequestException(`Actor "${actorId}" não encontrado na Apify Store.`);
      if (httpStatus === 429) throw new BadRequestException('Limite de requisições Apify atingido. Aguarde e tente novamente.');
      throw new InternalServerErrorException(`Erro ao chamar Apify: ${apifyMsg || err.message}`);
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
          return { runId, datasetId: run?.defaultDatasetId || datasetId, status: run?.status };
        }
        if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(run?.status)) {
          throw new InternalServerErrorException(`Actor falhou durante execução: ${run?.status}`);
        }
      } catch (err) {
        if (err instanceof InternalServerErrorException) throw err;
        this.logger.warn(`Erro no polling (tentativa ${i + 1}): ${err.message}`);
      }
    }
    throw new InternalServerErrorException('Timeout: actor demorou mais de 5 minutos.');
  }

  async getDatasetItems(datasetId: string, limit: number): Promise<any[]> {
    const client = this.getClient();
    this.logger.log(`📦 Buscando dataset: ${datasetId} (limit: ${limit})`);
    try {
      const res = await client.get(`/datasets/${datasetId}/items`, {
        params: { limit, clean: true, format: 'json' },
      });
      const items = Array.isArray(res.data) ? res.data : [];
      this.logger.log(`  ✅ ${items.length} itens no dataset`);
      return items;
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err.message;
      throw new InternalServerErrorException(`Erro ao buscar dataset Apify: ${msg}`);
    }
  }

  async runAndWait(source: LeadSource, query: string, limit: number) {
    const actorId = ACTOR_MAP[source];
    if (!actorId) throw new BadRequestException(`Source "${source}" não tem actor configurado.`);
    const input = this.buildInput(source, query, limit);
    const { runId, datasetId } = await this.runActor(actorId, input);
    const items = await this.getDatasetItems(datasetId, limit);
    const leads = items.map((item) => this.normalize(item, source));
    return { runId, leads };
  }

  private buildInput(source: LeadSource, query: string, limit: number) {
    switch (source) {
      case LeadSource.GOOGLE:
        return {
          searchStringsArray: [query],
          maxCrawledPlacesPerSearch: limit,
          maxCrawledPlaces: limit,
          language: 'pt',
          countryCode: 'br',
          includeWebResults: false,
          scrapeDirectories: false,
        };
      case LeadSource.INSTAGRAM:
        return { search: query, searchType: 'hashtag', resultsLimit: limit };
      case LeadSource.LINKEDIN:
        return {
          searchUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(query)}`,
          maxResults: limit,
        };
      case LeadSource.WEBSITE:
        return {
          startUrls: [{ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` }],
          maxCrawlPages: limit,
          maxCrawlDepth: 2,
        };
      default:
        return { query, limit };
    }
  }

  normalize(item: any, source: LeadSource): NormalizedLead {
    switch (source) {
      case LeadSource.GOOGLE:
        return {
          name: item.title || item.name || '',
          companyName: item.title || item.name || '',
          email: item.email || this.extractEmail(item.description) || '',
          phone: item.phone || item.phoneUnformatted || '',
          profileUrl: item.url || '',
          website: item.website || '',
          source,
          rawData: item,
        };
      case LeadSource.INSTAGRAM:
        return {
          name: item.fullName || item.username || '',
          companyName: item.fullName || '',
          email: this.extractEmail(item.biography) || '',
          phone: '',
          profileUrl: item.url || `https://instagram.com/${item.username || ''}`,
          website: item.externalUrl || '',
          source,
          rawData: item,
        };
      case LeadSource.LINKEDIN:
        return {
          name: item.name || (item.firstName ? `${item.firstName} ${item.lastName}` : '') || '',
          companyName: item.companyName || item.name || '',
          email: item.email || '',
          phone: item.phone || '',
          profileUrl: item.linkedinUrl || item.url || '',
          website: item.website || '',
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
        return { name: item.name || '', companyName: '', email: item.email || '', phone: item.phone || '', profileUrl: item.url || '', website: '', source, rawData: item };
    }
  }

  private extractEmail(text: string): string {
    if (!text) return '';
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0].toLowerCase() : '';
  }

  private extractPhone(text: string): string {
    if (!text) return '';
    const match = text.match(/(\+55[\s-]?)?(\(?\d{2}\)?[\s-]?)(9?\d{4}[\s-]?\d{4})/);
    return match ? match[0].replace(/\s/g, '').trim() : '';
  }
}
