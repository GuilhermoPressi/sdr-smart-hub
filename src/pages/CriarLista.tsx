import { useState } from "react";
import { useApp, Lead } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { api, SearchLeadsResponse, ApifyLeadSearch } from "@/lib/api";
import {
  Linkedin, MapPin, Search, Trash2, UserPlus, Sparkles,
  Building2, Globe, Instagram, Clock, CheckCircle2,
  XCircle, Loader2, ChevronRight, Info, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Source = "google" | "linkedin" | "instagram" | "website";
type SearchState = "idle" | "loading" | "done" | "error";

const SOURCES: { id: Source; label: string; icon: any; description: string; badge: string; badgeVariant: "success" | "warning" | "info" }[] = [
  { id: "google", label: "Google Maps", icon: MapPin, description: "Empresas locais por região e segmento. Melhor para negócios físicos.", badge: "Recomendado", badgeVariant: "success" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, description: "Perfis profissionais por cargo, empresa e localização.", badge: "Disponível", badgeVariant: "info" },
  { id: "instagram", label: "Instagram", icon: Instagram, description: "Perfis públicos por hashtag ou segmento.", badge: "Disponível", badgeVariant: "info" },
  { id: "website", label: "Web Crawler", icon: Globe, description: "Extrai contatos de sites a partir de uma busca.", badge: "Avançado", badgeVariant: "warning" },
];

const LIMITS = [10, 25, 50, 100];

const SOURCE_EXAMPLES: Record<Source, { query: string; placeholder: string }> = {
  google: { query: "clínicas estéticas em Porto Alegre", placeholder: "Ex: dentistas em São Paulo, academias no Rio" },
  linkedin: { query: "CEO odontologia Porto Alegre", placeholder: "Ex: diretor comercial saúde São Paulo" },
  instagram: { query: "clínica_estetica", placeholder: "Ex: odontologia, esteticista, clinica_sp" },
  website: { query: "clínicas estéticas Porto Alegre RS", placeholder: "Ex: consultórios dentários Florianópolis" },
};

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  return `${(seconds / 60).toFixed(1)}min`;
}

export default function CriarLista() {
  const { addLeads } = useApp();
  const [source, setSource] = useState<Source>("google");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(25);
  const [state, setState] = useState<SearchState>("idle");
  const [result, setResult] = useState<SearchLeadsResponse | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ApifyLeadSearch[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const example = SOURCE_EXAMPLES[source];

  async function handleSearch() {
    if (!query.trim()) {
      toast.error("Preencha o que você quer buscar");
      return;
    }

    setState("loading");
    setError("");
    setResult(null);

    try {
      const res = await api.searchLeads({ source, query: query.trim(), limit });
      setResult(res);
      setState("done");

      if (res.totalImported > 0) {
        toast.success(`${res.totalImported} leads importados`, {
          description: `${res.duplicatesIgnored} duplicados ignorados · ${formatTime(res.executionTimeSeconds)}`,
        });
        // Adiciona leads fictícios ao store local para refletir na UI
        const fakeLeads: Lead[] = Array.from({ length: res.totalImported }, (_, i) => ({
          id: `apify-${res.searchId}-${i}`,
          name: `Lead importado ${i + 1}`,
          company: "",
          role: "",
          phone: "",
          email: "",
          origin: source,
          tags: [`apify-${source}`],
          crm: "Pipeline Comercial",
          stage: "novo",
          status: "Novo",
          iaStatus: "Aguardando",
          temperature: "Morno",
          lastInteraction: "Agora",
        }));
        addLeads(fakeLeads);
      } else {
        toast.warning("Nenhum lead novo encontrado", {
          description: res.totalFound > 0 ? `${res.totalFound} encontrados, todos já existem no CRM` : "Tente um termo de busca diferente",
        });
      }
    } catch (err: any) {
      setState("error");
      setError(err.message || "Erro inesperado. Tente novamente.");
      toast.error("Busca falhou", { description: err.message });
    }
  }

  async function handleLoadHistory() {
    setLoadingHistory(true);
    try {
      const h = await api.getSearchHistory();
      setHistory(h);
      setShowHistory(true);
    } catch {
      toast.error("Não foi possível carregar o histórico");
    } finally {
      setLoadingHistory(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-lg">Criar Lista de Leads</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Encontre leads qualificados em minutos via Apify.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-border-subtle text-xs gap-2"
          onClick={handleLoadHistory}
          disabled={loadingHistory}
        >
          {loadingHistory ? <Loader2 className="h-3 w-3 animate-spin" /> : <History className="h-3 w-3" />}
          Histórico
        </Button>
      </div>

      {/* Step 1 — Fonte */}
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">1. Escolha a fonte de busca</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSource(s.id); setQuery(""); setState("idle"); setResult(null); }}
              className={cn(
                "text-left rounded-2xl border p-4 transition-all duration-300 space-y-2",
                source === s.id
                  ? "border-primary/50 bg-gradient-to-br from-primary/10 to-accent/5 shadow-[var(--shadow-glow)]"
                  : "border-border-subtle bg-surface hover:border-primary/30 hover:bg-surface-elevated",
              )}
            >
              <div className={cn("h-9 w-9 rounded-xl grid place-items-center", source === s.id ? "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground" : "bg-surface-elevated text-foreground")}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">{s.label}</p>
                <StatusBadge variant={s.badgeVariant} dot className="mt-1 text-[10px]">{s.badge}</StatusBadge>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 — Filtros */}
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">2. Configure sua busca</p>
        <div className="glass-card rounded-2xl p-6 space-y-5">

          <div className="flex items-start gap-3 p-3 rounded-xl bg-info/10 border border-info/20">
            <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
            <p className="text-xs text-info/90 leading-relaxed">
              {source === "google" && "Busca empresas no Google Maps. Ideal para encontrar negócios locais com telefone e endereço. Use nomes de segmento + cidade."}
              {source === "linkedin" && "Busca perfis profissionais no LinkedIn. Use cargo + segmento + cidade para melhores resultados."}
              {source === "instagram" && "Busca perfis públicos por hashtag. Digite o segmento sem espaços (ex: clinica_estetica)."}
              {source === "website" && "Crawler que extrai e-mails e telefones de sites encontrados via busca. Mais lento, mas abrangente."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Search className="h-3 w-3 text-muted-foreground" />
              O que você quer buscar?
            </Label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={example.placeholder}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="bg-surface border-border-subtle focus:border-primary/50"
            />
            {query === "" && (
              <button
                className="text-xs text-primary/70 hover:text-primary flex items-center gap-1 mt-1 transition-colors"
                onClick={() => setQuery(example.query)}
              >
                <ChevronRight className="h-3 w-3" /> Usar exemplo: "{example.query}"
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quantidade de leads</Label>
            <div className="flex flex-wrap gap-2">
              {LIMITS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLimit(l)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                    limit === l
                      ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground border-transparent shadow-[var(--shadow-glow)]"
                      : "border-border-subtle bg-surface text-foreground hover:border-primary/40",
                  )}
                >
                  {l} leads
                  {l === 25 && <span className="ml-1.5 text-[10px] opacity-60">rápido</span>}
                  {l === 100 && <span className="ml-1.5 text-[10px] opacity-60">max</span>}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              ⏱ Tempo estimado: {limit <= 25 ? "1–2 min" : limit <= 50 ? "2–4 min" : "4–8 min"}
            </p>
          </div>

          <Button
            onClick={handleSearch}
            disabled={state === "loading"}
            size="lg"
            className="w-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-[var(--shadow-glow)] font-semibold"
          >
            {state === "loading" ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Buscando leads... (pode levar alguns minutos)</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Buscar leads</>
            )}
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {state === "loading" && (
        <div className="glass-card rounded-2xl p-6 flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
            <div className="absolute inset-0 grid place-items-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="text-center">
            <p className="font-semibold">Buscando no {SOURCES.find(s => s.id === source)?.label}...</p>
            <p className="text-xs text-muted-foreground mt-1">O actor Apify está rodando. Aguarde sem fechar a página.</p>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>Query: <strong className="text-foreground">"{query}"</strong></span>
            <span>·</span>
            <span>Limite: <strong className="text-foreground">{limit}</strong></span>
          </div>
        </div>
      )}

      {/* Resultado */}
      {state === "done" && result && (
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-success/15 grid place-items-center">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-display font-semibold">Busca concluída</p>
                <p className="text-xs text-muted-foreground">
                  {result.totalFound} encontrados · {result.totalImported} importados · {result.duplicatesIgnored} duplicados ignorados · {formatTime(result.executionTimeSeconds)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-border-subtle text-xs"
                onClick={() => { setState("idle"); setResult(null); }}
              >
                <Trash2 className="h-3 w-3 mr-1.5" /> Nova busca
              </Button>
              {result.totalImported > 0 && (
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-xs"
                  onClick={() => {
                    toast.success(`${result.totalImported} leads já foram adicionados ao CRM`);
                  }}
                >
                  <UserPlus className="h-3 w-3 mr-1.5" /> Ver no CRM
                </Button>
              )}
            </div>
          </div>

          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Encontrados" value={result.totalFound} color="text-info" />
            <Stat label="Importados" value={result.totalImported} color="text-success" />
            <Stat label="Duplicados" value={result.duplicatesIgnored} color="text-warning" />
            <Stat label="Tempo" value={formatTime(result.executionTimeSeconds)} color="text-primary" />
          </div>
        </div>
      )}

      {/* Erro */}
      {state === "error" && (
        <div className="glass-card rounded-2xl p-5 flex items-start gap-3 border border-destructive/30 animate-fade-in">
          <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Busca falhou</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            {error.includes("APIFY_API_TOKEN") && (
              <p className="text-xs text-warning mt-2">
                ⚠️ Configure o <code className="bg-surface px-1 rounded">APIFY_API_TOKEN</code> nas variáveis de ambiente do serviço <strong>sdr-backend</strong> no EasyPanel.
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" className="border-border-subtle text-xs shrink-0" onClick={() => setState("idle")}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Histórico */}
      {showHistory && (
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
          <div className="p-4 flex items-center justify-between border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <p className="font-semibold text-sm">Histórico de buscas</p>
            </div>
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowHistory(false)}>Fechar</button>
          </div>
          {history.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Nenhuma busca realizada ainda.</div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {history.map((h) => (
                <div key={h.id} className="px-5 py-3 flex items-center gap-4 hover:bg-surface/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">"{h.query}"</p>
                    <p className="text-xs text-muted-foreground">{h.source} · {new Date(h.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-right shrink-0">
                    <span className="text-info">{h.totalFound} encontrados</span>
                    <span className="text-success">{h.totalImported} importados</span>
                    <StatusBadge
                      variant={h.status === "completed" ? "success" : h.status === "failed" ? "destructive" : "warning"}
                      dot
                    >
                      {h.status === "completed" ? "Concluído" : h.status === "failed" ? "Falhou" : "Em andamento"}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="text-center">
      <p className={cn("text-2xl font-display font-bold", color)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
