import { useState } from "react";
import {
  Target, ShieldCheck, Lightbulb, Clock, Heart, Users2, FileText,
  Plus, X, MessageSquarePlus, CheckCircle2, Info, Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Group, Field, QualCard } from "./components";
import { GOAL_PRESETS, GOAL_DESCRIPTIONS, AUTO_RULES } from "./constants";
import { AIConfig } from "@/store/app";
import { cn } from "@/lib/utils";

interface StepProps {
  ai: AIConfig;
  setAI: (patch: Partial<AIConfig>) => void;
}

interface CustomQ { id: string; question: string; answer: string; enabled: boolean; }

/* ── ETAPA 4 — Objetivo de Qualificação ── */
export function StepObjetivo({ ai, setAI }: StepProps) {
  return (
    <Group icon={Target} title="Objetivo de Qualificação" description="Defina quando a IA deve considerar o lead pronto para o vendedor humano.">
      <Field label="Objetivo principal da IA" required hint="O que a IA deve fazer durante a conversa?">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {GOAL_PRESETS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => {
                setAI({ goalPreset: g.value });
                if (GOAL_DESCRIPTIONS[g.value]) {
                  setAI({ goal: GOAL_DESCRIPTIONS[g.value] });
                }
              }}
              className={cn(
                "px-3 py-2.5 rounded-xl text-xs font-medium border text-left transition-all duration-200",
                ai.goalPreset === g.value
                  ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                  : "border-border-subtle bg-surface text-foreground hover:border-primary/40",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </Field>

      {ai.goalPreset === "outro" && (
        <Field label="Descreva o objetivo personalizado" required>
          <Textarea
            value={ai.goal}
            onChange={(e) => setAI({ goal: e.target.value })}
            rows={3}
            placeholder="Ex: Considerar qualificado quando o lead informar que tem interesse real, explicar sua necessidade e informar dados."
          />
        </Field>
      )}



      {/* Fixed behavior — read only */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
          <Lock className="h-4 w-4" />
          O que a IA faz ao qualificar o lead
        </div>
        <ul className="text-xs text-foreground/70 space-y-1.5 ml-6">
          <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" /> Move o lead para a etapa "Lead Qualificado"</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" /> Para o atendimento automático</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" /> Deixa o vendedor humano assumir</li>
        </ul>
      </div>
    </Group>
  );
}

/* ── ETAPA 5 — Informações a Descobrir ── */
export function StepDescobertas({ ai, setAI, customQuestions, setCustomQuestions }: StepProps & {
  customQuestions: CustomQ[];
  setCustomQuestions: React.Dispatch<React.SetStateAction<CustomQ[]>>;
}) {
  const [newQ, setNewQ] = useState("");
  const [qualNeed, setQualNeed] = useState(true);
  const [qualTimeline, setQualTimeline] = useState(true);
  const [qualInvestment, setQualInvestment] = useState(true);
  const [qualAuthority, setQualAuthority] = useState(true);
  const [qualQuotation, setQualQuotation] = useState(!!ai.discovery.quotationData);

  const addQ = () => {
    if (!newQ.trim()) return;
    setCustomQuestions((prev) => [...prev, { id: `cq_${Date.now()}`, question: newQ.trim(), answer: "", enabled: true }]);
    setNewQ("");
  };

  return (
    <Group icon={Target} title="Informações que a IA precisa descobrir" description="Ative ou desative o que a IA deve perguntar ao lead durante a conversa.">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5 text-xs text-foreground/80 leading-relaxed">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <span>Se você <strong>não quer</strong> que a IA descubra alguma dessas informações, é só <strong>desativar o botão</strong> ao lado.</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QualCard icon={Lightbulb} label="A IA deve entender a necessidade do lead?" subtext="Como a IA deve perguntar isso?" value={ai.discovery.need} onChange={(v) => setAI({ discovery: { ...ai.discovery, need: v } })} accent="hsl(38 92% 60%)" enabled={qualNeed} onToggle={() => setQualNeed(!qualNeed)} />
        <QualCard icon={Clock} label="A IA deve descobrir a urgência ou prazo?" subtext="Como a IA deve perguntar isso?" value={ai.discovery.timeline} onChange={(v) => setAI({ discovery: { ...ai.discovery, timeline: v } })} accent="hsl(200 95% 60%)" enabled={qualTimeline} onToggle={() => setQualTimeline(!qualTimeline)} />
        <QualCard icon={Heart} label="A IA deve entender se existe previsão de investimento?" subtext="Como a IA deve perguntar isso?" value={ai.discovery.investment} onChange={(v) => setAI({ discovery: { ...ai.discovery, investment: v } })} accent="hsl(165 65% 50%)" enabled={qualInvestment} onToggle={() => setQualInvestment(!qualInvestment)} />
        <QualCard icon={Users2} label="A IA deve entender quem participa da decisão?" subtext="Como a IA deve perguntar isso?" value={ai.discovery.authority} onChange={(v) => setAI({ discovery: { ...ai.discovery, authority: v } })} accent="hsl(258 90% 70%)" enabled={qualAuthority} onToggle={() => setQualAuthority(!qualAuthority)} />
      </div>

      {/* Dados para orçamento */}
      <div className={cn(
        "rounded-xl border bg-surface/50 p-4 space-y-3 transition-all duration-200",
        qualQuotation ? "border-border-subtle" : "border-border-subtle/50 opacity-50",
      )}>
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg grid place-items-center shrink-0 bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground leading-snug">A IA deve coletar dados específicos para orçamento?</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Quais dados a IA precisa coletar?</p>
          </div>
          <Switch checked={qualQuotation} onCheckedChange={() => setQualQuotation(!qualQuotation)} />
        </div>
        {qualQuotation && (
          <Textarea value={ai.discovery.quotationData} onChange={(e) => setAI({ discovery: { ...ai.discovery, quotationData: e.target.value } })} rows={2} className="text-xs animate-fade-in" placeholder="Ex: CNPJ, cidade/estado, tamanho desejado, tipo de piso, telefone, e-mail" />
        )}
      </div>

      {/* Custom questions */}
      {customQuestions.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-foreground/90 flex items-center gap-1.5">
            <MessageSquarePlus className="h-3.5 w-3.5 text-primary" /> Suas perguntas personalizadas
          </p>
          {customQuestions.map((q) => (
            <div key={q.id} className={cn("rounded-xl border bg-surface/50 p-4 space-y-3 transition-all", q.enabled ? "border-border-subtle" : "border-border-subtle/50 opacity-50")}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Switch checked={q.enabled} onCheckedChange={() => setCustomQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, enabled: !x.enabled } : x))} />
                  <p className="font-medium text-sm text-foreground truncate">{q.question}</p>
                </div>
                <button onClick={() => setCustomQuestions((prev) => prev.filter((x) => x.id !== q.id))} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {q.enabled && (
                <Textarea value={q.answer} onChange={(e) => setCustomQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, answer: e.target.value } : x))} rows={2} className="text-xs animate-fade-in" placeholder="Descreva como a IA deve abordar esse assunto..." />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-border-subtle bg-surface/30 p-4">
        <p className="text-xs font-medium text-foreground/80 mb-2 flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5 text-primary" /> Adicionar pergunta personalizada
        </p>
        <div className="flex gap-2">
          <Input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="Ex: A IA deve perguntar quantos funcionários a empresa tem?" className="flex-1 text-sm" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQ(); } }} />
          <Button variant="outline" size="sm" onClick={addQ} disabled={!newQ.trim()} className="shrink-0"><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
    </Group>
  );
}

/* ── ETAPA 6 — Restrições e Segurança ── */
export function StepSeguranca({ ai, setAI }: StepProps) {
  return (
    <Group icon={ShieldCheck} title="Restrições e Segurança" description="Defina limites do que a IA pode ou não fazer.">
      <Field label="O que a IA nunca deve prometer?" optional>
        <Textarea value={ai.neverPromise} onChange={(e) => setAI({ neverPromise: e.target.value })} rows={2} placeholder="Ex: Não prometer preço final, desconto, prazo exato ou resultado garantido sem análise do vendedor." />
      </Field>
      <Field label="O que a IA nunca deve perguntar?" optional>
        <Textarea value={ai.neverAsk} onChange={(e) => setAI({ neverAsk: e.target.value })} rows={2} placeholder="Ex: Não pedir dados sensíveis desnecessários, senha, cartão ou documentos que não sejam necessários." />
      </Field>
      <Field label="Instruções especiais" optional hint="Algo específico que a IA deve saber ou evitar.">
        <Textarea value={ai.instructions} onChange={(e) => setAI({ instructions: e.target.value })} rows={2} placeholder="Ex: Não falar sobre preço antes de entender a necessidade. Não mencionar concorrentes." />
      </Field>

      {/* Regras automáticas fixas */}
      <div className="pt-2 border-t border-border-subtle space-y-3">
        <p className="text-xs font-medium text-foreground/80 flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-emerald-500" /> Regras automáticas — sempre ativas
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AUTO_RULES.map((rule) => (
            <div key={rule} className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface/50 px-4 py-2.5 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="text-foreground/90 text-xs">{rule}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Essas regras são aplicadas automaticamente. Você não precisa configurar nada.</p>
      </div>
    </Group>
  );
}
