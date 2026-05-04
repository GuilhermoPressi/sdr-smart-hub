import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useApp } from "@/store/app";
import { api } from "@/lib/api";
import { Bell, ShieldCheck, Menu, LogOut, User } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarContent } from "./AppSidebar";

const titles: Record<string, { title: string; subtitle: string }> = {
  "/configurar-ia": { title: "Configurar IA de Atendimento", subtitle: "Crie sua IA SDR em poucos minutos. Sem prompts complicados." },
  "/whatsapp": { title: "Conectar seu WhatsApp", subtitle: "Conecte um ou os dois canais. Nada é ativado nesta versão." },
  "/criar-lista": { title: "Criar Lista de Leads", subtitle: "Encontre leads qualificados em minutos." },
  "/contatos": { title: "Contatos", subtitle: "Organize, marque e envie para o CRM." },
  "/crm": { title: "CRM", subtitle: "Acompanhe cada lead até a proposta." },
  "/disparos": { title: "Disparos", subtitle: "Envie mensagens em massa para seus leads." },
};

export function AppHeader() {
  const { pathname } = useLocation();
  const meta = titles[pathname] || { title: "LeadFlow", subtitle: "Plataforma SDR" };
  const { connections, ai, setConnection, user, logout } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    window.location.href = "/login";
  }

  // Poll Evolution status a cada 15s
  useEffect(() => {
    const check = async () => {
      try {
        const status = await api.getInstanceStatus("Gpressi");
        const state = status?.instance?.state || status?.state;
        if (state === "open") {
          setConnection("evolution", "connected" as any);
        } else if (state === "close" || state === "disconnected") {
          setConnection("evolution", "disconnected");
        }
      } catch {
        // silencioso
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-background/70 backdrop-blur-xl">
      <div className="flex items-center gap-3 md:gap-4 px-4 md:px-6 lg:px-10 py-3 md:py-4">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <button className="md:hidden h-10 w-10 shrink-0 grid place-items-center rounded-xl border border-border-subtle bg-surface/60 text-muted-foreground hover:text-foreground transition-colors">
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px] flex flex-col bg-sidebar/95 backdrop-blur-xl border-r-border-subtle">
            <SidebarContent onNavigate={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg md:text-xl lg:text-2xl font-semibold text-foreground truncate">
            {meta.title}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground truncate">{meta.subtitle}</p>
        </div>

        <div className="hidden lg:flex items-center gap-2">
          <StatusChip
            label="API Oficial"
            ok={connections.official !== "disconnected"}
            okLabel={connections.official === "pending" ? "Pendente" : "Conectado"}
          />
          <StatusChip
            label="Evolution"
            ok={connections.evolution !== "disconnected"}
            okLabel={connections.evolution === "pending" ? "Pendente" : "Conectado"}
          />
          <StatusChip label="IA SDR" ok={ai.built} okLabel="Ativa" />
        </div>

        <button className="h-10 w-10 grid place-items-center rounded-xl border border-border-subtle bg-surface/60 text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="h-4 w-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hidden md:flex items-center gap-3 rounded-xl border border-border-subtle bg-surface/60 pl-3 pr-2 py-1.5 hover:bg-surface/80 transition-colors">
              <div className="hidden sm:block text-right leading-tight">
                <p className="text-xs font-medium text-foreground truncate max-w-[100px]">{user?.name || "Usuário"}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end capitalize">
                  {user?.role === "admin" ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  {user?.role || "attendant"}
                </p>
              </div>
              <div className="h-8 w-8 rounded-lg bg-gradient-accent grid place-items-center text-xs font-semibold text-background uppercase">
                {user?.name ? user.name.slice(0, 2) : "US"}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function StatusChip({ label, ok, okLabel }: { label: string; ok: boolean; okLabel: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface/60 px-3 py-1.5 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-primary animate-pulse-glow" : "bg-muted-foreground/40"}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground/80 font-medium">{ok ? okLabel : "Não conectado"}</span>
    </div>
  );
}
