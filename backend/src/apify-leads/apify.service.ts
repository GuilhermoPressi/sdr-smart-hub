import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import axios from 'axios';
import { LeadSource } from './dto/search-leads.dto';

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
      throw new BadRequestException('APIFY_API_TOKEN não configurado.');
    }
    return axios.create({
      baseURL: 'https://api.apify.com/v2',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 180000,
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private resolveInstagramUrl(query: string): string {
    const q = query.trim();
    if (q.startsWith('http')) return q;
    if (q.startsWith('@')) {
      const user = q.slice(1).replace(/\/$/, '');
      return `https://www.instagram.com/${user}/`;
    }
    const tag = q.replace(/^#/, '').replace(/\s+/g, '');
    return `https://www.instagram.com/explore/tags/${tag}/`;
  }

  private resolveLinkedinMode(query: string): 'profile' | 'company' | null {
    if (query.includes('linkedin.com/in/')) return 'profile';
    if (query.includes('linkedin.com/company/')) return 'company';
    return null;
  }

  private cleanLinkedinUrl(url: string): string {
    try {
      const parsed = new URL(url.trim());
      const path = parsed.pathname.replace(/\/$/, '');
      return `https://www.linkedin.com${path}`;
    } catch {
      return url.trim();
    }
  }

  // ── Actor runner ──────────────────────────────────────────────────────────

  async runActor(actorId: string, input: Record<string, any>) {
    const client = this.getClient();
    const urlActorId = actorId.replace('/', '~');
    this.logger.log(`▶ Actor: ${actorId}`);
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
          throw new InternalServerErrorException(`Actor falhou: ${run?.status}`);
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
        this.logger.log(`  CAMPOS[0]: ${Object.keys(items[0]).join(', ')}`);
      }
      return items;
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err.message;
      throw new InternalServerErrorException(`Erro ao buscar dataset: ${msg}`);
    }
  }

  // ── Orquestrador principal ────────────────────────────────────────────────

  async runAndWait(source: LeadSource, query: string, limit: number): Promise<NormalizedLead[]> {
    switch (source) {
      case LeadSource.GOOGLE:
        return this.runGoogle(query, limit);
      case LeadSource.INSTAGRAM:
        return this.runInstagram(query, limit);
      case LeadSource.LINKEDIN:
        return this.runLinkedin(query, limit);
      default:
        throw new BadRequestException(`Source "${source}" não suportado.`);
    }
  }

  // ── GOOGLE ────────────────────────────────────────────────────────────────

  private async runGoogle(query: string, limit: number): Promise<NormalizedLead[]> {
    const { datasetId } = await this.runActor('compass/crawler-google-places', {
      searchStringsArray: [query],
      maxCrawledPlacesPerSearch: limit,
    });
    const items = await this.getDatasetItems(datasetId, limit);
    return items.map((item) => this.normalizeGoogle(item));
  }

  private normalizeGoogle(item: any): NormalizedLead {
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
      source: LeadSource.GOOGLE,
      imported: false,
      duplicate: false,
      rawData: item,
    };
  }

  // ── INSTAGRAM ─────────────────────────────────────────────────────────────

  private async runInstagram(query: string, limit: number): Promise<NormalizedLead[]> {
    const url = this.resolveInstagramUrl(query);
    this.logger.log(`Instagram URL resolvida: ${url}`);

    const { datasetId } = await this.runActor('apify/instagram-scraper', {
      directUrls: [url],
      resultsLimit: limit,
      resultsType: 'posts',
    });

    const items = await this.getDatasetItems(datasetId, limit);

    // Verifica se o actor retornou erros
    const errorItems = items.filter((i) => i.error || i.errorDescription);
    if (errorItems.length > 0 && items.length === errorItems.length) {
      const errMsg = errorItems[0].errorDescription || errorItems[0].error || 'Erro desconhecido do Instagram';
      throw new BadRequestException(`Instagram retornou erro: ${errMsg}. Tente outra hashtag ou URL.`);
    }

    const leads: NormalizedLead[] = [];
    for (const item of items) {
      if (item.error || item.errorDescription) continue;
      if (item.ownerUsername) {
        leads.push(this.normalizeInstagramOwner(item));
      }
      if (Array.isArray(item.latestComments)) {
        for (const comment of item.latestComments) {
          if (comment.ownerUsername) {
            leads.push(this.normalizeInstagramComment(comment, item));
          }
        }
      }
    }

    return leads;
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

  // ── LINKEDIN ──────────────────────────────────────────────────────────────

  private async runLinkedin(query: string, limit: number): Promise<NormalizedLead[]> {
    const rawUrls = query.split(/[\n,]+/).map((u) => u.trim()).filter((u) => u.startsWith('http'));
    if (rawUrls.length === 0) {
      throw new BadRequestException(
        'Para LinkedIn, informe URLs de perfis ou empresas. Ex: https://linkedin.com/in/usuario ou https://linkedin.com/company/empresa',
      );
    }

    // Limpa query params e fragments de todas as URLs
    const urls = rawUrls.map((u) => this.cleanLinkedinUrl(u));
    this.logger.log(`LinkedIn URLs limpas: ${urls.join(', ')}`);

    const mode = this.resolveLinkedinMode(urls[0]);

    if (mode === 'company') {
      return this.runLinkedinCompany(urls, limit);
    } else {
      return this.runLinkedinProfiles(urls, limit);
    }
  }

  private async runLinkedinProfiles(urls: string[], limit: number): Promise<NormalizedLead[]> {
    this.logger.log(`LinkedIn mode: PROFILE | ${urls.length} URLs`);
    const { datasetId } = await this.runActor('harvestapi/linkedin-profile-scraper', {
      profileUrls: urls.slice(0, limit),
    });
    const items = await this.getDatasetItems(datasetId, limit);
    if (items.length === 0) {
      throw new BadRequestException(
        'Nenhum dado encontrado para esse perfil. Teste outro perfil público ou use uma URL de empresa do LinkedIn.',
      );
    }
    return items.map((item) => this.normalizeLinkedinProfile(item));
  }

  private async runLinkedinCompany(urls: string[], limit: number): Promise<NormalizedLead[]> {
    this.logger.log(`LinkedIn mode: COMPANY EMPLOYEES | ${urls.length} URLs`);
    const { datasetId } = await this.runActor('harvestapi/linkedin-company-employees', {
      currentCompanies: urls,
      maxItems: limit,
    });
    const items = await this.getDatasetItems(datasetId, limit);
    if (items.length === 0) {
      throw new BadRequestException(
        'Nenhum dado encontrado para essa empresa. Verifique se a URL da empresa no LinkedIn é pública e válida.',
      );
    }
    return items.map((item) => this.normalizeLinkedinProfile(item));
  }

  private normalizeLinkedinProfile(item: any): NormalizedLead {
    const firstName = item.firstName || '';
    const lastName = item.lastName || '';
    const fullName = item.fullName || `${firstName} ${lastName}`.trim() || '';

    const currentPosition = Array.isArray(item.currentPosition) ? item.currentPosition[0] : null;
    const company = currentPosition?.companyName || item.companyName || item.currentCompany || '';
    const jobTitle = currentPosition?.title || item.headline || item.jobTitle || '';

    const city = item.location?.parsed?.city || item.location?.city || item.city || '';
    const country = item.location?.parsed?.country || item.location?.country || item.state || '';

    const email = Array.isArray(item.emails) ? item.emails[0] : item.email || '';

    return {
      name: fullName,
      phone: item.mobileNumber || item.phone || '',
      email: typeof email === 'string' ? email : email?.email || '',
      companyName: company,
      jobTitle,
      website: item.companyWebsite || item.website || '',
      address: item.addressWithoutCountry || item.addressWithCountry || '',
      city,
      state: country,
      profileUrl: item.linkedinUrl || item.linkedinPublicUrl || item.url || '',
      sourceUrl: item.linkedinUrl || item.linkedinPublicUrl || item.url || '',
      category: item.companyIndustry || item.industry || '',
      score: null,
      reviewsCount: null,
      username: item.username || '',
      source: LeadSource.LINKEDIN,
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
