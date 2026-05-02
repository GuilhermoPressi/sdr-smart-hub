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
  placeId: string;
  category: string;
  score: number | null;
  reviewsCount: number | null;
  imported: boolean;
  duplicate: boolean;
  rawData: Record<string, any>;
}

// Gera variações de query para maximizar cobertura
function generateQueryVariations(query: string, targetLimit: number): string[] {
  const variations: string[] = [query];
  if (targetLimit <= 25) return variations;

  // Extrai segmento e cidade da query
  const lower = query.toLowerCase();

  const zonas = ['centro', 'zona norte', 'zona sul', 'zona leste', 'zona oeste', 'bairros'];
  const synonyms: Record<string, string[]> = {
    dentista: ['clínica odontológica', 'consultório dentário', 'odontologia'],
    médico: ['clínica médica', 'consultório médico', 'medicina'],
    advogado: ['escritório advocacia', 'advocacia', 'advogados'],
    psicólogo: ['psicologia', 'clínica psicológica', 'terapeuta'],
    academia: ['ginástica', 'fitness', 'musculação'],
    'clínica estética': ['estética', 'spa', 'beleza', 'salão'],
    restaurante: ['lanchonete', 'pizzaria', 'gastronomia'],
    farmácia: ['drogaria', 'farmácias'],
  };

  // Adiciona variações por zona se targetLimit >= 50
  if (targetLimit >= 50) {
    const cityMatch = lower.match(/\bem\s+([a-záàâãéèêíïóôõúüç\s]+)$/i);
    const city = cityMatch ? cityMatch[1].trim() : '';
    const segment = city ? query.replace(/\sem\s.*$/i, '').trim() : query;

    if (city) {
      zonas.slice(0, targetLimit >= 100 ? 4 : 2).forEach((zona) => {
        variations.push(`${segment} ${city} ${zona}`);
      });
    }
  }

  // Adiciona sinônimos
  for (const [key, syns] of Object.entries(synonyms)) {
    if (lower.includes(key)) {
      const cityMatch = query.match(/\bem\s+(.+)$/i);
      const city = cityMatch ? ` em ${cityMatch[1]}` : '';
      syns.slice(0, 2).forEach((syn) => variations.push(`${syn}${city}`));
      break;
    }
  }

  return [...new Set(variations)]; // remove duplicatas
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

  async runActor(actorId: string, input: Record<string, any>) {
    const client = this.getClient();
    const urlActorId = actorId.replace('/', '~');
    this.logger.log(`▶ Actor: ${actorId} | Input: ${JSON.stringify(input)}`);
    try {
      const res = await client.post(`/acts/${urlActorId}/runs`, input, {
        params: { waitForFinish: 120 },
      });
      const run = res.data?.data;
      this.logger.log(`  Run: ${run?.id} | Status: ${run?.status}`);
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
        if (run?.status === 'SUCCEEDED') return { runId, datasetId: run?.defaultDatasetId || datasetId };
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
    try {
      const res = await client.get(`/datasets/${datasetId}/items`, {
        params: { limit, clean: true, format: 'json' },
      });
      const items = Array.isArray(res.data) ? res.data : [];
      this.logger.log(`  Dataset ${datasetId}: ${items.length} itens`);
      return items;
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err.message;
      throw new InternalServerErrorException(`Erro ao buscar dataset: ${msg}`);
    }
  }

  // ── BUSCA INTELIGENTE COM MÚLTIPLAS VARIAÇÕES ─────────────────────────────

  async runAndWait(query: string, limit: number): Promise<{ leads: NormalizedLead[]; reachedTarget: boolean }> {
    const variations = generateQueryVariations(query, limit);
    this.logger.log(`Variações geradas (${variations.length}): ${variations.join(' | ')}`);

    const seenIds = new Set<string>(); // placeId ou phone_normalized
    const allLeads: NormalizedLead[] = [];

    // Calcula quantos leads pedir por variação
    const perVariation = Math.ceil(limit / variations.length) + 5;

    for (const variation of variations) {
      if (allLeads.length >= limit) break;

      try {
        this.logger.log(`🔍 Buscando: "${variation}" (meta: ${perVariation})`);
        const { datasetId } = await this.runActor('compass/crawler-google-places', {
          searchStringsArray: [variation],
          maxCrawledPlacesPerSearch: perVariation,
        });

        const items = await this.getDatasetItems(datasetId, perVariation);
        const withPhone = items.filter((i) => i.phone || i.phoneUnformatted);

        for (const item of withPhone) {
          if (allLeads.length >= limit) break;

          // Deduplicação por placeId ou phone
          const pid = item.placeId || item.id || '';
          const rawPhone = item.phone || item.phoneUnformatted || '';
          const phoneNorm = this.normalizePhone(rawPhone);
          const dedupKey = pid || phoneNorm;

          if (dedupKey && seenIds.has(dedupKey)) continue;
          if (dedupKey) seenIds.add(dedupKey);

          allLeads.push(await this.normalizeItem(item));
        }

        this.logger.log(`  → Total acumulado: ${allLeads.length}/${limit}`);
      } catch (err) {
        this.logger.warn(`Variação "${variation}" falhou: ${err.message}`);
      }
    }

    const reachedTarget = allLeads.length >= limit;
    this.logger.log(`=== BUSCA FINALIZADA: ${allLeads.length} leads (target: ${limit}, atingido: ${reachedTarget}) ===`);

    return { leads: allLeads, reachedTarget };
  }

  private async normalizeItem(item: any): Promise<NormalizedLead> {
    const rawPhone = item.phone || item.phoneUnformatted || '';
    const phoneNorm = this.normalizePhone(rawPhone);
    const hasWhatsapp = phoneNorm.startsWith('55') && phoneNorm.length >= 12;

    let email = item.email || '';
    if (!email && item.website) email = await this.extractEmailFromWebsite(item.website);

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
      placeId: item.placeId || item.id || '',
      category: item.categoryName || item.category || '',
      score: item.totalScore ?? null,
      reviewsCount: item.reviewsCount ?? null,
      imported: false,
      duplicate: false,
      rawData: item,
    };
  }

  // ── Utils ─────────────────────────────────────────────────────────────────

  normalizePhone(raw: string): string {
    if (!raw) return '';
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (!digits.startsWith('55')) digits = '55' + digits;
    return digits;
  }

  async extractEmailFromWebsite(website: string): Promise<string> {
    try {
      const url = website.startsWith('http') ? website : `https://${website}`;
      const res = await axios.get(url, {
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SDRBot/1.0)' },
        maxRedirects: 3,
      });
      const html: string = res.data || '';
      const matches = (html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])
        .filter((e) => !e.includes('noreply') && !e.includes('no-reply') &&
          !e.includes('@sentry') && !e.includes('@example') &&
          !e.includes('.png') && !e.includes('.jpg') && e.length < 80);
      if (!matches.length) return '';
      const priority = ['contato@', 'comercial@', 'atendimento@', 'suporte@', 'vendas@', 'info@'];
      for (const p of priority) {
        const found = matches.find((e) => e.toLowerCase().startsWith(p));
        if (found) return found.toLowerCase();
      }
      return matches[0].toLowerCase();
    } catch {
      return '';
    }
  }
}
