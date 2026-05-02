import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import axios from 'axios';

export interface NormalizedLead {
  name: string;
  phone: string;
  phone_normalized: string;
  has_whatsapp: boolean;
  email: string;
  companyName: string;
  website: string;
  address: string;
  city: string;
  state: string;
  profileUrl: string;
  category: string;
  score: number | null;
  reviewsCount: number | null;
  source: 'google';
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

  // ── GOOGLE MAPS ───────────────────────────────────────────────────────────

  async runAndWait(query: string, limit: number): Promise<NormalizedLead[]> {
    const { datasetId } = await this.runActor('compass/crawler-google-places', {
      searchStringsArray: [query],
      maxCrawledPlacesPerSearch: limit,
    });

    const items = await this.getDatasetItems(datasetId, limit);

    // Filtra apenas itens com telefone
    const withPhone = items.filter((i) => i.phone || i.phoneUnformatted);
    this.logger.log(`  Com telefone: ${withPhone.length}/${items.length}`);

    const leads: NormalizedLead[] = [];
    for (const item of withPhone) {
      const lead = await this.normalizeGoogle(item);
      leads.push(lead);
    }

    return leads;
  }

  private async normalizeGoogle(item: any): Promise<NormalizedLead> {
    const rawPhone = item.phone || item.phoneUnformatted || '';
    const phoneNorm = this.normalizePhone(rawPhone);
    const hasWhatsapp = phoneNorm.startsWith('55') && phoneNorm.length >= 12;

    // Tenta extrair email do site
    let email = item.email || '';
    if (!email && item.website) {
      email = await this.extractEmailFromWebsite(item.website);
    }

    return {
      name: item.title || item.name || '',
      phone: rawPhone,
      phone_normalized: phoneNorm,
      has_whatsapp: hasWhatsapp,
      email,
      companyName: item.title || item.name || '',
      website: item.website || '',
      address: item.address || item.street || '',
      city: item.city || '',
      state: item.state || '',
      profileUrl: item.url || '',
      category: item.categoryName || item.category || '',
      score: item.totalScore ?? null,
      reviewsCount: item.reviewsCount ?? null,
      source: 'google',
      imported: false,
      duplicate: false,
      rawData: item,
    };
  }

  // ── Normalização de telefone ──────────────────────────────────────────────

  normalizePhone(raw: string): string {
    if (!raw) return '';
    // Remove tudo que não é dígito
    let digits = raw.replace(/\D/g, '');
    // Garante prefixo 55 (Brasil)
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (!digits.startsWith('55')) digits = '55' + digits;
    return digits;
  }

  // ── Extração de email do site ─────────────────────────────────────────────

  async extractEmailFromWebsite(website: string): Promise<string> {
    try {
      const url = website.startsWith('http') ? website : `https://${website}`;
      const res = await axios.get(url, {
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SDRBot/1.0)' },
        maxRedirects: 3,
      });

      const html: string = res.data || '';
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = html.match(emailRegex) || [];

      // Remove emails de libs/sistemas (noreply, etc)
      const valid = matches.filter((e) =>
        !e.includes('noreply') &&
        !e.includes('no-reply') &&
        !e.includes('@sentry') &&
        !e.includes('@example') &&
        !e.includes('.png') &&
        !e.includes('.jpg') &&
        !e.includes('.svg') &&
        e.length < 80,
      );

      if (valid.length === 0) return '';

      // Prioridade de prefixos de contato
      const priority = ['contato@', 'comercial@', 'atendimento@', 'suporte@', 'vendas@', 'info@'];
      for (const prefix of priority) {
        const found = valid.find((e) => e.toLowerCase().startsWith(prefix));
        if (found) return found.toLowerCase();
      }

      return valid[0].toLowerCase();
    } catch (err) {
      this.logger.debug(`Email extraction falhou para ${website}: ${err.message}`);
      return '';
    }
  }
}
