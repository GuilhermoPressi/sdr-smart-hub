import { Bot, Briefcase, Megaphone, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Group, Field } from "./components";
import { TONES, FORMALITIES, RESPONSE_LENGTHS, TONE_EXAMPLES } from "./constants";
import { AIConfig } from "@/store/app";
import { cn } from "@/lib/utils";

interface StepProps {
  ai: AIConfig;
  setAI: (patch: Partial<AIConfig>) => void;
}

/* ── ETAPA 1 — Sobre a Empresa ── */
export function StepEmpresa({ ai, setAI }: StepProps) {
  return (
    <Group icon={Bot} title="Sobre a Empresa" description="Dados básicos sobre sua empresa e o vendedor virtual.">
      <Field label="Nome da IA / vendedor" hint="É o nome que a IA vai usar para se apresentar no atendimento." required>
        <Input value={ai.internalName} onChange={(e) => setAI({ internalName: e.target.value })} placeholder="Ex: Nome do atendente" />
      </Field>
      <Field label="Nome da empresa" required>
        <Input value={ai.company} onChange={(e) => setAI({ company: e.target.value })} placeholder="Ex: Nome da sua empresa" />
      </Field>
      <Field label="Segmento da empresa" required>
        <Input value={ai.segment} onChange={(e) => setAI({ segment: e.target.value })} placeholder="Ex: qual a área de atuação da empresa?" />
      </Field>
      <Field label="Região de atendimento" optional>
        <Input value={ai.region} onChange={(e) => setAI({ region: e.target.value })} placeholder="Ex: Brasil inteiro, São Paulo e região, atendimento online" />
      </Field>
    </Group>
  );
}

/* ── ETAPA 2 — Oferta ── */
export function StepOferta({ ai, setAI }: StepProps) {
  return (
    <Group icon={Briefcase} title="Oferta" description="O que sua empresa vende, para quem e como.">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5 text-xs text-foreground/80 leading-relaxed">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <span>
          Cada agente de IA é vinculado a <strong>um produto</strong>. Na hora de programar o disparo de mensagens, você seleciona qual agente enviar.
        </span>
      </div>
      <Field label="Produto ou serviço vendido" required>
        <Input value={ai.product} onChange={(e) => setAI({ product: e.target.value })} placeholder="Ex: o que você vende?" />
      </Field>
      <Field label="Público-alvo" recommended>
        <Input value={ai.audience} onChange={(e) => setAI({ audience: e.target.value })} placeholder="" />
      </Field>
      <Field label="Principal problema que a solução resolve" recommended>
        <Input value={ai.problem} onChange={(e) => setAI({ problem: e.target.value })} placeholder="" />
      </Field>
      <Field label="Benefício principal da solução" recommended>
        <Input value={ai.benefit} onChange={(e) => setAI({ benefit: e.target.value })} placeholder="" />
      </Field>
      <Field label="Diferenciais da empresa/produto" optional>
        <Input value={ai.differentials} onChange={(e) => setAI({ differentials: e.target.value })} placeholder="Ex: atendimento 24h, garantia estendida, etc." />
      </Field>
      <Field label="Fatores que influenciam preço, prazo ou proposta" optional>
        <Input value={ai.pricingFactors} onChange={(e) => setAI({ pricingFactors: e.target.value })} placeholder="Ex: quantidade, tamanho, localização" />
      </Field>
    </Group>
  );
}

/* ── ETAPA 3 — Personalidade ── */
export function StepPersonalidade({ ai, setAI }: StepProps) {
  return (
    <Group icon={Megaphone} title="Personalidade da IA" description="Como a IA deve se comunicar com os leads.">
      <Field label="Tom de voz da IA" required>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button key={t} type="button" onClick={() => setAI({ tone: t })} className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200",
              ai.tone === t
                ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                : "border-border-subtle bg-surface text-foreground hover:border-primary/40",
            )}>{t}</button>
          ))}
        </div>
        {ai.tone && (
          <div className="mt-2 rounded-lg bg-surface/60 border border-border-subtle p-3 text-xs text-foreground/70 italic leading-relaxed animate-fade-in">
            <span className="text-muted-foreground not-italic font-medium">Exemplo:</span>
            <br />"{TONE_EXAMPLES[ai.tone]}"
          </div>
        )}
      </Field>
      <Field label="Mensagem inicial da IA" optional hint="Se deixar vazio, a IA vai gerar automaticamente com base nos dados da empresa.">
        <Textarea value={ai.initialMessage} onChange={(e) => setAI({ initialMessage: e.target.value })} rows={3}
          placeholder={`Ex: Oi, tudo bem? Aqui é ${ai.internalName || "a Ana"} da ${ai.company || "empresa"}. Vi que você pode ter interesse em ${ai.product || "nosso serviço"}...`}
        />
      </Field>
    </Group>
  );
}
