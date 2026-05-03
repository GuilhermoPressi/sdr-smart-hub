import { useState } from "react";
import { Bot, MessageSquare, Briefcase, Plus, X, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AIConfig } from "@/store/app";
import { Group, Field } from "./components";
import { TONES, TONE_EXAMPLES, DEFAULT_BEHAVIOR_RULES } from "./constants";
import { cn } from "@/lib/utils";

interface Props {
  ai: AIConfig;
  setAI: (patch: Partial<AIConfig>) => void;
}

export default function TabComportamento({ ai, setAI }: Props) {
  const rules = ai.behaviorRules || [];
  const [newRule, setNewRule] = useState("");

  const addRule = () => {
    if (!newRule.trim()) return;
    setAI({ behaviorRules: [...rules, newRule.trim()] });
    setNewRule("");
  };

  const removeRule = (idx: number) => {
    setAI({ behaviorRules: rules.filter((_, i) => i !== idx) });
  };

  const loadDefaults = () => {
    setAI({ behaviorRules: [...DEFAULT_BEHAVIOR_RULES] });
  };

  const toggleDefaultRule = (rule: string) => {
    if (rules.includes(rule)) {
      setAI({ behaviorRules: rules.filter(r => r !== rule) });
    } else {
      setAI({ behaviorRules: [...rules, rule] });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Seção 1: Identidade ── */}
      <Group icon={Bot} title="Identidade" description="Dados básicos da IA e da empresa.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome da IA / vendedor" required hint="Nome que a IA usará para se apresentar.">
            <Input value={ai.internalName} onChange={e => setAI({ internalName: e.target.value })} placeholder="Ex: Ana" />
          </Field>
          <Field label="Nome da empresa" required>
            <Input value={ai.company} onChange={e => setAI({ company: e.target.value })} placeholder="Ex: Minha Empresa" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Segmento" required>
            <Input value={ai.segment} onChange={e => setAI({ segment: e.target.value })} placeholder="Ex: Tecnologia, Saúde, Imóveis" />
          </Field>
          <Field label="Produto/Serviço" required>
            <Input value={ai.product} onChange={e => setAI({ product: e.target.value })} placeholder="Ex: Software de gestão" />
          </Field>
        </div>
        <Field label="Região de atendimento" optional>
          <Input value={ai.region} onChange={e => setAI({ region: e.target.value })} placeholder="Ex: Brasil inteiro, São Paulo" />
        </Field>
      </Group>

      {/* ── Seção 2: Comunicação ── */}
      <Group icon={MessageSquare} title="Comunicação" description="Como a IA se comunica com os leads.">
        <Field label="Tom de voz" required>
          <div className="flex flex-wrap gap-2">
            {TONES.map(t => (
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

        <Field label="Estilo de resposta">
          <div className="flex flex-wrap gap-2">
            {(["Curtas", "Médias", "Detalhadas"] as const).map(style => (
              <button key={style} type="button" onClick={() => setAI({ responseLength: style })} className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200",
                ai.responseLength === style
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "border-border-subtle bg-surface text-foreground hover:border-primary/40",
              )}>{style}</button>
            ))}
          </div>
        </Field>

        <Field label="Mensagem inicial" optional hint="A IA usa como base ao iniciar uma conversa.">
          <Textarea value={ai.initialMessage} onChange={e => setAI({ initialMessage: e.target.value })} rows={3}
            placeholder={`Ex: Oi, tudo bem? Aqui é ${ai.internalName || "a Ana"} da ${ai.company || "empresa"}...`} />
        </Field>

        {/* Behavior Rules */}
        <Field label="Regras de comportamento" hint="Defina como a IA deve agir durante as conversas.">
          <div className="space-y-2">
            {/* Default rules as toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {DEFAULT_BEHAVIOR_RULES.map(rule => {
                const active = rules.includes(rule);
                return (
                  <button key={rule} type="button" onClick={() => toggleDefaultRule(rule)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-left transition-all",
                      active
                        ? "border-emerald-500/20 bg-emerald-500/5 text-foreground"
                        : "border-border-subtle/50 bg-surface/30 text-muted-foreground hover:text-foreground",
                    )}>
                    <CheckCircle2 className={cn("h-3 w-3 shrink-0", active ? "text-emerald-500" : "text-muted-foreground/30")} />
                    <span>{rule}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom rules */}
            {rules.filter(r => !DEFAULT_BEHAVIOR_RULES.includes(r)).length > 0 && (
              <div className="space-y-1.5 pt-2">
                <p className="text-[11px] font-medium text-muted-foreground">Regras personalizadas:</p>
                {rules.filter(r => !DEFAULT_BEHAVIOR_RULES.includes(r)).map((rule, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-primary/5 rounded-lg px-3 py-2 border border-primary/15">
                    <span className="flex-1">{rule}</span>
                    <button type="button" onClick={() => setAI({ behaviorRules: rules.filter(r => r !== rule) })} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add custom rule */}
            <div className="flex gap-2 pt-1">
              <Input value={newRule} onChange={e => setNewRule(e.target.value)} placeholder="Adicionar regra personalizada..."
                className="text-xs" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addRule(); } }} />
              <Button type="button" variant="outline" size="sm" onClick={addRule} disabled={!newRule.trim()}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </Field>
      </Group>

      {/* ── Seção 3: Contexto de Venda ── */}
      <Group icon={Briefcase} title="Contexto de Venda" description="Informações sobre o que você vende e para quem.">
        <Field label="Público-alvo" recommended>
          <Input value={ai.audience} onChange={e => setAI({ audience: e.target.value })} placeholder="Ex: Pequenas empresas de tecnologia" />
        </Field>
        <Field label="Problema que resolvemos" recommended>
          <Textarea value={ai.problem} onChange={e => setAI({ problem: e.target.value })} rows={2} placeholder="Ex: Empresas perdem tempo com processos manuais e desorganizados" />
        </Field>
        <Field label="Benefício principal" recommended>
          <Textarea value={ai.benefit} onChange={e => setAI({ benefit: e.target.value })} rows={2} placeholder="Ex: Automatiza e organiza, reduzindo tempo e custo" />
        </Field>
        <Field label="Diferenciais" optional>
          <Input value={ai.differentials} onChange={e => setAI({ differentials: e.target.value })} placeholder="Ex: Atendimento 24h, garantia estendida" />
        </Field>
        <Field label="Fatores de preço" optional hint="O que influencia o valor do produto/serviço.">
          <Input value={ai.pricingFactors} onChange={e => setAI({ pricingFactors: e.target.value })} placeholder="Ex: quantidade, tamanho, localização" />
        </Field>

        {/* Restrictions */}
        <Field label="O que a IA nunca deve prometer" optional>
          <Textarea value={ai.neverPromise} onChange={e => setAI({ neverPromise: e.target.value })} rows={2} placeholder="Ex: Preço final, desconto, prazo exato" />
        </Field>
        <Field label="Instruções especiais" optional>
          <Textarea value={ai.instructions} onChange={e => setAI({ instructions: e.target.value })} rows={2} placeholder="Ex: Não falar sobre preço antes de entender a necessidade" />
        </Field>
      </Group>
    </div>
  );
}
