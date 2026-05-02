import { useState, useEffect, useRef, useCallback } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { useApp, STAGES, StageId, Lead } from "@/store/app";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ContactDetailsSheet } from "@/components/shared/ContactDetailsSheet";
import {
  Search, Bot, Tag, MoreVertical, Zap, MessageSquare,
  Megaphone, Webhook, X, Clock, DollarSign, Filter,
  AlertTriangle, Plus, ChevronDown, ChevronLeft, ChevronRight,
  Edit2, Trash2, GripVertical, Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Pipeline types ────────────────────────────────────────────────────────────

interface PipelineStage {
  id: string;
  title: string;
  description: string;
  accent: string;
  automations: string[]; // 'api_oficial' | 'webhook' | 'evolution' | 'ia'
}

interface Pipeline {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  stages: PipelineStage[];
}

const AUTOMATION_ICONS: Record<string, { icon: any; label: string; color: string }> = {
  api_oficial: { icon: Megaphone,    label: "API Oficial", color: "hsl(258 90% 70%)" },
  ia:          { icon: Bot,          label: "IA",          color: "hsl(165 65% 50%)" },
  webhook:     { icon: Webhook,      label: "Webhook",     color: "hsl(38 92% 60%)"  },
  evolution:   { icon: MessageSquare,label: "Evolution",   color: "hsl(145 65% 50%)" },
};

const ACCENT_COLORS = [
  "hsl(200 95% 60%)", "hsl(258 90% 70%)", "hsl(165 65% 50%)",
  "hsl(38 92% 60%)",  "hsl(145 65% 50%)", "hsl(280 80% 65%)",
  "hsl(0 60% 55%)",   "hsl(30 90% 55%)",  "hsl(50 90% 55%)",
];

const LOSS_REASONS = ["Sem dinheiro","Sem interesse","Não respondeu","Comprou de outro","Fora do perfil","Outro"];

// Converte STAGES do store para formato Pipeline
function defaultPipeline(): Pipeline {
  return {
    id: "comercial",
    name: "Pipeline Comercial",
    color: "hsl(258 90% 70%)",
    isDefault: true,
    stages: STAGES.map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
      accent: s.accent,
      automations: s.id === "envio" ? ["api_oficial"]
        : s.id === "respondeu" ? ["ia"]
        : s.id === "atendimento_ia" ? ["ia","webhook"]
        : s.id === "qualificado" ? ["evolution"]
        : [],
    })),
  };
}

function loadPipelines(): Pipeline[] {
  try {
    const raw = localStorage.getItem("crm_pipelines");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [defaultPipeline()];
}

function savePipelines(pipelines: Pipeline[]) {
  localStorage.setItem("crm_pipelines", JSON.stringify(pipelines));
}

function loadActivePipelineId(): string {
  return localStorage.getItem("crm_active_pipeline") || "comercial";
}

function saveActivePipelineId(id: string) {
  localStorage.setItem("crm_active_pipeline", id);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tempColor(t: string) {
  return t === "Quente" ? "danger" : t === "Morno" ? "warning" : "info";
}
function daysSince(d: string) {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CRM() {
  const { leads, moveLead, fetchLeads, updateLead } = useApp();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [pipelines, setPipelines] = useState<Pipeline[]>(loadPipelines);
  const [activePipelineId, setActivePipelineId] = useState(loadActivePipelineId);
  const [activePipeline, setActivePipeline] = useState<Pipeline>(() =>
    pipelines.find(p => p.id === loadActivePipelineId()) || pipelines[0]
  );

  const [draggingLead, setDraggingLead] = useState<Lead | null>(null);
  const [viewingContact, setViewingContact] = useState<Lead | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [filterTemp, setFilterTemp] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showPipelineMenu, setShowPipelineMenu] = useState(false);
  const [showPipelineEditor, setShowPipelineEditor] = useState(false);
  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [pendingLoss, setPendingLoss] = useState<{ lead: Lead; targetStage: string } | null>(null);
  const [pendingMove, setPendingMove] = useState<{ lead: Lead; targetStage: string } | null>(null);
  const [lossReason, setLossReason] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchLeads(); }, []);

  // Sync active pipeline
  useEffect(() => {
    const p = pipelines.find(p => p.id === activePipelineId) || pipelines[0];
    setActivePipeline(p);
    saveActivePipelineId(p.id);
  }, [activePipelineId, pipelines]);

  // SHIFT+wheel horizontal scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  function switchPipeline(id: string) {
    setActivePipelineId(id);
    setShowPipelineMenu(false);
  }

  function updatePipelines(updated: Pipeline[]) {
    setPipelines(updated);
    savePipelines(updated);
  }

  function createPipeline(name: string) {
    const id = `pipeline_${Date.now()}`;
    const np: Pipeline = {
      id, name, color: "hsl(200 95% 60%)", isDefault: false,
      stages: [
        { id: `${id}_novo`, title: "Novo Lead", description: "Leads recém cadastrados.", accent: "hsl(200 95% 60%)", automations: [] },
        { id: `${id}_ganho`, title: "Ganho", description: "Venda fechada.", accent: "hsl(145 65% 50%)", automations: [] },
        { id: `${id}_perdido`, title: "Perdido", description: "Oportunidade perdida.", accent: "hsl(0 60% 55%)", automations: [] },
      ],
    };
    const updated = [...pipelines, np];
    updatePipelines(updated);
    setActivePipelineId(id);
    setShowNewPipeline(false);
    toast.success(`Pipeline "${name}" criado!`);
  }

  function deletePipeline(id: string) {
    if (pipelines.length === 1) { toast.error("Não é possível excluir o único pipeline."); return; }
    const updated = pipelines.filter(p => p.id !== id);
    updatePipelines(updated);
    if (activePipelineId === id) setActivePipelineId(updated[0].id);
    toast.success("Pipeline excluído.");
  }

  const filteredLeads = leads.filter(l => {
    if (globalSearch) {
      const q = globalSearch.toLowerCase();
      if (![l.name, l.phone, l.companyName, l.origin, ...(l.tags || [])].some(v => v?.toLowerCase().includes(q))) return false;
    }
    if (filterTemp !== "all" && l.temperature !== filterTemp) return false;
    return true;
  });

  const onDragStart = (e: DragStartEvent) => setDraggingLead(leads.find(l => l.id === e.active.id) || null);

  const onDragEnd = (e: DragEndEvent) => {
    setDraggingLead(null);
    const targetStageId = e.over?.id as string | undefined;
    if (!targetStageId) return;
    const lead = leads.find(l => l.id === e.active.id);
    if (!lead || lead.stage === targetStageId) return;
    const stage = activePipeline.stages.find(s => s.id === targetStageId);
    if (!stage) return;
    if (targetStageId.includes("perdido")) { setPendingLoss({ lead, targetStage: targetStageId }); return; }
    if (stage.automations.length > 0) { setPendingMove({ lead, targetStage: targetStageId }); return; }
    doMove(lead, targetStageId as StageId);
  };

  function doMove(lead: Lead, stageId: StageId, opts?: { lossReason?: string }) {
    moveLead(lead.id, stageId);
    api.updateContact(lead.id, { stage: stageId }).catch(() => {});
    if (opts?.lossReason) toast(`Perdido: ${opts.lossReason}`);
    else toast.success(`Movido para "${activePipeline.stages.find(s => s.id === stageId)?.title}"`);
  }

  function scroll(dir: "left" | "right") {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === "left" ? -340 : 340, behavior: "smooth" });
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 65px)" }}>

      {/* Toolbar */}
      <div className="px-6 lg:px-10 pt-4 pb-2 flex flex-wrap items-center gap-3 shrink-0">

        {/* Pipeline selector */}
        <div className="relative">
          <button onClick={() => setShowPipelineMenu(!showPipelineMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border-subtle bg-surface hover:border-primary/40 transition-colors text-sm font-semibold">
            <span className="h-2 w-2 rounded-full" style={{ background: activePipeline.color }} />
            {activePipeline.name}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {showPipelineMenu && (
            <div className="absolute top-full left-0 mt-1 z-50 w-56 rounded-xl border border-border-subtle bg-surface/95 backdrop-blur-sm shadow-xl py-1 text-sm">
              {pipelines.map(p => (
                <button key={p.id} onClick={() => switchPipeline(p.id)}
                  className={cn("w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-surface-elevated transition-colors",
                    p.id === activePipelineId && "text-primary")}>
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.id === activePipelineId && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
              <div className="border-t border-border-subtle mt-1 pt-1">
                <button onClick={() => { setShowNewPipeline(true); setShowPipelineMenu(false); }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 text-primary hover:bg-surface-elevated transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Novo pipeline
                </button>
              </div>
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={() => setShowPipelineEditor(true)}
          className="border-border-subtle text-xs gap-1.5 h-9">
          <Edit2 className="h-3.5 w-3.5" /> Editar pipeline
        </Button>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={globalSearch} onChange={e => setGlobalSearch(e.target.value)}
            placeholder="Buscar leads..." className="pl-9 h-9 text-xs bg-surface border-border-subtle" />
          {globalSearch && <button onClick={() => setGlobalSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
        </div>

        <Button variant="outline" size="sm" className="border-border-subtle text-xs gap-1.5 h-9"
          onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-3.5 w-3.5" /> Filtros
          {filterTemp !== "all" && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </Button>

        {showFilters && ["all","Quente","Morno","Frio"].map(t => (
          <button key={t} onClick={() => setFilterTemp(t)}
            className={cn("px-3 py-1 rounded-full text-xs border transition-all",
              filterTemp === t ? "border-primary/50 bg-primary/10 text-primary" : "border-border-subtle text-muted-foreground")}>
            {t === "all" ? "Toda temp." : t}
          </button>
        ))}

        {/* Nav arrows */}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => scroll("left")}
            className="h-8 w-8 rounded-lg border border-border-subtle bg-surface grid place-items-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => scroll("right")}
            className="h-8 w-8 rounded-lg border border-border-subtle bg-surface grid place-items-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Kanban scroll container — fixed height, horizontal scroll independente */}
      <div ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden px-6 lg:px-10 pb-2 kanban-scroll" style={{ minHeight: 0 }}>
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-3 h-full" style={{ minWidth: "max-content" }}>
            {activePipeline.stages.map(stage => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={filteredLeads.filter(l => l.stage === stage.id)}
                onLeadClick={setViewingContact}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
            {draggingLead && <div className="w-[288px]"><LeadCard lead={draggingLead} dragging /></div>}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── Modais ─────────────────────────────────────────────────────────── */}

      {/* Loss modal */}
      {pendingLoss && (
        <Modal onClose={() => { setPendingLoss(null); setLossReason(""); }}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-destructive/15 grid place-items-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div><p className="font-semibold">Marcar como Perdido</p><p className="text-xs text-muted-foreground">{pendingLoss.lead.name}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LOSS_REASONS.map(r => (
                <button key={r} onClick={() => setLossReason(r)}
                  className={cn("px-3 py-2 rounded-xl text-xs border text-left transition-all",
                    lossReason === r ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-border-subtle hover:border-destructive/30")}>
                  {r}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 text-xs border-border-subtle" onClick={() => { setPendingLoss(null); setLossReason(""); }}>Cancelar</Button>
              <Button disabled={!lossReason} className="flex-1 text-xs bg-destructive text-destructive-foreground"
                onClick={() => { doMove(pendingLoss.lead, pendingLoss.targetStage as StageId, { lossReason }); setPendingLoss(null); setLossReason(""); }}>
                Confirmar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Automation confirm */}
      {pendingMove && (
        <Modal onClose={() => setPendingMove(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-warning/15 grid place-items-center shrink-0"><Zap className="h-5 w-5 text-warning" /></div>
              <div>
                <p className="font-semibold">Etapa com automações</p>
                <p className="text-xs text-muted-foreground">"{activePipeline.stages.find(s => s.id === pendingMove.targetStage)?.title}"</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(activePipeline.stages.find(s => s.id === pendingMove.targetStage)?.automations || []).map(a => {
                const info = AUTOMATION_ICONS[a];
                if (!info) return null;
                return (
                  <span key={a} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs border"
                    style={{ borderColor: `${info.color}40`, background: `${info.color}15`, color: info.color }}>
                    <info.icon className="h-3 w-3" />{info.label}
                  </span>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-xs border-border-subtle" onClick={() => { doMove(pendingMove.lead, pendingMove.targetStage as StageId); setPendingMove(null); }}>Só mover</Button>
              <Button className="flex-1 text-xs bg-gradient-to-r from-primary to-primary-glow text-primary-foreground"
                onClick={() => { doMove(pendingMove.lead, pendingMove.targetStage as StageId); toast.success("Automações disparadas!"); setPendingMove(null); }}>
                Mover e disparar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Pipeline Editor */}
      {showPipelineEditor && (
        <PipelineEditor
          pipeline={activePipeline}
          onSave={(updated) => {
            const all = pipelines.map(p => p.id === updated.id ? updated : p);
            updatePipelines(all);
            setShowPipelineEditor(false);
            toast.success("Pipeline salvo!");
          }}
          onDelete={() => { deletePipeline(activePipeline.id); setShowPipelineEditor(false); }}
          onClose={() => setShowPipelineEditor(false)}
        />
      )}

      {/* New Pipeline Modal */}
      {showNewPipeline && (
        <NewPipelineModal
          onCreate={createPipeline}
          onClose={() => setShowNewPipeline(false)}
        />
      )}

      <ContactDetailsSheet viewingContact={viewingContact} setViewingContact={setViewingContact} />
    </div>
  );
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────

function KanbanColumn({ stage, leads, onLeadClick }: {
  stage: PipelineStage; leads: Lead[]; onLeadClick: (l: Lead) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id });
  const [colSearch, setColSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const filtered = leads.filter(l => {
    if (!colSearch) return true;
    const q = colSearch.toLowerCase();
    return [l.name, l.phone].some(v => v?.toLowerCase().includes(q));
  });

  return (
    <div ref={setNodeRef}
      className={cn(
        "w-[288px] shrink-0 rounded-2xl border flex flex-col transition-all duration-150",
        "bg-surface/40 backdrop-blur-sm",
        isOver ? "border-primary/60 bg-primary/5 shadow-[0_0_0_2px_hsl(var(--primary)/0.2)]" : "border-border-subtle",
      )}
      style={{ height: "100%" }}>

      {/* Header */}
      <div className="p-3 border-b border-border-subtle shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: stage.accent }} />
            <h3 className="font-display font-semibold text-sm truncate">{stage.title}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {stage.automations.map(a => {
              const info = AUTOMATION_ICONS[a];
              if (!info) return null;
              return (
                <span key={a} title={info.label}
                  className="h-5 w-5 rounded-md grid place-items-center"
                  style={{ background: `${info.color}20`, color: info.color }}>
                  <info.icon className="h-3 w-3" />
                </span>
              );
            })}
            <span className="text-[11px] text-muted-foreground bg-background/60 rounded-full px-1.5 py-0.5 border border-border-subtle">{leads.length}</span>
            <button onClick={() => setShowSearch(!showSearch)}
              className="h-6 w-6 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors">
              <Search className="h-3 w-3" />
            </button>
          </div>
        </div>
        {showSearch && (
          <Input value={colSearch} onChange={e => setColSearch(e.target.value)}
            placeholder="Filtrar..." className="mt-2 h-7 text-xs bg-background border-border-subtle" />
        )}
      </div>

      {/* Cards — scroll vertical dentro da coluna */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 conversations-scroll">
        {filtered.map(l => <DraggableLead key={l.id} lead={l} onClick={() => onLeadClick(l)} />)}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border-subtle p-5 text-center text-xs text-muted-foreground mt-1">
            {colSearch ? "Nenhum lead encontrado." : "Arraste leads para esta etapa."}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DraggableLead ─────────────────────────────────────────────────────────────

function DraggableLead({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { moveLead } = useApp();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={cn("relative touch-none", isDragging && "opacity-25")}>
      <div ref={setNodeRef} {...listeners} {...attributes} onClick={() => { if (!showMenu) onClick(); }}
        className="cursor-grab active:cursor-grabbing">
        <LeadCard lead={lead} />
      </div>
      <div ref={menuRef}>
        <button onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="absolute top-2 right-2 h-6 w-6 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors z-10">
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
        {showMenu && (
          <div className="absolute top-8 right-2 z-50 w-44 rounded-xl border border-border-subtle bg-surface/95 backdrop-blur-sm shadow-xl py-1 text-xs">
            {[
              { label: "Abrir detalhes", action: () => { onClick(); setShowMenu(false); } },
              { label: "Abrir conversa", action: () => { window.location.href = "/conversas"; } },
              { label: "Mover → Qualificado", action: () => { moveLead(lead.id, "qualificado"); setShowMenu(false); } },
              { label: "Mover → Perdido", action: () => { moveLead(lead.id, "perdido"); setShowMenu(false); } },
            ].map(item => (
              <button key={item.label} onClick={item.action}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-elevated transition-colors">{item.label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── LeadCard ──────────────────────────────────────────────────────────────────

function LeadCard({ lead, dragging = false }: { lead: Lead; dragging?: boolean }) {
  const days = daysSince(lead.lastInteraction);
  const isDelayed = days >= 3;
  const value = (lead as any).value;

  return (
    <div className={cn(
      "rounded-xl border p-3 transition-all select-none",
      "bg-surface-elevated/80",
      dragging ? "border-primary/60 shadow-[0_8px_30px_rgba(0,0,0,0.4)] rotate-1 scale-105" : "border-border-subtle hover:border-primary/30 hover:bg-surface-elevated",
      isDelayed && "border-l-[3px]",
    )}
      style={isDelayed ? { borderLeftColor: "hsl(38 92% 60%)" } : {}}>

      <div className="flex items-start gap-2 pr-5">
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm truncate">{lead.name}</p>
          {lead.companyName && <p className="text-[10px] text-muted-foreground truncate">{lead.companyName}</p>}
          <p className="font-mono text-[10px] text-muted-foreground">{lead.phone}</p>
        </div>
        <StatusBadge variant={tempColor(lead.temperature) as any} dot className="shrink-0 text-[10px]">
          {lead.temperature}
        </StatusBadge>
      </div>

      {value > 0 && (
        <p className="mt-1.5 text-[10px] text-success font-medium flex items-center gap-0.5">
          <DollarSign className="h-3 w-3" />R$ {value.toLocaleString("pt-BR")}
        </p>
      )}

      {(lead.origin || lead.tags?.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.origin && <StatusBadge variant="info" className="text-[10px]">{lead.origin}</StatusBadge>}
          {lead.tags?.slice(0, 2).map(t => (
            <StatusBadge key={t} variant="accent" className="text-[10px]"><Tag className="h-2.5 w-2.5 mr-0.5" />{t}</StatusBadge>
          ))}
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-border-subtle flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1"><Bot className="h-3 w-3 text-primary" />{lead.iaStatus}</div>
        <div className={cn("flex items-center gap-1", isDelayed && "text-warning")}>
          {isDelayed ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {days === 0 ? "Hoje" : `${days}d`}
        </div>
      </div>
    </div>
  );
}

// ── PipelineEditor ────────────────────────────────────────────────────────────

function PipelineEditor({ pipeline, onSave, onDelete, onClose }: {
  pipeline: Pipeline; onSave: (p: Pipeline) => void;
  onDelete: () => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<Pipeline>(JSON.parse(JSON.stringify(pipeline)));
  const [editingStage, setEditingStage] = useState<string | null>(null);

  function updateStage(id: string, patch: Partial<PipelineStage>) {
    setDraft(d => ({ ...d, stages: d.stages.map(s => s.id === id ? { ...s, ...patch } : s) }));
  }

  function addStage() {
    const id = `stage_${Date.now()}`;
    setDraft(d => ({ ...d, stages: [...d.stages, { id, title: "Nova Etapa", description: "", accent: "hsl(200 95% 60%)", automations: [] }] }));
    setEditingStage(id);
  }

  function removeStage(id: string) {
    setDraft(d => ({ ...d, stages: d.stages.filter(s => s.id !== id) }));
  }

  function toggleAutomation(stageId: string, key: string) {
    const stage = draft.stages.find(s => s.id === stageId);
    if (!stage) return;
    const has = stage.automations.includes(key);
    updateStage(stageId, { automations: has ? stage.automations.filter(a => a !== key) : [...stage.automations, key] });
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-md bg-background border-l border-border-subtle flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-5 border-b border-border-subtle flex items-center justify-between shrink-0">
          <div>
            <p className="font-display font-semibold">Editar Pipeline</p>
            <p className="text-xs text-muted-foreground">{draft.name}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg grid place-items-center text-muted-foreground hover:text-foreground hover:bg-surface-elevated">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 conversations-scroll">
          {/* Pipeline name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do pipeline</Label>
            <Input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              className="bg-surface border-border-subtle text-sm" />
          </div>

          {/* Accent color */}
          <div className="space-y-1.5">
            <Label className="text-xs">Cor do pipeline</Label>
            <div className="flex gap-2 flex-wrap">
              {ACCENT_COLORS.map(c => (
                <button key={c} onClick={() => setDraft(d => ({ ...d, color: c }))}
                  className={cn("h-7 w-7 rounded-lg border-2 transition-all", draft.color === c ? "border-foreground scale-110" : "border-transparent")}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          {/* Stages */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Etapas ({draft.stages.length})</Label>
              <button onClick={addStage} className="text-xs text-primary flex items-center gap-1 hover:underline">
                <Plus className="h-3 w-3" /> Adicionar etapa
              </button>
            </div>

            {draft.stages.map((stage, i) => (
              <div key={stage.id} className="rounded-xl border border-border-subtle bg-surface/60 overflow-hidden">
                {/* Stage header */}
                <div className="p-3 flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab shrink-0" />
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ background: stage.accent }} />
                  <span className="flex-1 text-sm font-medium truncate">{stage.title}</span>
                  <button onClick={() => setEditingStage(editingStage === stage.id ? null : stage.id)}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-surface-elevated">
                    {editingStage === stage.id ? "Fechar" : "Editar"}
                  </button>
                  {draft.stages.length > 1 && (
                    <button onClick={() => removeStage(stage.id)}
                      className="h-6 w-6 rounded-md grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Stage edit form */}
                {editingStage === stage.id && (
                  <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border-subtle">
                    <Input value={stage.title} onChange={e => updateStage(stage.id, { title: e.target.value })}
                      placeholder="Nome da etapa" className="h-8 text-xs bg-background border-border-subtle" />
                    <Input value={stage.description} onChange={e => updateStage(stage.id, { description: e.target.value })}
                      placeholder="Descrição" className="h-8 text-xs bg-background border-border-subtle" />

                    {/* Accent color */}
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1.5">Cor da etapa</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {ACCENT_COLORS.map(c => (
                          <button key={c} onClick={() => updateStage(stage.id, { accent: c })}
                            className={cn("h-6 w-6 rounded-md border-2 transition-all", stage.accent === c ? "border-foreground" : "border-transparent")}
                            style={{ background: c }} />
                        ))}
                      </div>
                    </div>

                    {/* Automations */}
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1.5">Automações ao entrar nesta etapa</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(AUTOMATION_ICONS).map(([key, info]) => (
                          <button key={key} onClick={() => toggleAutomation(stage.id, key)}
                            className={cn("flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs border transition-all",
                              stage.automations.includes(key)
                                ? "border-transparent text-white"
                                : "border-border-subtle text-muted-foreground hover:border-border")}
                            style={stage.automations.includes(key) ? { background: info.color } : {}}>
                            <info.icon className="h-3 w-3" /> {info.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Danger zone */}
          {!pipeline.isDefault && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-xs font-medium text-destructive mb-2">Zona de perigo</p>
              <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs"
                onClick={() => { if (confirm("Excluir este pipeline?")) onDelete(); }}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir pipeline
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border-subtle flex gap-2 shrink-0">
          <Button variant="outline" className="flex-1 border-border-subtle text-xs" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-xs"
            onClick={() => onSave(draft)}>Salvar pipeline</Button>
        </div>
      </div>
    </div>
  );
}

// ── NewPipelineModal ──────────────────────────────────────────────────────────

function NewPipelineModal({ onCreate, onClose }: { onCreate: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  return (
    <Modal onClose={onClose}>
      <div className="space-y-4">
        <p className="font-semibold">Criar novo pipeline</p>
        <Input value={name} onChange={e => setName(e.target.value)}
          placeholder="Ex: Pós-venda, Suporte..."
          className="bg-surface border-border-subtle"
          onKeyDown={e => e.key === "Enter" && name.trim() && onCreate(name.trim())} />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 border-border-subtle text-xs" onClick={onClose}>Cancelar</Button>
          <Button disabled={!name.trim()}
            className="flex-1 bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-xs"
            onClick={() => onCreate(name.trim())}>Criar</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card rounded-2xl p-6 w-full max-w-sm shadow-xl border border-border-subtle animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        {children}
      </div>
    </div>
  );
}
