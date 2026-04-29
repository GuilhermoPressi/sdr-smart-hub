import { useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { useApp, STAGES, StageId, Lead } from "@/store/app";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Bot, Megaphone, Hand, Linkedin, Tag, Activity, Thermometer, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CRM() {
  const { leads, moveLead } = useApp();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [active, setActive] = useState<Lead | null>(null);

  const onDragStart = (e: DragStartEvent) => {
    const lead = leads.find((l) => l.id === e.active.id);
    if (lead) setActive(lead);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const overId = e.over?.id as StageId | undefined;
    if (!overId) return;
    const lead = leads.find((l) => l.id === e.active.id);
    if (!lead || lead.stage === overId) return;
    moveLead(lead.id, overId);

    if (overId === "abordado") toast.success("Template oficial programado para envio.");
    else if (overId === "respondeu") toast.success("Atendimento com IA preparado via Evolution.");
    else if (overId === "aguardando") toast.success("Lead qualificado. Ação manual do vendedor necessária.");
    else toast(`Movido para "${STAGES.find((s) => s.id === overId)?.title}"`);
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="overflow-x-auto pb-4 -mx-6 lg:-mx-10 px-6 lg:px-10">
        <div className="flex gap-4 min-w-max">
          {STAGES.map((stage) => (
            <Column key={stage.id} stage={stage} leads={leads.filter((l) => l.stage === stage.id)} />
          ))}
        </div>
      </div>

      <DragOverlay>
        {active && <LeadCard lead={active} dragging />}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ stage, leads }: { stage: typeof STAGES[number]; leads: Lead[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-[320px] shrink-0 rounded-2xl border bg-surface/40 backdrop-blur-sm flex flex-col transition-colors",
        isOver ? "border-primary/60 bg-primary/5" : "border-border-subtle",
      )}
    >
      <div className="p-4 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: stage.accent }} />
            <h3 className="font-display font-semibold text-sm">{stage.title}</h3>
          </div>
          <span className="text-xs text-muted-foreground bg-background/50 rounded-full px-2 py-0.5 border border-border-subtle">
            {leads.length}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{stage.description}</p>
      </div>

      <div className="p-3 space-y-3 flex-1 min-h-[200px]">
        {stage.id === "abordado" && <AutomationCard
          icon={Megaphone}
          title="Automação da etapa"
          description="Enviar template aprovado no Meta para este contato."
          accent="hsl(258 90% 70%)"
          children={
            <Select defaultValue="primeira">
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="primeira">Template de primeira abordagem</SelectItem>
                <SelectItem value="apresentacao">Template de apresentação comercial</SelectItem>
                <SelectItem value="convite">Template de convite para conversa</SelectItem>
              </SelectContent>
            </Select>
          }
        />}

        {stage.id === "respondeu" && <AutomationCard
          icon={Bot}
          title="Atendimento IA via Evolution"
          description="Quando o lead responder, a IA continua pelo número de suporte."
          accent="hsl(165 65% 50%)"
        >
          <div className="space-y-2">
            <ChatBubble side="left" channel="API Oficial">
              Olá! Vou continuar seu atendimento por outro número da nossa equipe.
            </ChatBubble>
            <ChatBubble side="left" channel="IA Evolution" ia>
              Olá, aqui é a assistente da equipe comercial. Vou te ajudar com algumas perguntas rápidas para entender melhor sua necessidade.
            </ChatBubble>
          </div>
        </AutomationCard>}

        {stage.id === "aguardando" && <AutomationCard
          icon={Hand}
          title="Ação manual do vendedor"
          description="Este lead está pronto. Atribua a um vendedor para enviar a proposta."
          accent="hsl(38 92% 60%)"
        />}

        {leads.map((l) => <DraggableLead key={l.id} lead={l} />)}
        {leads.length === 0 && (
          <div className="rounded-xl border border-dashed border-border-subtle p-6 text-center text-xs text-muted-foreground">
            Arraste leads para esta etapa.
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableLead({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("touch-none", isDragging && "opacity-30")}
    >
      <LeadCard lead={lead} />
    </div>
  );
}

function LeadCard({ lead, dragging = false }: { lead: Lead; dragging?: boolean }) {
  const tempColor =
    lead.temperature === "Quente" ? "danger" :
    lead.temperature === "Morno" ? "warning" : "info";

  return (
    <div className={cn(
      "rounded-xl border bg-surface-elevated/80 p-3 cursor-grab active:cursor-grabbing transition-all",
      dragging ? "border-primary/60 shadow-glow rotate-2 scale-105" : "border-border-subtle hover:border-primary/30 hover:bg-surface-elevated",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display font-semibold text-sm text-foreground truncate">{lead.name}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{lead.phone}</p>
        </div>
        <StatusBadge variant={tempColor as any} dot>{lead.temperature}</StatusBadge>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        <StatusBadge variant="info"><Linkedin className="h-2.5 w-2.5 mr-0.5" />{lead.origin}</StatusBadge>
        {lead.tags.map((t) => <StatusBadge key={t} variant="accent"><Tag className="h-2.5 w-2.5 mr-0.5" />{t}</StatusBadge>)}
      </div>

      <div className="mt-3 pt-3 border-t border-border-subtle space-y-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5"><Bot className="h-3 w-3 text-primary" /><span className="text-foreground/80">{lead.iaStatus}</span></div>
        <div className="flex items-center gap-1.5"><Activity className="h-3 w-3" />Última: {lead.lastInteraction}</div>
      </div>
    </div>
  );
}

function AutomationCard({
  icon: Icon, title, description, accent, children,
}: { icon: any; title: string; description: string; accent: string; children?: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-3 space-y-2 border"
      style={{
        background: `linear-gradient(135deg, ${accent}15, transparent)`,
        borderColor: `${accent}40`,
      }}
    >
      <div className="flex items-start gap-2">
        <div className="h-7 w-7 rounded-lg grid place-items-center" style={{ background: `${accent}25`, color: accent }}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-xs text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ChatBubble({ children, channel, ia = false }: { children: React.ReactNode; side?: "left" | "right"; channel: string; ia?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {ia ? <Bot className="h-2.5 w-2.5 text-primary" /> : <MessageSquare className="h-2.5 w-2.5 text-info" />}
        {channel}
      </p>
      <div className={cn(
        "rounded-xl rounded-tl-sm p-2.5 text-[11px] leading-relaxed border",
        ia ? "bg-primary/10 border-primary/30 text-foreground" : "bg-info/10 border-info/30 text-foreground",
      )}>
        {children}
      </div>
    </div>
  );
}
