import { useApp, STAGES } from "@/store/app";
import { Users, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { leads } = useApp();

  const totalLeads = leads.length;

  // Conta leads por etapa
  const leadsPerStage = STAGES.reduce((acc, stage) => {
    acc[stage.id] = leads.filter(l => l.stage === stage.id).length;
    return acc;
  }, {} as Record<string, number>);

  // Funil básico (Etapas principais)
  const funnelStages = [
    { id: "envio", label: "Abordagem" },
    { id: "respondeu", label: "Responderam" },
    { id: "atendimento_ia", label: "Atend. IA" },
    { id: "qualificado", label: "Qualificados" },
    { id: "orcamento", label: "Orçamentos" },
    { id: "ganho", label: "Fechados" },
  ];

  const maxFunnelValue = Math.max(...funnelStages.map(s => leadsPerStage[s.id] || 0), 1);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Visão geral simples dos seus contatos e funil de vendas.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Contacts Card */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-center items-center text-center border-border-subtle">
          <div className="h-12 w-12 rounded-full bg-primary/10 grid place-items-center mb-4">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Total de Contatos</h3>
          <p className="font-display text-5xl font-bold">{totalLeads}</p>
        </div>

        {/* Funnel Card */}
        <div className="glass-card rounded-2xl p-6 border-border-subtle lg:col-span-2">
          <div className="flex items-center gap-2 mb-8">
            <Filter className="h-5 w-5 text-primary" />
            <h3 className="font-display font-semibold text-lg">Funil de Vendas</h3>
          </div>
          <div className="flex flex-col items-center max-w-2xl mx-auto space-y-1.5">
            {funnelStages.map((fs, idx) => {
              const count = leadsPerStage[fs.id] || 0;
              // Diminui a largura gradativamente (100% -> 85% -> 70%...) para formar o funil real
              const width = 100 - (idx * 14); 
              return (
                <div 
                  key={fs.id} 
                  className="h-12 bg-gradient-to-r from-primary/80 to-primary flex items-center justify-between px-4 sm:px-6 rounded-md text-primary-foreground shadow-glow transition-all duration-1000"
                  style={{ width: `${width}%` }}
                >
                  <span className="font-medium text-xs sm:text-sm truncate mr-2">{fs.label}</span>
                  <span className="font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
