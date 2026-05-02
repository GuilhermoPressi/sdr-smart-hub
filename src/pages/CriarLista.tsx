import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { api, SearchLeadsResponse, ApifyLeadSearch, LeadResult } from "@/lib/api";
import {
  Linkedin, MapPin, Search, Trash2, Sparkles, Globe, Instagram,
  CheckCircle2, XCircle, Loader2, ChevronRight, Info, History,
  ExternalLink, CheckCheck, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Source = "google" | "linkedin" | "instagram" | "website";
type SearchState = "idle" | "loading" | "done" | "error";

const SOURCES: {
  id: Source; label: string; icon: any; description: string; hint: string;
  badge: string; badgeVariant: "success" | "warning" | "info";
}[] = [
  {
    id: "google", label: "Google Maps", icon: MapPin,
    description: "Empresas locais por segmento e cidade.",
    hint: 'Ex: "dentistas em Porto Alegre" ou "clínicas estéticas SP"',
    badge: "Recomendado", badgeVariant: "success",
  },
  {
    id: "linkedin", label: "LinkedIn", icon: Linkedin,
    description: "Perfis profissionais por URL.",
    hint: "Cole URLs de perfis LinkedIn separadas por vírgula",
    badge: "URL obrigatória", badgeVariant: "warning",
  },
  {
    id: "instagram", label: "Instagram", icon: Instagram,
    description: "Perfis e comentadores por hashtag ou URL.",
    hint: 'Ex: hashtag "clinicaestetica" ou URL de post',
    badge: "Disponível", badgeVariant: "info",
  },
  {
    id: "website", label: "Web Crawler", icon: Globe,
    description: "Extrai contatos de sites via busca.",
    hint: 'Ex: "clínicas estéticas Porto Alegre"',
    badge: "Avançado", badgeVariant: "warning",
  },
];

const LIMITS = [10, 25, 50, 100];

function formatTime(s: number) {
  return s < 60 ? `${s.toFixed(0)}s` : `${(s / 60).toFixed(1)}min`;
}

export default function CriarLista() {
  const [source, setSource] = useState<Source>("google");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [state, setState] = useState<SearchState>("idle");
  const [result, setResult] = useState<SearchLeadsResponse | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ApifyLeadSearch[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const currentSource = SOURCES.find((s) => s.id === source)!;

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
        toast.success(`${res.totalImported} leads importados para o CRM`, {
          description: `${res.totalDuplicates} duplicados ignorados · ${formatTime(res.duration)}`,
        });
      } else {
        toast.warning("Nenhum lead novo importado", {
          description: res.totalFound > 0
            ? `${res.totalFound} encontrados, todos já existem no CRM`
            : "Tente outro termo de busca",
        });
      }
    } catch (err: any) {
      setState("error");
      setError(err.message || "Erro inesperado");
      toast.error("Busca falhou", { description: err.message });
    }
  }

  async function handleLoadHistory() {
    setLoadingHistory(true);
    try {
      setHistory(await api.getSearchHistory());
      setShowHistory(true);
    } catch {
      toast.error("Não foi possível carregar o histórico");
    } finally {
      setLoadingHistory(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-lg">Criar Lista de Leads</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Encontre leads qualificados via Apify.</p>
        </div>
        <Button variant="outline" size="sm" className="border-border-subtle text-xs gap-2"
          onClick={handleLoadHistory} disabled={loadingHistory}>
          {loadingHistory ? <Loader2 className="h-3 w-3 animate-spin" /> : <History className="h-3 w-3" />}
          Histórico
        </Button>
      </div>

      {/* Step 1 */}
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">1. Fonte de busca</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SOURCES.map((s) => (
            <button key={s.id}
              onClick={() => { setSource(s.id); setQuery(""); setState("idle"); setResult(null); }}
              className={cn(
                "text-left rounded-2xl border p-4 transition-all space-y-2",
                source === s.id
                  ? "border-primary/50 bg-gradient-to-br from-primary/10 to-accent/5 shadow-[var(--shadow-glow)]"
                  : "border-border-subtle bg-surface hover:border-primary/30",
              )}>
              <div className={cn("h-9 w-9 rounded-xl grid place-items-center",
                source === s.id ? "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground" : "bg-surface-elevated")}>
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

      {/* Step 2 */}
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">2. Configure sua busca</p>
        <div className="glass-card rounded-2xl p-6 space-y-5">

          <div className="flex items-start gap-3 p-3 rounded-xl bg-info/10 border border-info/20">
            <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
            <p className="text-xs text-info/90">{currentSource.description} <span className="opacity-70">{currentSource.hint}</span></p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Search className="h-3 w-3 text-muted-foreground" />
              {source === "linkedin" ? "URLs dos perfis LinkedIn" : "O que você quer buscar?"}
            </Label>
            {source === "linkedin" ? (
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="https://linkedin.com/in/perfil1, https://linkedin.com/in/perfil2"
                rows={3}
                className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary/50"
              />
            ) : (
              <Input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder={currentSource.hint}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="bg-surface border-border-subtle focus:border-primary/50" />
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quantidade de leads</Label>
            <div className="flex flex-wrap gap-2">
              {LIMITS.map((l) => (
                <button key={l} onClick={() => setLimit(l)}
                  className={cn("px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                    limit === l
                      ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground border-transparent shadow-[var(--shadow-glow)]"
                      : "border-border-subtle bg-surface hover:border-primary/40")}>
                  {l} leads
                  {l === 10 && <span className="ml-1.5 text-[10px] opacity-60">teste</span>}
                  {l === 100 && <span className="ml-1.5 text-[10px] opacity-60">max</span>}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              ⏱ Estimado: {limit <= 10 ? "30s–1min" : limit <= 25 ? "1–2 min" : limit <= 50 ? "2–4 min" : "4–8 min"}
            </p>
          </div>

          <Button onClick={handleSearch} disabled={state === "loading"} size="lg"
            className="w-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-[var(--shadow-glow)] font-semibold">
            {state === "loading"
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando leads... aguarde</>
              : <><Sparkles className="h-4 w-4 mr-2" />Buscar leads</>}
          </Button>
        </div>
      </div>

      {/* Loading */}
      {state === "loading" && (
        <div className="glass-card rounded-2xl p-8 flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
            <div className="absolute inset-0 grid place-items-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="text-center">
            <p className="font-semibold">Buscando no {currentSource.label}...</p>
            <p className="text-xs text-muted-foreground mt-1">O actor Apify está rodando. Não feche a página.</p>
          </div>
        </div>
      )}

      {/* Resultado */}
      {state === "done" && result && (
        <div className="space-y-4 animate-fade-in">
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-success/15 grid place-items-center">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-display font-semibold">Busca concluída</p>
                  <p className="text-xs text-muted-foreground">
                    {result.totalFound} encontrados · {result.totalImported} importados · {result.totalDuplicates} duplicados · {formatTime(result.duration)}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="border-border-subtle text-xs"
                onClick={() => { setState("idle"); setResult(null); }}>
                <Trash2 className="h-3 w-3 mr-1.5" /> Nova busca
              </Button>
            </div>
            <div className="p-5 grid grid-cols-4 gap-4">
              <Stat label="Encontrados" value={result.totalFound} color="text-info" />
              <Stat label="Importados" value={result.totalImported} color="text-success" />
              <Stat label="Duplicados" value={result.totalDuplicates} color="text-warning" />
              <Stat label="Tempo" value={formatTime(result.duration)} color="text-primary" />
            </div>
          </div>

          {/* Tabela de leads */}
          {result.results?.length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-border-subtle">
                <p className="font-semibold text-sm">Leads encontrados ({result.results.length})</p>
                <p className="text-xs text-muted-foreground">Verde = importado · Amarelo = já existia no CRM</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <Th>Nome / Empresa</Th>
                      <Th>Telefone</Th>
                      <Th>E-mail</Th>
                      <Th>Cargo</Th>
                      <Th>Site</Th>
                      <Th>Endereço</Th>
                      <Th>Status</Th>
                      <Th>Link</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((lead, i) => (
                      <tr key={i} className={cn(
                        "border-t border-border-subtle transition-colors",
                        lead.imported ? "hover:bg-success/5" : lead.duplicate ? "hover:bg-warning/5 opacity-60" : "hover:bg-surface/40",
                      )}>
                        <Td>
                          <div>
                            <p className="font-medium text-xs">{lead.name || lead.companyName || lead.username || "—"}</p>
                            {lead.category && <p className="text-[10px] text-muted-foreground">{lead.category}</p>}
                            {lead.score != null && <p className="text-[10px] text-warning">⭐ {lead.score?.toFixed(1)} ({lead.reviewsCount} avaliações)</p>}
                          </div>
                        </Td>
                        <Td className="font-mono text-xs">{lead.phone || "—"}</Td>
                        <Td className="text-xs">{lead.email || "—"}</Td>
                        <Td className="text-xs text-muted-foreground">{lead.jobTitle || "—"}</Td>
                        <Td>
                          {lead.website ? (
                            <a href={lead.website} target="_blank" rel="noreferrer"
                              className="text-primary text-xs hover:underline truncate max-w-[100px] block">
                              {lead.website.replace(/https?:\/\//, '')}
                            </a>
                          ) : "—"}
                        </Td>
                        <Td className="text-xs text-muted-foreground max-w-[140px]">
                          <span className="truncate block">{[lead.address, lead.city, lead.state].filter(Boolean).join(", ") || "—"}</span>
                        </Td>
                        <Td>
                          {lead.imported
                            ? <StatusBadge variant="success" dot className="text-[10px]"><CheckCheck className="h-3 w-3 mr-1" />Importado</StatusBadge>
                            : lead.duplicate
                              ? <StatusBadge variant="warning" dot className="text-[10px]">Duplicado</StatusBadge>
                              : <StatusBadge variant="info" dot className="text-[10px]">Ignorado</StatusBadge>}
                        </Td>
                        <Td>
                          {(lead.profileUrl || lead.sourceUrl) ? (
                            <a href={lead.profileUrl || lead.sourceUrl} target="_blank" rel="noreferrer"
                              className="text-info text-xs hover:underline flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> Ver
                            </a>
                          ) : "—"}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Erro */}
      {state === "error" && (
        <div className="glass-card rounded-2xl p-5 flex items-start gap-3 border border-destructive/30 animate-fade-in">
          <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Busca falhou</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
          <Button variant="outline" size="sm" className="border-border-subtle text-xs shrink-0"
            onClick={() => setState("idle")}>Tentar novamente</Button>
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
            <div className="p-8 text-center text-xs text-muted-foreground">Nenhuma busca ainda.</div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {history.map((h) => (
                <div key={h.id} className="px-5 py-3 flex items-center gap-4 hover:bg-surface/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">"{h.query}"</p>
                    <p className="text-xs text-muted-foreground">{h.source} · {new Date(h.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <span className="text-info">{h.totalFound} encontrados</span>
                    <span className="text-success">{h.totalImported} importados</span>
                    <StatusBadge
                      variant={h.status === "completed" ? "success" : h.status === "failed" ? "destructive" : "warning"} dot>
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left whitespace-nowrap">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-top", className)}>{children}</td>;
}
