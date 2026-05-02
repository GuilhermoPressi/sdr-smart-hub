import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AiConfig } from '../ai-config/entities/ai-config.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { Message } from '../messages/entities/message.entity';

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);
  private client: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
      this.logger.log('OpenAI configurada ✅');
    } else {
      this.logger.warn('OPENAI_API_KEY não definida. IA não funcionará.');
    }
  }

  async generateResponse(
    config: AiConfig,
    contact: Contact,
    history: Message[],
  ): Promise<string | null> {
    if (!this.client) {
      this.logger.error('OpenAI client não inicializado.');
      return null;
    }

    const systemPrompt = this.buildSystemPrompt(config, contact);
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history
    for (const msg of history) {
      if (msg.sender === 'lead') {
        messages.push({ role: 'user', content: msg.text });
      } else {
        messages.push({ role: 'assistant', content: msg.text });
      }
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 500,
      });

      const reply = completion.choices?.[0]?.message?.content?.trim();
      return reply || null;
    } catch (err) {
      this.logger.error(`Erro na OpenAI: ${err.message}`);
      return null;
    }
  }

  private buildSystemPrompt(config: AiConfig, contact: Contact): string {
    const discovery = config.discovery || {};

    const parts: string[] = [
      `Você é ${config.displayName}, assistente SDR virtual da empresa "${config.company}".`,
      `Segmento: ${config.segment || 'Não especificado'}.`,
      `Produto/Serviço: ${config.product || 'Não especificado'}.`,
      `Público-alvo: ${config.audience || 'Não especificado'}.`,
      '',
      '── PROBLEMA QUE RESOLVEMOS ──',
      config.problem || '(Não configurado)',
      '',
      '── BENEFÍCIO PRINCIPAL ──',
      config.benefit || '(Não configurado)',
      '',
      '── TOM DE VOZ ──',
      config.tone || 'Profissional, amigável e consultivo.',
      '',
      '── OBJETIVO DA CONVERSA ──',
      'Seu objetivo é qualificar o lead fazendo perguntas de Discovery (uma por vez, sem parecer um interrogatório).',
      `Critério para considerar qualificado: ${config.qualifiedCriteria || 'Lead demonstrou necessidade clara e tem poder de decisão.'}`,
      '',
      '── PERGUNTAS DE DISCOVERY ──',
      `Necessidade: ${discovery.need || ''}`,
      `Timeline: ${discovery.timeline || ''}`,
      `Investimento: ${discovery.investment || ''}`,
      `Autoridade: ${discovery.authority || ''}`,
      `Dados para orçamento: ${discovery.quotationData || ''}`,
      '',
    ];

    if (config.neverPromise) {
      parts.push('── NUNCA PROMETA ──', config.neverPromise, '');
    }

    if (config.neverAsk) {
      parts.push('── NUNCA PERGUNTE ──', config.neverAsk, '');
    }

    if (config.instructions) {
      parts.push('── INSTRUÇÕES ADICIONAIS ──', config.instructions, '');
    }

    parts.push(
      '── REGRAS GERAIS ──',
      '1. Responda APENAS em português do Brasil.',
      '2. Seja BREVE: 1 a 3 frases por mensagem, máximo 4. Nunca envie mensagens longas.',
      '3. Use emojis com moderação (no máximo 1-2 por mensagem).',
      '4. Faça UMA pergunta por vez. Espere a resposta antes de perguntar outra.',
      '5. Não invente dados, preços ou funcionalidades que não foram informados.',
      '6. Se o lead pedir para falar com um humano, responda educadamente que vai transferir e finalize.',
      '7. Não mencione que é uma IA a menos que seja perguntado diretamente.',
      '',
      `── CONTEXTO DO LEAD ──`,
      `Nome: ${contact.name || 'Desconhecido'}`,
      `Empresa: ${contact.companyName || 'Não informada'}`,
      `Cargo: ${contact.jobTitle || 'Não informado'}`,
      `Temperatura: ${contact.temperature || 'Frio'}`,
    );

    return parts.join('\n');
  }
}
