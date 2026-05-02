import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { api, SearchLeadsResponse, ApifyLeadSearch, LeadResult } from "@/lib/api";
import {
  MapPin, Search, Trash2, Sparkles, CheckCircle2, XCircle,
  Loader2, Info, History, ExternalLink, CheckCheck, Globe, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SearchState = "idle" | "loading" | "done" | "error";
const LIMITS = [10, 25, 50, 100];
function formatTime(s: number) { return s < 60 ? `${s.toFixed(0)}s` : `${(s / 60).toFixed(1)}min`; }

export default function CriarLista() {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [state, setState] = useState<SearchState>("idle");
  const [result, setResult] = useState<SearchLeadsResponse | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ApifyLeadSearch[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function handleSearch() {
    if (!query.trim()) { toast.error("Preencha o que você quer buscar"); return; }
    setState("loading"); setError(""); setResult(null);
    try {
      const res = await api.searchLeads({ query: query.trim(), limit });
      setResult(res); setState("done");
      if (res.totalImported > 0) {
        toast.success(`${res.totalImported} leads importados`, {
          description: `${res.totalDuplicates} duplicados · ${formatTime(res.duration)}`,
        });
      } else {
        toast.warning("Nenhum lead novo importado", {
          description: res.totalFound > 0 ? `${res.totalFound} encontrados, todos já no CRM` : "Tente outro termo",
        });
      }
    } catch (err: any) {
      setState("error"); setError(err.message || "Erro inesperado");
      toast.error("Busca falhou", { description: err.message });
    }
  }

  async function handleLoadHistory() {
    setLoadingHistory(true);
    try { setHistory(await api.getSearchHistory()); setShowHistory(true); }
    catch { toast.error("Não foi possível carregar o histórico"); }
    finally { setLoadingHistory(false); }
  }

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-lg">Criar Lista de Leads</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Busca empresas no Google Maps · Filtra por telefone · Extrai e-mail do site automaticamente.</p>
        </div>
        <Button variant="outline" size="sm" className="border-border-subtle text-xs gap-2"
          onClick={handleLoadHistory} disabled={loadingHistory}>
          {loadingHistory ? <Loader2 className="h-3 w-3 animate-spin" /> : <History className="h-3 w-3" />}
          Histórico
        </Button>
      </div>

      {/* Fonte fixa */}
      <div className="glass-card rounded-2xl p-4 flex items-center gap-4 border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary-glow grid place-items-center shrink-0">
          <MapPin className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Google Maps</p>
          <p className="text-xs text-muted-foreground">Empresas locais com telefone · E-mail extraído do site · Pronto para WhatsApp</p>
        </div>
        <StatusBadge variant="success" dot className="text-xs">Ativo</StatusBadge>
      </div>

      {/* Formulário */}
      <div className="glass-card rounded-2xl p-6 space-y-5">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-info/10 border border-info/20">
          <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
          <p className="text-xs text-info/90">
            Digite o segmento + cidade. Ex: <strong>"dentistas em Porto Alegre"</strong>, <strong>"clínicas estéticas SP"</strong>, <strong>"academias Curitiba"</strong>
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <Search className="h-3 w-3 text-muted-foreground" /> Segmento + cidade
          </Label>
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: clínicas estéticas em Porto Alegre"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="bg-surface border-border-subtle focus:border-primary/50" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Quantidade</Label>
          <div className="flex flex-wrap gap-2">
            {LIMITS.map((l) => (
              <button key={l} onClick={() => setLimit(l)}
                className={cn("px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                  limit === l
                    ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground border-transparent"
                    : "border-border-subtle bg-surface hover:border-primary/40")}>
                {l}{l === 10 ? <span className="ml-1 text-[10px] opacity-60">teste</span> : l === 100 ? <span className="ml-1 text-[10px] opacity-60">max</span> : ""}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            ⏱ {limit <= 10 ? "~1min" : limit <= 25 ? "1–2min" : limit <= 50 ? "2–4min" : "4–8min"} · Apenas leads com telefone são importados
          </p>
        </div>

        <Button onClick={handleSearch} disabled={state === "loading"} size="lg"
          className="w-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-semibold">
          {state === "loading"
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando e extraindo contatos...</>
            : <><Sparkles className="h-4 w-4 mr-2" />Buscar leads</>}
        </Button>
      </div>

      {/* Loading */}
      {state === "loading" && (
        <div className="glass-card rounded-2xl p-8 flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
            <div className="absolute inset-0 grid place-items-center">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="text-center">
            <p className="font-semibold">Buscando no Google Maps...</p>
            <p className="text-xs text-muted-foreground mt-1">Filtrando leads com telefone e extraindo e-mails. Não feche a página.</p>
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
                    {result.totalFound} com telefone · {result.totalImported} importados · {result.totalDuplicates} duplicados · {formatTime(result.duration)}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="border-border-subtle text-xs"
                onClick={() => { setState("idle"); setResult(null); }}>
                <Trash2 className="h-3 w-3 mr-1.5" /> Nova busca
              </Button>
            </div>
            <div className="p-5 grid grid-cols-4 gap-4 text-center">
              {[
                { label: "Com telefone", value: result.totalFound, color: "text-info" },
                { label: "Importados", value: result.totalImported, color: "text-success" },
                { label: "Duplicados", value: result.totalDuplicates, color: "text-warning" },
                { label: "Tempo", value: formatTime(result.duration), color: "text-primary" },
              ].map((s) => (
                <div key={s.label}>
                  <p className={cn("text-2xl font-display font-bold", s.color)}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {result.results?.length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-border-subtle">
                <p className="font-semibold text-sm">Leads ({result.results.length})</p>
                <p className="text-xs text-muted-foreground">📱 = possível WhatsApp · Verde = importado · Amarelo = já existia no CRM</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <Th>Nome</Th>
                      <Th>Telefone</Th>
                      <Th>WhatsApp</Th>
                      <Th>E-mail</Th>
                      <Th>Site</Th>
                      <Th>Localização</Th>
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
                          <p className="font-medium text-xs">{lead.name || "—"}</p>
                          {lead.category && <p className="text-[10px] text-muted-foreground">{lead.category}</p>}
                          {lead.score != null && <p className="text-[10px] text-warning">⭐ {lead.score?.toFixed(1)}</p>}
                        </Td>
                        <Td className="font-mono text-xs">{lead.phone || "—"}</Td>
                        <Td className="text-center">
                          {lead.has_whatsapp
                            ? <span title={lead.phone_normalized} className="text-lg">📱</span>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </Td>
                        <Td className="text-xs">
                          {lead.email
                            ? <a href={`mailto:${lead.email}`} className="text-primary hover:underline flex items-center gap-1">
                                <Mail className="h-3 w-3" />{lead.email}
                              </a>
                            : <span className="text-muted-foreground">—</span>}
                        </Td>
                        <Td>
                          {lead.website
                            ? <a href={lead.website} target="_blank" rel="noreferrer"
                                className="text-info text-xs hover:underline flex items-center gap-1 max-w-[110px]">
                                <Globe className="h-3 w-3 shrink-0" />
                                <span className="truncate">{lead.website.replace(/https?:\/\//, '')}</span>
                              </a>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </Td>
                        <Td className="text-xs text-muted-foreground">
                          {[lead.city, lead.state].filter(Boolean).join(", ") || "—"}
                        </Td>
                        <Td>
                          {lead.imported
                            ? <StatusBadge variant="success" dot className="text-[10px]">
                                <CheckCheck className="h-3 w-3 mr-1" />Importado
                              </StatusBadge>
                            : lead.duplicate
                              ? <StatusBadge variant="warning" dot className="text-[10px]">Duplicado</StatusBadge>
                              : <StatusBadge variant="info" dot className="text-[10px]">Ignorado</StatusBadge>}
                        </Td>
                        <Td>
                          {lead.profileUrl
                            ? <a href={lead.profileUrl} target="_blank" rel="noreferrer"
                                className="text-info text-xs hover:underline flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" /> Maps
                              </a>
                            : "—"}
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
              <p className="font-semibold text-sm">Histórico</p>
            </div>
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowHistory(false)}>Fechar</button>
          </div>
          {history.length === 0
            ? <div className="p-8 text-center text-xs text-muted-foreground">Nenhuma busca ainda.</div>
            : <div className="divide-y divide-border-subtle">
                {history.map((h) => (
                  <div key={h.id} className="px-5 py-3 flex items-center gap-4 hover:bg-surface/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">"{h.query}"</p>
                      <p className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString("pt-BR")}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs shrink-0">
                      <span className="text-info">{h.totalFound} encontrados</span>
                      <span className="text-success">{h.totalImported} importados</span>
                      <StatusBadge variant={h.status === "completed" ? "success" : h.status === "failed" ? "destructive" : "warning"} dot>
                        {h.status === "completed" ? "OK" : h.status === "failed" ? "Erro" : "Processando"}
                      </StatusBadge>
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left whitespace-nowrap">{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-top", className)}>{children}</td>;
}
