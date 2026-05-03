import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot, CheckCircle2, Wand2, Plus, Edit2, Trash2, AlertCircle, ArrowLeft, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingModal } from "@/components/shared/LoadingModal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useApp } from "@/store/app";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

import { TABS, BUILD_PHRASES } from "./configurar-ia/constants";
import TabFluxo from "./configurar-ia/TabFluxo";
import TabComportamento from "./configurar-ia/TabComportamento";
import TabConhecimento from "./configurar-ia/TabConhecimento";
import TabRegras from "./configurar-ia/TabRegras";

export default function ConfigurarIA() {
  const navigate = useNavigate();
  const { ai, setAI, agents, saveAgent, deleteAgent, resetAI, connections } = useApp();
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  const [view, setView] = useState<"list" | "editor">("list");
  const [activeTab, setActiveTab] = useState("fluxo");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const configs = await api.getAiConfigs();
        if (configs && configs.length > 0) {
          configs.forEach((c: any) => saveAgent(c));
          const active = configs.find((c: any) => c.active);
          if (active) setActiveConfigId(active.id);
        }
      } catch (e) {
        console.error("Erro ao carregar configurações", e);
      }
    };
    loadConfigs();
  }, []);

  const startNewAI = () => {
    resetAI();
    setActiveTab("fluxo");
    setView("editor");
  };

  const editAI = (agent: any) => {
    setAI(agent);
    setActiveTab("fluxo");
    setView("editor");
  };

  const handleSave = async () => {
    if (!ai.internalName.trim() || !ai.company.trim()) {
      toast.error("Preencha pelo menos o Nome da IA e o Nome da Empresa na aba Comportamento.");
      setActiveTab("comportamento");
      return;
    }
    setSaving(true);
    setLoading(true);
  };

  const handleActivate = async (e: React.MouseEvent, id: string, isActive: boolean) => {
    e.stopPropagation();
    setActivating(id);
    try {
      if (isActive) {
        await api.deactivateAiConfig(id);
        setActiveConfigId(null);
        toast.success("IA desativada.");
      } else {
        await api.activateAiConfig(id);
        setActiveConfigId(id);
        toast.success("IA ativada! Respondendo automaticamente.");
      }
    } catch {
      toast.error("Erro ao alterar status da IA.");
    } finally {
      setActivating(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir esta IA?")) return;
    try {
      // 1. Delete from backend
      const result = await api.deleteAiConfig(id);
      console.log("[AI] Delete result:", result);
      // 2. Remove from local state immediately
      deleteAgent(id);
      if (activeConfigId === id) setActiveConfigId(null);
      toast.success("IA excluída com sucesso.");
      // 3. Re-fetch to sync (deleteAgent already removed it locally)
      try {
        const configs = await api.getAiConfigs();
        // Replace entire agents list with fresh data from backend
        const currentIds = (configs || []).map((c: any) => c.id);
        // Remove any local agents that no longer exist on backend
        agents.forEach(a => {
          if (!currentIds.includes(a.id)) deleteAgent(a.id);
        });
        (configs || []).forEach((c: any) => saveAgent(c));
      } catch { /* silent re-fetch failure is ok, local state is already correct */ }
    } catch (err) {
      console.error("[AI] Erro ao deletar:", err);
      toast.error("Erro ao excluir IA. Tente novamente.");
    }
  };

  // ── List View ─────────────────────────────────────────────────────────
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
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mb-6">
              Crie seu primeiro agente configurando o fluxo, comportamento, conhecimento e regras.
            </p>
            <Button onClick={startNewAI} variant="outline" className="border-border-subtle">
              Começar agora
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => {
              const isActive = activeConfigId === agent.id;
              const hasFlow = agent.conversationFlow && agent.conversationFlow.length > 0;
              const hasRules = agent.behaviorRules && agent.behaviorRules.length > 0;
              return (
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
                        onClick={(e) => handleActivate(e, agent.id, isActive)}
                        disabled={activating === agent.id}
                        className={cn("p-1.5 transition-colors rounded-md text-xs font-medium flex items-center gap-1",
                          isActive
                            ? "text-success hover:text-warning hover:bg-warning/10"
                            : "text-muted-foreground hover:text-success hover:bg-success/10")}
                        title={isActive ? "Desativar IA" : "Ativar IA"}
                      >
                        {activating === agent.id ? "..." : isActive ? "✓ Ativa" : "Ativar"}
                      </button>
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
                        Evolution não conectada. Acesse Conectar WhatsApp.
                      </p>
                    </div>
                  )}

                  {isActive && (
                    <div className="mb-2 flex items-center gap-1.5 text-xs text-success font-medium">
                      <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                      IA Ativa — respondendo automaticamente
                    </div>
                  )}

                  <h4 className="font-semibold text-sm line-clamp-2 mb-1">{agent.displayName || agent.internalName}</h4>

                  <div className="space-y-1.5 mt-auto pt-4 text-xs text-muted-foreground">
                    <p className="flex justify-between"><span className="opacity-70">Empresa:</span> <span className="font-medium text-foreground">{agent.company || "-"}</span></p>
                    <p className="flex justify-between"><span className="opacity-70">Produto:</span> <span className="font-medium text-foreground truncate ml-2">{agent.product || "-"}</span></p>
                    {hasFlow && (
                      <p className="flex justify-between"><span className="opacity-70">Fluxo:</span> <span className="font-medium text-foreground">{agent.conversationFlow!.length} etapas</span></p>
                    )}
                    {hasRules && (
                      <p className="flex justify-between"><span className="opacity-70">Regras:</span> <span className="font-medium text-foreground">{agent.behaviorRules!.length} regras</span></p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Editor View (4 abas) ──────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={() => setView("list")} className="px-2 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para lista
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {ai.id && ai.id.length === 36 ? "Editando" : "Nova IA"}
          </span>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {saving ? (
              <>Salvando...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Salvar IA</>
            )}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start bg-surface/50 border border-border-subtle rounded-xl p-1 h-auto flex-wrap">
          {TABS.map(tab => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className={cn(
                "rounded-lg px-4 py-2 text-xs font-medium transition-all data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow",
              )}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="fluxo" className="mt-6">
          <TabFluxo ai={ai} setAI={setAI} />
        </TabsContent>

        <TabsContent value="comportamento" className="mt-6">
          <TabComportamento ai={ai} setAI={setAI} />
        </TabsContent>

        <TabsContent value="conhecimento" className="mt-6">
          <TabConhecimento ai={ai} setAI={setAI} />
        </TabsContent>

        <TabsContent value="regras" className="mt-6">
          <TabRegras ai={ai} setAI={setAI} />
        </TabsContent>
      </Tabs>

      {/* Build modal */}
      <LoadingModal
        open={loading}
        phrases={BUILD_PHRASES}
        durationMs={3500}
        title="Salvando sua IA de Atendimento"
        onComplete={async () => {
          try {
            const displayName = ai.displayName || ai.internalName || `${ai.company || "IA"} - ${ai.product || "Atendimento"}`;
            const internalName = ai.internalName || displayName;

            const finalAgent = {
              ...ai,
              internalName,
              displayName,
              built: true,
              active: false,
            };

            const savedAgent = await api.saveAiConfig(finalAgent);

            const currentAgents = agents.filter(a => a.id !== savedAgent.id);
            const hasActiveAgent = currentAgents.some(a => a.id === activeConfigId);

            if (!hasActiveAgent || currentAgents.length === 0) {
              try {
                await api.activateAiConfig(savedAgent.id);
                setActiveConfigId(savedAgent.id);
              } catch (activateErr) {
                console.warn("[AI] Não foi possível ativar:", activateErr);
              }
            }

            setAI(savedAgent);
            saveAgent(savedAgent);

            setLoading(false);
            setSaving(false);
            setSuccess(true);
            toast.success("IA salva com sucesso!");
          } catch (error) {
            setLoading(false);
            setSaving(false);
            toast.error("Erro ao salvar configuração.");
            console.error(error);
          }
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
              <h3 className="font-display text-xl font-semibold">IA salva com sucesso</h3>
              <p className="text-sm text-muted-foreground mt-1">Sua IA está pronta para responder automaticamente.</p>
            </div>
            <div className="flex flex-col gap-2 w-full pt-2">
              <Button className="w-full bg-gradient-primary text-primary-foreground" onClick={() => { setSuccess(false); setView("list"); }}>
                Voltar para minhas IAs
              </Button>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1 border-border-subtle" onClick={() => setSuccess(false)}>Continuar editando</Button>
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
