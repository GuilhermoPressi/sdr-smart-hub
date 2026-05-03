import { NavLink, useLocation } from "react-router-dom";
import { Bot, MessageCircle, ListPlus, Users, KanbanSquare, Sparkles, MessageSquare, LayoutDashboard, ScrollText, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiWatcher } from "@/hooks/use-ai-watcher";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/configurar-ia", label: "Configurar IA de Atendimento", icon: Bot },
  { to: "/whatsapp", label: "Conectar WhatsApp", icon: MessageCircle },
  { to: "/criar-lista", label: "Criar Lista", icon: ListPlus },
  { to: "/contatos", label: "Contatos", icon: Users },
  { to: "/conversas", label: "Conversas", icon: MessageSquare },
  { to: "/crm", label: "CRM", icon: KanbanSquare },
  { to: "/disparos", label: "Disparos", icon: Send },
  { to: "/logs-ia", label: "Logs da IA", icon: ScrollText },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { active: watcherActive } = useAiWatcher();

  return (
    <>
      <div className="px-6 py-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="font-display font-semibold text-foreground leading-none">LeadFlow</p>
          <p className="text-[11px] text-muted-foreground mt-1 tracking-widest uppercase">SDR Suite</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          const isLogs = item.to === "/logs-ia";
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-300",
                active
                  ? "bg-gradient-to-r from-primary/15 to-accent/10 text-foreground shadow-soft border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
              )}
            >
              <Icon className={cn("h-4 w-4 transition-colors", active ? "text-primary" : "")} />
              <span className="font-medium">{item.label}</span>
              {/* Indicador pulsante de IA ativa nos logs */}
              {isLogs && watcherActive && (
                <span className="ml-auto h-2 w-2 rounded-full bg-success animate-pulse" title="IA respondendo automaticamente" />
              )}
              {active && !isLogs && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />}
            </NavLink>
          );
        })}
      </nav>

      <div className="m-3 rounded-2xl border border-border-subtle bg-surface/60 p-4">
        {watcherActive ? (
          <div className="flex items-center gap-2 text-xs text-success mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            IA respondendo automaticamente
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            Nenhuma IA configurada
          </div>
        )}
        <p className="text-xs text-muted-foreground/80 leading-relaxed">
          {watcherActive
            ? "Monitorando conversas e respondendo leads automaticamente."
            : "Configure uma IA de atendimento para ativar as respostas automáticas."}
        </p>
      </div>
    </>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border-subtle bg-sidebar/80 backdrop-blur-xl">
      <SidebarContent />
    </aside>
  );
}
