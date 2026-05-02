import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot, CheckCircle2, ArrowRight, ArrowLeft, Wand2, Plus, Edit2, Trash2, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingModal } from "@/components/shared/LoadingModal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useApp } from "@/store/app";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { StepIndicator } from "./configurar-ia/components";
import { STEPS, BUILD_PHRASES } from "./configurar-ia/constants";
import { StepEmpresa, StepOferta, StepPersonalidade } from "./configurar-ia/steps-1-3";
import { StepObjetivo, StepSeguranca } from "./configurar-ia/steps-4-6";

export default function ConfigurarIA() {
  const navigate = useNavigate();
  const { ai, setAI, agents, saveAgent, deleteAgent, resetAI, connections } = useApp();
  
  // "list" shows the saved AIs, "wizard" shows the configuration steps
  const [view, setView] = useState<"list" | "wizard">("list");
  
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Step validation
  const stepValid = [
    !!(ai.internalName.trim() && ai.company.trim() && ai.segment.trim()),
    !!ai.product.trim(),
    !!ai.tone,
    !!(ai.goalPreset && (ai.goalPreset !== "outro" || ai.goal.trim())),
    true, // security is all optional
  ];

  const stepComplete = stepValid.map((v, i) => i < step && v);

  const canProceed = stepValid[step];
  const isLastStep = step === STEPS.length - 1;
  const allRequiredFilled = stepValid[0] && stepValid[1] && stepValid[2] && stepValid[3];

  const goNext = () => {
    if (!canProceed) {
      toast.error("Preencha os campos obrigatórios desta etapa antes de avançar.");
      return;
    }
    if (isLastStep) {
      if (!allRequiredFilled) {
        toast.error("Existem campos obrigatórios pendentes em etapas anteriores.");
        return;
      }
      setLoading(true);
    } else {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const startNewAI = () => {
    resetAI();
    setStep(0);
    setView("wizard");
  };

  const editAI = (agent: any) => {
    setAI(agent);
    setStep(0);
    setView("wizard");
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Tem certeza que deseja excluir esta IA?")) {
      deleteAgent(id);
      toast.success("IA excluída com sucesso.");
    }
  };

  // Render the list view
  if (view === "list") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold">Suas IAs de Atendimento</h2>
            <p className="text-sm text-muted-foreground mt-1">Gerencie os agentes de IA para cada produto ou serviço.</p>
          </div>
          <Button onClick={startNewAI} className="bg-gradient-primary text-primary-foreground shadow-glow">
            <Plus className="h-4 w-4 mr-2" /> Criar Nova IA
          </Button>
        </div>

        {agents.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center flex flex-col items-center justify-center border-dashed border-2 border-border-subtle">
            <div className="h-16 w-16 rounded-full bg-primary/10 grid place-items-center mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-lg font-medium">Nenhuma IA configurada</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mb-6">Crie seu primeiro agente de atendimento configurando o produto, persona e objetivo.</p>
            <Button onClick={startNewAI} variant="outline" className="border-border-subtle">
              Começar agora
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <div 
                key={agent.id}
                className="glass-card rounded-xl p-5 border-border-subtle hover:border-primary/40 transition-colors cursor-pointer group flex flex-col"
                onClick={() => editAI(agent)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="h-10 w-10 rounded-full bg-gradient-primary grid place-items-center shadow-glow shrink-0">
                    <Bot className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); editAI(agent); }}
                      className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-primary/10"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={(e) => handleDelete(e, agent.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {connections.evolution !== "connected" as any && (
                  <div className="mb-3 bg-warning/10 border border-warning/20 rounded-md p-2 flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                    <p className="text-[10px] text-warning-foreground leading-tight">
                      A Evolution API não está conectada. Acesse Conectar WhatsApp para ativar.
                    </p>
                  </div>
                )}
                
                <h4 className="font-semibold text-sm line-clamp-2 mb-1">{agent.displayName}</h4>
                <div className="space-y-1.5 mt-auto pt-4 text-xs text-muted-foreground">
                  <p className="flex justify-between"><span className="opacity-70">Empresa:</span> <span className="font-medium text-foreground">{agent.company || "-"}</span></p>
                  <p className="flex justify-between"><span className="opacity-70">Produto:</span> <span className="font-medium text-foreground truncate ml-2">{agent.product || "-"}</span></p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Render the wizard view
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => setView("list")} className="px-2 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para lista
        </Button>
      </div>

      <div className="space-y-6">
        {/* Progress bar */}
        <StepIndicator
          steps={STEPS}
          current={step}
          status={stepComplete}
        />

        {/* Step content */}
        {step === 0 && <StepEmpresa ai={ai} setAI={setAI} />}
        {step === 1 && <StepOferta ai={ai} setAI={setAI} />}
        {step === 2 && <StepPersonalidade ai={ai} setAI={setAI} />}
        {step === 3 && <StepObjetivo ai={ai} setAI={setAI} />}
        {step === 4 && <StepSeguranca ai={ai} setAI={setAI} />}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <div>
            {step > 0 && (
              <Button variant="outline" onClick={goBack} className="border-border-subtle">
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Etapa {step + 1} de {STEPS.length}
            </span>
            <div className="relative group">
              <Button
                onClick={goNext}
                disabled={!canProceed && !isLastStep}
                className={cn(
                  "font-medium transition-all",
                  canProceed
                    ? "bg-gradient-primary text-primary-foreground hover:opacity-95 shadow-glow"
                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-60",
                )}
                size="lg"
              >
                {isLastStep ? (
                  <><Wand2 className="h-4 w-4 mr-2" /> Construir minha IA</>
                ) : (
                  <>Próximo <ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
              {!canProceed && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-foreground text-background text-[11px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Preencha os campos obrigatórios (*)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Build modal */}
      <LoadingModal
        open={loading}
        phrases={BUILD_PHRASES}
        durationMs={4500}
        title="Construindo sua IA de Atendimento"
        onComplete={() => {
          setLoading(false);
          
          // Generate ID if it doesn't have one
          const agentId = ai.id || `ai_${Date.now()}`;
          
          // Generate Display Name
          const generatedName = `${ai.internalName} + ${ai.company} + ${ai.product}`;
          
          const finalAgent = {
            ...ai,
            id: agentId,
            displayName: generatedName,
            built: true
          };
          
          setAI(finalAgent); // Update current editing
          saveAgent(finalAgent); // Save to list
          
          setSuccess(true);
          toast.success("IA salva com sucesso");
        }}
      />

      {/* Success dialog */}
      <Dialog open={success} onOpenChange={setSuccess}>
        <DialogContent className="glass-card border-border-subtle max-w-md p-8 text-center [&>button]:hidden">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-primary blur-2xl opacity-50" />
              <div className="relative h-16 w-16 rounded-full bg-gradient-primary grid place-items-center shadow-glow animate-scale-in">
                <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold">IA criada com sucesso</h3>
              <p className="text-sm text-muted-foreground mt-1">Sua IA de atendimento está salva e pronta.</p>
            </div>
            <div className="flex flex-col gap-2 w-full pt-2">
              <Button className="w-full bg-gradient-primary text-primary-foreground" onClick={() => { setSuccess(false); setView("list"); }}>
                Voltar para minhas IAs
              </Button>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1 border-border-subtle" onClick={() => setSuccess(false)}>Editar</Button>
                <Button variant="outline" className="flex-1 border-border-subtle" onClick={() => { setSuccess(false); navigate("/whatsapp"); }}>
                  Conectar WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
