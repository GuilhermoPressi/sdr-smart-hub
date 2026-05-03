import { useState } from "react";
import { Plus, X, GripVertical, ChevronDown, ChevronUp, Zap, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AIConfig, ConversationStep } from "@/store/app";
import { FLOW_TEMPLATES } from "./constants";
import { Field } from "./components";
import { cn } from "@/lib/utils";

interface Props {
  ai: AIConfig;
  setAI: (patch: Partial<AIConfig>) => void;
}

const emptyStep = (): ConversationStep => ({
  id: `step_${Date.now()}`,
  name: "",
  initialMessage: "",
  questions: [],
  objective: "",
  nextStep: "",
  exitConditions: [],
  requiredAnswers: [],
});

export default function TabFluxo({ ai, setAI }: Props) {
  const steps = ai.conversationFlow || [];
  const [expanded, setExpanded] = useState<string | null>(steps[0]?.id || null);
  const [newQuestion, setNewQuestion] = useState<Record<string, string>>({});
  const [newExit, setNewExit] = useState<Record<string, string>>({});
  const [newRequired, setNewRequired] = useState<Record<string, string>>({});

  const updateSteps = (newSteps: ConversationStep[]) => {
    // Auto-set nextStep based on order
    const linked = newSteps.map((s, i) => ({
      ...s,
      nextStep: i < newSteps.length - 1 ? newSteps[i + 1].id : "",
    }));
    setAI({ conversationFlow: linked });
  };

  const updateStep = (id: string, patch: Partial<ConversationStep>) => {
    updateSteps(steps.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const addStep = () => {
    const step = emptyStep();
    updateSteps([...steps, step]);
    setExpanded(step.id);
  };

  const removeStep = (id: string) => {
    updateSteps(steps.filter(s => s.id !== id));
  };

  const loadTemplates = () => {
    const templateSteps: ConversationStep[] = FLOW_TEMPLATES.map((t, i) => ({
      ...t,
      nextStep: i < FLOW_TEMPLATES.length - 1 ? FLOW_TEMPLATES[i + 1].id : "",
    }));
    setAI({ conversationFlow: templateSteps });
    setExpanded(templateSteps[0]?.id || null);
  };

  const addToArray = (stepId: string, field: "questions" | "exitConditions" | "requiredAnswers", stateMap: Record<string, string>, setStateMap: (v: Record<string, string>) => void) => {
    const value = (stateMap[stepId] || "").trim();
    if (!value) return;
    const step = steps.find(s => s.id === stepId);
    if (!step) return;
    const current = step[field] || [];
    updateStep(stepId, { [field]: [...current, value] });
    setStateMap({ ...stateMap, [stepId]: "" });
  };

  const removeFromArray = (stepId: string, field: "questions" | "exitConditions" | "requiredAnswers", index: number) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;
    const current = [...(step[field] || [])];
    current.splice(index, 1);
    updateStep(stepId, { [field]: current });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Fluxo de Atendimento
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Defina as etapas da conversa. A IA seguirá este fluxo automaticamente.
          </p>
        </div>
        <div className="flex gap-2">
          {steps.length === 0 && (
            <Button variant="outline" size="sm" onClick={loadTemplates} className="border-primary/30 text-primary text-xs">
              <Zap className="h-3 w-3 mr-1" /> Usar template padrão
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={addStep} className="border-border-subtle text-xs">
            <Plus className="h-3 w-3 mr-1" /> Adicionar etapa
          </Button>
        </div>
      </div>

      {/* Flow visualization */}
      {steps.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap px-1">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setExpanded(expanded === step.id ? null : step.id)}
                className={cn(
                  "px-3 py-1 rounded-lg text-[11px] font-medium border transition-all",
                  expanded === step.id
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-surface/60 border-border-subtle text-muted-foreground hover:text-foreground",
                )}
              >
                {step.name || `Etapa ${i + 1}`}
              </button>
              {i < steps.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {steps.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-border-subtle p-12 text-center">
          <Zap className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma etapa configurada.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Clique em "Usar template padrão" para começar com as etapas recomendadas.
          </p>
        </div>
      )}

      {/* Step cards */}
      {steps.map((step, idx) => (
        <div
          key={step.id}
          className={cn(
            "rounded-xl border transition-all",
            expanded === step.id
              ? "border-primary/20 bg-surface/60"
              : "border-border-subtle bg-surface/30",
          )}
        >
          {/* Header */}
          <button
            type="button"
            className="w-full flex items-center gap-3 p-4"
            onClick={() => setExpanded(expanded === step.id ? null : step.id)}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold grid place-items-center shrink-0">
              {idx + 1}
            </span>
            <span className="text-sm font-medium text-foreground flex-1 text-left truncate">
              {step.name || "Nova etapa"}
            </span>
            <span className="text-[10px] text-muted-foreground mr-2">
              {step.questions.length}q · {step.exitConditions.length}c
            </span>
            {expanded === step.id ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {/* Expanded content */}
          {expanded === step.id && (
            <div className="px-4 pb-4 space-y-4 border-t border-border-subtle/50 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="ID da etapa" required>
                  <Input value={step.id} onChange={e => updateStep(step.id, { id: e.target.value })} className="text-xs font-mono" placeholder="boas_vindas" />
                </Field>
                <Field label="Nome da etapa" required>
                  <Input value={step.name} onChange={e => updateStep(step.id, { name: e.target.value })} placeholder="Boas-vindas" />
                </Field>
              </div>

              <Field label="Objetivo desta etapa" required>
                <Textarea value={step.objective} onChange={e => updateStep(step.id, { objective: e.target.value })} rows={2} placeholder="Ex: Entender o interesse inicial do lead" />
              </Field>

              <Field label="Mensagem inicial" optional hint="A IA usará como base ao iniciar esta etapa.">
                <Textarea value={step.initialMessage} onChange={e => updateStep(step.id, { initialMessage: e.target.value })} rows={2} placeholder="Ex: Olá! Tudo bem? Queria entender melhor..." />
              </Field>

              {/* Questions */}
              <Field label="Perguntas desta etapa">
                <div className="space-y-1.5">
                  {step.questions.map((q, qi) => (
                    <div key={qi} className="flex items-center gap-2 text-xs bg-surface/80 rounded-lg px-3 py-2 border border-border-subtle">
                      <span className="flex-1">{q}</span>
                      <button type="button" onClick={() => removeFromArray(step.id, "questions", qi)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input value={newQuestion[step.id] || ""} onChange={e => setNewQuestion({ ...newQuestion, [step.id]: e.target.value })} placeholder="Nova pergunta..." className="text-xs"
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addToArray(step.id, "questions", newQuestion, setNewQuestion); } }} />
                    <Button type="button" variant="outline" size="sm" onClick={() => addToArray(step.id, "questions", newQuestion, setNewQuestion)} disabled={!(newQuestion[step.id] || "").trim()}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Field>

              {/* Exit Conditions */}
              <Field label="Condições de saída" hint="Quando essas condições forem detectadas, a IA avança para a próxima etapa.">
                <div className="space-y-1.5">
                  {step.exitConditions.map((c, ci) => (
                    <div key={ci} className="flex items-center gap-2 text-xs bg-emerald-500/5 rounded-lg px-3 py-2 border border-emerald-500/20">
                      <span className="flex-1">{c}</span>
                      <button type="button" onClick={() => removeFromArray(step.id, "exitConditions", ci)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input value={newExit[step.id] || ""} onChange={e => setNewExit({ ...newExit, [step.id]: e.target.value })} placeholder="Ex: Lead informou seu problema principal" className="text-xs"
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addToArray(step.id, "exitConditions", newExit, setNewExit); } }} />
                    <Button type="button" variant="outline" size="sm" onClick={() => addToArray(step.id, "exitConditions", newExit, setNewExit)} disabled={!(newExit[step.id] || "").trim()}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Field>

              {/* Required Answers */}
              <Field label="Respostas obrigatórias" optional hint="Informações que o lead PRECISA fornecer antes de avançar.">
                <div className="space-y-1.5">
                  {(step.requiredAnswers || []).map((r, ri) => (
                    <div key={ri} className="flex items-center gap-2 text-xs bg-amber-500/5 rounded-lg px-3 py-2 border border-amber-500/20">
                      <span className="flex-1">{r}</span>
                      <button type="button" onClick={() => removeFromArray(step.id, "requiredAnswers", ri)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input value={newRequired[step.id] || ""} onChange={e => setNewRequired({ ...newRequired, [step.id]: e.target.value })} placeholder="Ex: Nome da empresa" className="text-xs"
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addToArray(step.id, "requiredAnswers", newRequired, setNewRequired); } }} />
                    <Button type="button" variant="outline" size="sm" onClick={() => addToArray(step.id, "requiredAnswers", newRequired, setNewRequired)} disabled={!(newRequired[step.id] || "").trim()}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Field>

              {/* Next step info + delete */}
              <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50">
                <div className="text-[11px] text-muted-foreground">
                  {step.nextStep ? (
                    <span>Próxima etapa: <strong className="text-foreground">{steps.find(s => s.id === step.nextStep)?.name || step.nextStep}</strong></span>
                  ) : (
                    <span>Última etapa do fluxo</span>
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeStep(step.id)} className="text-destructive/60 hover:text-destructive text-xs">
                  <X className="h-3 w-3 mr-1" /> Remover etapa
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
