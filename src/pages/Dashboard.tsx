import { useState, useEffect } from "react";
import { Users, Filter, ArrowRightLeft, Bot, Target, TrendingUp, Inbox, Calendar, Zap, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

export default function Dashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      const data = await api.getDashboardMetrics();
      console.log("[Dashboard] Metrics loaded:", data);
      setMetrics(data);
    } catch (e) {
      console.error("Erro ao buscar métricas do dashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // 30s polling
    
    const handleFocus = () => fetchMetrics();
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Skeleton UI
  if (loading && !metrics) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-pulse pb-10">
        <div>
          <div className="h-8 w-48 bg-border-subtle rounded mb-2"></div>
          <div className="h-4 w-96 bg-border-subtle rounded"></div>
        </div>
        
        {/* Skeleton Top Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-surface/30 border border-border-subtle rounded-2xl flex flex-col p-4 justify-between">
              <div className="h-3 w-20 bg-border-subtle rounded"></div>
              <div className="h-8 w-12 bg-border-subtle rounded"></div>
            </div>
          ))}
        </div>

        {/* Skeleton Rate Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-surface/30 border border-border-subtle rounded-2xl flex items-center p-4 gap-4">
              <div className="h-10 w-10 rounded-full bg-border-subtle"></div>
              <div className="space-y-2">
                <div className="h-2 w-24 bg-border-subtle rounded"></div>
                <div className="h-4 w-12 bg-border-subtle rounded"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Skeleton Funnel */}
        <div className="h-[500px] bg-surface/30 border border-border-subtle rounded-2xl p-8 flex flex-col items-center space-y-4">
          <div className="h-6 w-48 bg-border-subtle rounded self-start mb-8"></div>
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-12 bg-border-subtle/50 rounded-md" style={{ width: (100 - i * 10) + '%' }}></div>
          ))}
        </div>
      </div>
    );
  }

  // Funnel setup
  const funnelStages = [
    { id: "abordagem", label: "Leads na Base", value: metrics?.totalContacts || 0, color: "from-blue-600/80 to-blue-600" },
    { id: "responderam", label: "Conversas Ativas", value: metrics?.totalConversations || 0, color: "from-purple-600/80 to-purple-600" },
    { id: "atend_ia", label: "Atend. IA", value: metrics?.totalAiActive || 0, color: "from-amber-500/80 to-amber-500" },
    { id: "qualificados", label: "Qualificados", value: metrics?.totalQualified || 0, color: "from-emerald-500/80 to-emerald-500" },
    { id: "atend_humano", label: "Atend. Humano", value: metrics?.totalHuman || 0, color: "from-pink-500/80 to-pink-500" },
    { id: "ganhos", label: "Ganhos / Convertidos", value: metrics?.totalConverted || 0, color: "from-green-600/80 to-green-600" },
    { id: "perdidos", label: "Perdidos", value: metrics?.totalLost || 0, color: "from-red-500/80 to-red-500" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      <div>
        <h2 className="font-display text-2xl font-semibold">Painel de Operações</h2>
        <p className="text-sm text-muted-foreground mt-1">Visão em tempo real das métricas da sua operação comercial.</p>
      </div>

      {/* TOP CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glass-card rounded-2xl p-4 border-border-subtle flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Users className="h-10 w-10 text-primary" /></div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Total de Leads</h3>
          <p className="font-display text-3xl font-bold">{metrics?.totalContacts}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border-border-subtle flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Zap className="h-10 w-10 text-primary" /></div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Leads Hoje</h3>
          <p className="font-display text-3xl font-bold">{metrics?.leadsToday}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border-border-subtle flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Calendar className="h-10 w-10 text-primary" /></div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Leads (7 dias)</h3>
          <p className="font-display text-3xl font-bold">{metrics?.leadsLast7Days}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border-border-subtle flex flex-col justify-between relative overflow-hidden bg-primary/5 border-primary/20">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Bot className="h-10 w-10 text-primary" /></div>
          <h3 className="text-xs font-medium text-primary uppercase tracking-wider mb-2">Ativos com IA</h3>
          <p className="font-display text-3xl font-bold text-primary">{metrics?.totalAiActive}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border-border-subtle flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Users className="h-10 w-10 text-primary" /></div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Atend. Humano</h3>
          <p className="font-display text-3xl font-bold">{metrics?.totalHuman}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border-border-subtle flex flex-col justify-between relative overflow-hidden bg-success/5 border-success/20">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Target className="h-10 w-10 text-success" /></div>
          <h3 className="text-xs font-medium text-success uppercase tracking-wider mb-2">Qualificados</h3>
          <p className="font-display text-3xl font-bold text-success">{metrics?.totalQualified}</p>
        </div>
      </div>

      {/* RATES CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-5 border-border-subtle flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-blue-500/10 grid place-items-center">
            <Inbox className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Taxa de Resposta</p>
            <div className="flex items-end gap-2">
              <span className="font-display text-2xl font-bold">{metrics?.responseRate}%</span>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5 border-border-subtle flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 grid place-items-center">
            <Target className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Qualificação</p>
            <div className="flex items-end gap-2">
              <span className="font-display text-2xl font-bold">{metrics?.qualificationRate}%</span>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5 border-border-subtle flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-green-500/10 grid place-items-center">
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Conversão</p>
            <div className="flex items-end gap-2">
              <span className="font-display text-2xl font-bold">{metrics?.conversionRate}%</span>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5 border-border-subtle flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-orange-500/10 grid place-items-center">
            <ArrowRightLeft className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Handoffs (IA → Humano)</p>
            <div className="flex items-end gap-2">
              <span className="font-display text-2xl font-bold">{metrics?.aiHandoffs}</span>
            </div>
          </div>
        </div>
      </div>

      {/* FUNNEL CARD */}
      <div className="glass-card rounded-2xl p-6 md:p-8 border-border-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-8 justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <h3 className="font-display font-semibold text-lg">Funil de Vendas</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-surface py-1.5 px-3 rounded-full border border-border-subtle">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            Atualizando ao vivo
          </div>
        </div>
        
        <div className="flex flex-col items-center max-w-3xl mx-auto space-y-2">
          {funnelStages.map((fs, idx) => {
            const width = 100 - (idx * 11); 
            return (
              <div 
                key={fs.id} 
                className={`h-12 md:h-14 bg-gradient-to-r ${fs.color} flex items-center justify-between px-4 sm:px-6 rounded-md text-white shadow-md transition-all duration-1000`}
                style={{ width: width + '%' }}
              >
                <span className="font-medium text-xs sm:text-sm truncate mr-2">{fs.label}</span>
                <span className="font-bold text-lg">{fs.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
