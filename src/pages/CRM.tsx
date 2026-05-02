import { useState, useEffect, useRef } from "react";
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
  Search, Bot, Tag, Activity, MoreVertical, Zap, MessageSquare,
  Megaphone, Webhook, X, ChevronDown, Phone, AlertTriangle,
  CheckCircle2, Clock, DollarSign, Filter,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Quais etapas têm automação
const STAGE_AUTOMATIONS: Record<string, { icon: any; label: string; color: string }[]> = {
  envio:             [{ icon: Megaphone, label: "API Oficial", color: "hsl(258 90% 70%)" }],
  respondeu:         [{ icon: Bot, label: "IA", color: "hsl(165 65% 50%)" }],
  atendimento_ia:    [{ icon: Bot, label: "IA", color: "hsl(165 65% 50%)" }, { icon: Webhook, label: "Webhook", color: "hsl(38 92% 60%)" }],
  qualificado:       [{ icon: MessageSquare, label: "Evolution", color: "hsl(145 65% 50%)" }],
};

const LOSS_REASONS = [
  "Sem dinheiro", "Sem interesse", "Não respondeu",
  "Comprou de outro", "Fora do perfil", "Outro",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function tempColor(t: string) {
  if (t === "Quente") return "danger";
  if (t === "Morno") return "warning";
  return "info";
}

function daysSince(dateStr: string): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86400000);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CRM() {
  const { leads, moveLead, fetchLeads, updateLead } = useApp();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [active, setActive] = useState<Lead | null>(null);
  const [viewingContact, setViewingContact] = useState<Lead | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [filterTemp, setFilterTemp] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  // Loss modal
  const [pendingLoss, setPendingLoss] = useState<{ lead: Lead; targetStage: StageId } | null>(null);
  const [lossReason, setLossReason] = useState("");
  // Automation confirm
  const [pendingMove, setPendingMove] = useState<{ lead: Lead; targetStage: StageId } | null>(null);

  useEffect(() => { fetchLeads(); }, []);

  const filteredLeads = leads.filter((l) => {
    if (globalSearch) {
      const q = globalSearch.toLowerCase();
      if (![l.name, l.phone, l.companyName, l.origin, ...(l.tags || [])].some(v => v?.toLowerCase().includes(q))) return false;
    }
    if (filterTemp !== "all" && l.temperature !== filterTemp) return false;
    return true;
  });

  const onDragStart = (e: DragStartEvent) => {
    setActive(leads.find((l) => l.id === e.active.id) || null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const targetStage = e.over?.id as StageId | undefined;
    if (!targetStage) return;
    const lead = leads.find((l) => l.id === e.active.id);
    if (!lead || lead.stage === targetStage) return;

    if (targetStage === "perdido") {
      setPendingLoss({ lead, targetStage });
      return;
    }
    if (STAGE_AUTOMATIONS[targetStage]) {
      setPendingMove({ lead, targetStage });
      return;
    }
    doMove(lead, targetStage);
  };

  function doMove(lead: Lead, targetStage: StageId, options?: { lossReason?: string }) {
    moveLead(lead.id, targetStage);
    if (options?.lossReason) {
      toast(`Lead marcado como perdido: ${options.lossReason}`);
    } else {
      const stageName = STAGES.find(s => s.id === targetStage)?.title;
      toast.success(`Movido para "${stageName}"`);
    }
    // Persist to backend
    api.updateContact(lead.id, { stage: targetStage, ...(options?.lossReason ? { lossReason: options.lossReason } : {}) }).catch(() => {});
  }

  function confirmLoss() {
    if (!pendingLoss || !lossReason) return;
    doMove(pendingLoss.lead, pendingLoss.targetStage, { lossReason });
    setPendingLoss(null);
    setLossReason("");
  }

  function confirmMove(runAutomations: boolean) {
    if (!pendingMove) return;
    doMove(pendingMove.lead, pendingMove.targetStage);
    if (runAutomations) toast.success("Automações da etapa disparadas!");
    setPendingMove(null);
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={globalSearch} onChange={e => setGlobalSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, empresa, tag..."
            className="pl-9 h-9 text-xs bg-surface border-border-subtle" />
          {globalSearch && (
            <button onClick={() => setGlobalSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        <Button variant="outline" size="sm" className="border-border-subtle text-xs gap-1.5 h-9"
          onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-3.5 w-3.5" /> Filtros
          {filterTemp !== "all" && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </Button>

        {showFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            {["all", "Quente", "Morno", "Frio"].map(t => (
              <button key={t} onClick={() => setFilterTemp(t)}
                className={cn("px-3 py-1 rounded-full text-xs border transition-all",
                  filterTemp === t ? "border-primary/50 bg-primary/10 text-primary" : "border-border-subtle text-muted-foreground hover:border-primary/30")}>
                {t === "all" ? "Todas temp." : t}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto text-xs text-muted-foreground">
          {filteredLeads.length} leads{globalSearch ? " encontrados" : " total"}
        </div>
      </div>

      {/* Kanban */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto pb-4 -mx-6 lg:-mx-10 px-6 lg:px-10">
          <div className="flex gap-4 min-w-max">
            {STAGES.map(stage => (
              <Column
                key={stage.id}
                stage={stage}
                leads={filteredLeads.filter(l => l.stage === stage.id)}
                onLeadClick={setViewingContact}
                onUpdateLead={updateLead}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 250, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
          {active && <div className="w-[300px]"><LeadCard lead={active} dragging /></div>}
        </DragOverlay>
      </DndContext>

      {/* Loss Modal */}
      {pendingLoss && (
        <Modal onClose={() => { setPendingLoss(null); setLossReason(""); }}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-destructive/15 grid place-items-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-semibold">Marcar como Perdido</p>
                <p className="text-xs text-muted-foreground">{pendingLoss.lead.name}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Motivo da perda *</Label>
              <div className="grid grid-cols-2 gap-2">
                {LOSS_REASONS.map(r => (
                  <button key={r} onClick={() => setLossReason(r)}
                    className={cn("px-3 py-2 rounded-xl text-xs border text-left transition-all",
                      lossReason === r ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-border-subtle hover:border-destructive/30")}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 border-border-subtle text-xs"
                onClick={() => { setPendingLoss(null); setLossReason(""); }}>Cancelar</Button>
              <Button disabled={!lossReason} onClick={confirmLoss}
                className="flex-1 bg-destructive text-destructive-foreground text-xs">Confirmar perda</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Automation Confirm Modal */}
      {pendingMove && (
        <Modal onClose={() => setPendingMove(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-warning/15 grid place-items-center">
                <Zap className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="font-semibold">Etapa com automações</p>
                <p className="text-xs text-muted-foreground">
                  "{STAGES.find(s => s.id === pendingMove.targetStage)?.title}" possui automações configuradas.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(STAGE_AUTOMATIONS[pendingMove.targetStage] || []).map(a => (
                <div key={a.label} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border"
                  style={{ borderColor: `${a.color}40`, background: `${a.color}10`, color: a.color }}>
                  <a.icon className="h-3 w-3" /> {a.label}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Deseja disparar as automações agora?</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-border-subtle text-xs"
                onClick={() => confirmMove(false)}>Só mover</Button>
              <Button onClick={() => confirmMove(true)}
                className="flex-1 bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-xs">
                Mover e disparar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <ContactDetailsSheet viewingContact={viewingContact} setViewingContact={setViewingContact} />
    </>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────

function Column({ stage, leads, onLeadClick, onUpdateLead }: {
  stage: typeof STAGES[number]; leads: Lead[];
  onLeadClick: (l: Lead) => void;
  onUpdateLead: (id: string, patch: Partial<Lead>) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id });
  const [colSearch, setColSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const automations = STAGE_AUTOMATIONS[stage.id] || [];

  const filtered = leads.filter(l => {
    if (!colSearch) return true;
    const q = colSearch.toLowerCase();
    return [l.name, l.phone].some(v => v?.toLowerCase().includes(q));
  });

  const totalValue = leads.reduce((sum, l) => sum + ((l as any).value || 0), 0);

  return (
    <div ref={setNodeRef}
      className={cn(
        "w-[300px] shrink-0 rounded-2xl border bg-surface/40 backdrop-blur-sm flex flex-col transition-colors",
        isOver ? "border-primary/50 bg-primary/5" : "border-border-subtle",
      )}>
      {/* Column Header */}
      <div className="p-3 border-b border-border-subtle">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: stage.accent }} />
            <h3 className="font-display font-semibold text-sm truncate">{stage.title}</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {automations.map(a => (
              <span key={a.label} title={a.label}
                className="h-5 w-5 rounded-md grid place-items-center"
                style={{ background: `${a.color}20`, color: a.color }}>
                <a.icon className="h-3 w-3" />
              </span>
            ))}
            <span className="text-xs text-muted-foreground bg-background/60 rounded-full px-1.5 py-0.5 border border-border-subtle">
              {leads.length}
            </span>
            <button onClick={() => setShowSearch(!showSearch)}
              className="h-6 w-6 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors">
              <Search className="h-3 w-3" />
            </button>
          </div>
        </div>

        {totalValue > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            R$ {totalValue.toLocaleString("pt-BR")}
          </p>
        )}

        {showSearch && (
          <div className="mt-2">
            <Input value={colSearch} onChange={e => setColSearch(e.target.value)}
              placeholder="Filtrar nesta etapa..."
              className="h-7 text-xs bg-background border-border-subtle" />
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="p-2.5 space-y-2.5 flex-1 min-h-[120px] overflow-y-auto conversations-scroll">
        {filtered.map(l => (
          <DraggableLead key={l.id} lead={l} onClick={() => onLeadClick(l)} />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border-subtle p-5 text-center text-xs text-muted-foreground">
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
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className={cn("relative touch-none", isDragging && "opacity-30")}>
      <div ref={setNodeRef} {...listeners} {...attributes}
        onClick={(e) => { if (!showMenu) onClick(); }}
        className="cursor-grab active:cursor-grabbing">
        <LeadCard lead={lead} />
      </div>

      {/* Quick menu */}
      <div ref={menuRef}>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="absolute top-2 right-2 h-6 w-6 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors z-10">
          <MoreVertical className="h-3.5 w-3.5" />
        </button>

        {showMenu && (
          <div className="absolute top-8 right-2 z-50 w-44 rounded-xl border border-border-subtle bg-surface/95 backdrop-blur-sm shadow-xl py-1 text-xs">
            {[
              { label: "Abrir detalhes", action: () => { onClick(); setShowMenu(false); } },
              { label: "Abrir conversa", action: () => { window.location.href = "/conversas"; } },
              { label: "Mover para Qualificado", action: () => { moveLead(lead.id, "qualificado"); setShowMenu(false); } },
              { label: "Mover para Perdido", action: () => { moveLead(lead.id, "perdido"); setShowMenu(false); } },
            ].map(item => (
              <button key={item.label} onClick={item.action}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-elevated transition-colors">
                {item.label}
              </button>
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
      "rounded-xl border bg-surface-elevated/80 p-3 transition-all select-none",
      dragging ? "border-primary/60 shadow-glow rotate-1 scale-105" : "border-border-subtle hover:border-primary/30 hover:bg-surface-elevated",
      isDelayed && "border-l-2 border-l-warning/60",
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pr-5">
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-sm text-foreground truncate">{lead.name}</p>
          {lead.companyName && <p className="text-[11px] text-muted-foreground truncate">{lead.companyName}</p>}
          <p className="font-mono text-[10px] text-muted-foreground">{lead.phone}</p>
        </div>
        <StatusBadge variant={tempColor(lead.temperature) as any} dot className="shrink-0 text-[10px]">
          {lead.temperature}
        </StatusBadge>
      </div>

      {/* Value */}
      {value > 0 && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-success font-medium">
          <DollarSign className="h-3 w-3" />
          R$ {value.toLocaleString("pt-BR")}
        </div>
      )}

      {/* Tags */}
      {(lead.tags?.length > 0 || lead.origin) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.origin && <StatusBadge variant="info" className="text-[10px]">{lead.origin}</StatusBadge>}
          {lead.tags?.slice(0, 2).map(t => (
            <StatusBadge key={t} variant="accent" className="text-[10px]"><Tag className="h-2.5 w-2.5 mr-0.5" />{t}</StatusBadge>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-2.5 pt-2.5 border-t border-border-subtle flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Bot className="h-3 w-3 text-primary" />
          <span>{lead.iaStatus}</span>
        </div>
        <div className={cn("flex items-center gap-1", isDelayed && "text-warning")}>
          {isDelayed ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {days === 0 ? "Hoje" : `${days}d atrás`}
        </div>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card rounded-2xl p-6 w-full max-w-sm shadow-xl border border-border-subtle animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
