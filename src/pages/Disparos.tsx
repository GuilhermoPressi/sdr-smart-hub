import { useState, useEffect } from "react";
import { Send, Plus, Eye, Pause, Play, Upload, Users, Tag, ListPlus, Loader2, CheckCircle2, XCircle, Clock, ArrowLeft, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Campaign { id: string; name: string; status: string; message: string; total: number; sent: number; failed: number; createdAt: string; delaySeconds: number; limitPerMinute: number; simulateHuman: boolean; instanceName: string; sourceType: string; }
interface Recipient { id: string; phone: string; name: string; status: string; error?: string; sentAt?: string; }

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendente", color: "text-muted-foreground", icon: Clock },
  sending: { label: "Enviando", color: "text-primary", icon: Loader2 },
  paused: { label: "Pausado", color: "text-warning", icon: Pause },
  completed: { label: "Concluído", color: "text-success", icon: CheckCircle2 },
  failed: { label: "Falhou", color: "text-destructive", icon: XCircle },
};

export default function Disparos() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [step, setStep] = useState(1);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  // Form state
  const [sourceType, setSourceType] = useState<"crm" | "tag" | "csv">("crm");
  const [selectedTag, setSelectedTag] = useState("");
  const [csvText, setCsvText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(8);
  const [limitPerMinute, setLimitPerMinute] = useState(15);
  const [simulateHuman, setSimulateHuman] = useState(true);

  useEffect(() => { loadCampaigns(); }, []);

  async function loadCampaigns() {
    try { const data = await api.getCampaigns(); setCampaigns(data || []); } catch {}
  }

  async function loadContacts() {
    try { const data = await api.getContacts(); setContacts(data || []); } catch {}
  }

  function startCreate() {
    setStep(1); setSourceType("crm"); setSelectedIds(new Set()); setSelectedTag(""); setCsvText("");
    setName(""); setMessage(""); setDelaySeconds(8); setLimitPerMinute(15); setSimulateHuman(true);
    loadContacts(); setView("create");
  }

  function getSelectedRecipients() {
    if (sourceType === "csv") {
      return csvText.split("\n").map(l => l.trim()).filter(Boolean).map(line => {
        const [phone, name, company, city] = line.split(/[;,\t]/);
        return { phone: (phone || "").replace(/\D/g, ""), name: name?.trim(), company: company?.trim(), city: city?.trim() };
      }).filter(r => r.phone.length >= 10);
    }
    if (sourceType === "tag") {
      return contacts.filter(c => c.tags?.includes(selectedTag) && c.phone).map(c => ({ phone: c.phone, name: c.name, company: c.companyName, city: c.city, segment: c.category }));
    }
    return contacts.filter(c => selectedIds.has(c.id) && c.phone).map(c => ({ phone: c.phone, name: c.name, company: c.companyName, city: c.city, segment: c.category }));
  }

  async function handleCreate() {
    const recs = getSelectedRecipients();
    if (!message.trim()) { toast.error("Escreva uma mensagem."); return; }
    if (recs.length === 0) { toast.error("Nenhum destinatário selecionado."); return; }
    setCreating(true);
    try {
      const campaign = await api.createCampaign({ name: name || undefined, message, sourceType, delaySeconds, limitPerMinute, simulateHuman, recipients: recs });
      await api.startCampaign(campaign.id);
      toast.success(`Disparo iniciado para ${recs.length} contatos!`);
      await loadCampaigns(); setView("list");
    } catch (err: any) { toast.error(err.message || "Erro ao criar disparo"); }
    finally { setCreating(false); }
  }

  async function viewDetail(c: Campaign) {
    setSelectedCampaign(c); setView("detail");
    try { const r = await api.getCampaignRecipients(c.id); setRecipients(r || []); } catch {}
  }

  async function handlePauseResume(c: Campaign) {
    try {
      if (c.status === "sending") { await api.pauseCampaign(c.id); toast.success("Campanha pausada."); }
      else { await api.startCampaign(c.id); toast.success("Campanha retomada."); }
      await loadCampaigns();
    } catch { toast.error("Erro ao alterar campanha."); }
  }

  // Polling for active campaigns
  useEffect(() => {
    if (view !== "list") return;
    const hasActive = campaigns.some(c => c.status === "sending");
    if (!hasActive) return;
    const interval = setInterval(loadCampaigns, 3000);
    return () => clearInterval(interval);
  }, [campaigns, view]);

  useEffect(() => {
    if (view !== "detail" || !selectedCampaign) return;
    if (selectedCampaign.status !== "sending") return;
    const interval = setInterval(async () => {
      try {
        const [c, r] = await Promise.all([api.getCampaign(selectedCampaign.id), api.getCampaignRecipients(selectedCampaign.id)]);
        if (c) setSelectedCampaign(c);
        if (r) setRecipients(r);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedCampaign, view]);

  const allTags = [...new Set(contacts.flatMap(c => c.tags || []))].filter(Boolean).sort();

  // ── LIST VIEW ─────────────────────────────────────────────────────────
  if (view === "list") return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="font-display text-2xl font-semibold">Disparos</h2><p className="text-sm text-muted-foreground mt-1">Envie mensagens em massa para seus leads.</p></div>
        <Button onClick={startCreate} className="bg-gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" /> Novo Disparo</Button>
      </div>
      {campaigns.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border-dashed border-2 border-border-subtle">
          <Send className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-display text-lg font-medium">Nenhum disparo ainda</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto mb-4">Crie seu primeiro disparo para enviar mensagens em massa.</p>
          <Button onClick={startCreate} variant="outline">Criar disparo</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const s = STATUS_MAP[c.status] || STATUS_MAP.pending;
            const Icon = s.icon;
            const pct = c.total > 0 ? Math.round((c.sent / c.total) * 100) : 0;
            return (
              <div key={c.id} className="glass-card rounded-xl p-5 border-border-subtle flex items-center gap-4 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => viewDetail(c)}>
                <div className={cn("h-10 w-10 rounded-xl grid place-items-center shrink-0", c.status === "sending" ? "bg-primary/10" : "bg-surface-elevated")}>
                  <Icon className={cn("h-5 w-5", s.color, c.status === "sending" && "animate-spin")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.sent}/{c.total} enviados · {c.failed} falhas</p>
                </div>
                <div className="w-24 h-1.5 rounded-full bg-surface-elevated overflow-hidden shrink-0">
                  <div className="h-full rounded-full bg-gradient-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <span className={cn("text-xs font-medium", s.color)}>{s.label}</span>
                <div className="flex gap-1 shrink-0">
                  {(c.status === "sending" || c.status === "paused") && (
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); handlePauseResume(c); }} className="h-8 w-8 p-0">
                      {c.status === "sending" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); viewDetail(c); }} className="h-8 w-8 p-0"><Eye className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── DETAIL VIEW ───────────────────────────────────────────────────────
  if (view === "detail" && selectedCampaign) {
    const c = selectedCampaign;
    const s = STATUS_MAP[c.status] || STATUS_MAP.pending;
    const pct = c.total > 0 ? Math.round((c.sent / c.total) * 100) : 0;
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => { setView("list"); loadCampaigns(); }} className="-ml-2"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        <div className="glass-card rounded-2xl p-6 border-border-subtle space-y-4">
          <div className="flex items-center justify-between">
            <div><h3 className="font-display font-semibold text-lg">{c.name}</h3><p className={cn("text-xs font-medium mt-1", s.color)}>{s.label}</p></div>
            {(c.status === "sending" || c.status === "paused") && (
              <Button variant="outline" size="sm" onClick={() => handlePauseResume(c)}>
                {c.status === "sending" ? <><Pause className="h-3.5 w-3.5 mr-1" /> Pausar</> : <><Play className="h-3.5 w-3.5 mr-1" /> Retomar</>}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-surface/60 border border-border-subtle p-4 text-center"><p className="text-2xl font-bold text-primary">{c.sent}</p><p className="text-xs text-muted-foreground">Enviados</p></div>
            <div className="rounded-xl bg-surface/60 border border-border-subtle p-4 text-center"><p className="text-2xl font-bold text-destructive">{c.failed}</p><p className="text-xs text-muted-foreground">Falhas</p></div>
            <div className="rounded-xl bg-surface/60 border border-border-subtle p-4 text-center"><p className="text-2xl font-bold text-foreground">{c.total}</p><p className="text-xs text-muted-foreground">Total</p></div>
          </div>
          <div className="h-2 rounded-full bg-surface-elevated overflow-hidden"><div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} /></div>
          <div className="bg-surface/40 rounded-xl border border-border-subtle p-3"><p className="text-xs text-muted-foreground mb-1">Mensagem:</p><p className="text-sm whitespace-pre-wrap">{c.message}</p></div>
        </div>
        <div className="glass-card rounded-2xl border-border-subtle overflow-hidden">
          <div className="p-4 border-b border-border-subtle"><h4 className="font-medium text-sm">Destinatários ({recipients.length})</h4></div>
          <div className="max-h-96 overflow-y-auto divide-y divide-border-subtle">
            {recipients.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className={cn("h-2 w-2 rounded-full shrink-0", r.status === "sent" ? "bg-success" : r.status === "failed" ? "bg-destructive" : "bg-muted-foreground/30")} />
                <span className="flex-1 truncate">{r.name || r.phone}</span>
                <span className="text-xs text-muted-foreground font-mono">{r.phone}</span>
                <span className={cn("text-xs font-medium", r.status === "sent" ? "text-success" : r.status === "failed" ? "text-destructive" : "text-muted-foreground")}>
                  {r.status === "sent" ? "Enviado" : r.status === "failed" ? "Falhou" : "Pendente"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── CREATE VIEW ───────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => setView("list")} className="-ml-2"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
      <div className="flex items-center gap-3">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn("h-8 w-8 rounded-full grid place-items-center text-xs font-bold border-2 transition-all",
              step === s ? "border-primary bg-primary/10 text-primary" : step > s ? "border-success bg-success/10 text-success" : "border-border-subtle text-muted-foreground"
            )}>{step > s ? "✓" : s}</div>
            <span className={cn("text-xs font-medium hidden sm:inline", step === s ? "text-foreground" : "text-muted-foreground")}>
              {s === 1 ? "Leads" : s === 2 ? "Configuração" : "Mensagem"}
            </span>
            {s < 3 && <div className="w-8 h-px bg-border-subtle" />}
          </div>
        ))}
      </div>

      {/* STEP 1: Source */}
      {step === 1 && (
        <div className="glass-card rounded-2xl p-6 border-border-subtle space-y-5">
          <div><h3 className="font-display font-semibold">Selecionar Leads</h3><p className="text-xs text-muted-foreground mt-1">Escolha de onde virão os contatos.</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { key: "crm" as const, icon: Users, label: "Contatos do CRM" },
              { key: "tag" as const, icon: Tag, label: "Filtrar por tag" },
              { key: "csv" as const, icon: Upload, label: "Colar lista (CSV)" },
            ]).map(opt => (
              <button key={opt.key} type="button" onClick={() => setSourceType(opt.key)}
                className={cn("rounded-xl border p-4 flex flex-col items-center gap-2 transition-all text-center",
                  sourceType === opt.key ? "border-primary/30 bg-primary/5 text-primary" : "border-border-subtle text-muted-foreground hover:text-foreground"
                )}>
                <opt.icon className="h-5 w-5" /><span className="text-xs font-medium">{opt.label}</span>
              </button>
            ))}
          </div>

          {sourceType === "crm" && (
            <div className="space-y-2 max-h-64 overflow-y-auto rounded-xl border border-border-subtle">
              {contacts.filter(c => c.phone).map(c => (
                <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-surface/60 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => {
                    const next = new Set(selectedIds); next.has(c.id) ? next.delete(c.id) : next.add(c.id); setSelectedIds(next);
                  }} className="rounded" />
                  <span className="flex-1 truncate">{c.name || c.phone}</span>
                  <span className="text-xs text-muted-foreground font-mono">{c.phone}</span>
                </label>
              ))}
              {contacts.filter(c => c.phone).length === 0 && <p className="p-4 text-xs text-muted-foreground text-center">Nenhum contato com telefone.</p>}
              {contacts.filter(c => c.phone).length > 0 && (
                <div className="px-3 py-2 border-t border-border-subtle">
                  <button type="button" className="text-xs text-primary" onClick={() => {
                    const all = contacts.filter(c => c.phone).map(c => c.id);
                    setSelectedIds(selectedIds.size === all.length ? new Set() : new Set(all));
                  }}>{selectedIds.size === contacts.filter(c => c.phone).length ? "Desmarcar todos" : "Selecionar todos"}</button>
                </div>
              )}
            </div>
          )}

          {sourceType === "tag" && (
            <div className="space-y-2">
              <Label className="text-xs">Selecione uma tag:</Label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <button key={tag} type="button" onClick={() => setSelectedTag(tag)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all",
                      selectedTag === tag ? "bg-primary/15 border-primary/30 text-primary" : "border-border-subtle text-muted-foreground hover:text-foreground"
                    )}>{tag} ({contacts.filter(c => c.tags?.includes(tag) && c.phone).length})</button>
                ))}
                {allTags.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag encontrada nos contatos.</p>}
              </div>
            </div>
          )}

          {sourceType === "csv" && (
            <div className="space-y-2">
              <Label className="text-xs">Cole os contatos (telefone;nome;empresa;cidade):</Label>
              <Textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={6} placeholder={"5511999998888;João;Empresa X;São Paulo\n5521988887777;Maria;Empresa Y;Rio"} className="font-mono text-xs" />
              <p className="text-[10px] text-muted-foreground">{csvText.split("\n").filter(l => l.trim()).length} linhas detectadas</p>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <p className="text-xs text-muted-foreground">{getSelectedRecipients().length} contatos selecionados</p>
            <Button onClick={() => { if (getSelectedRecipients().length === 0) { toast.error("Selecione ao menos um contato."); return; } setStep(2); }}
              disabled={getSelectedRecipients().length === 0}>Próximo</Button>
          </div>
        </div>
      )}

      {/* STEP 2: Config */}
      {step === 2 && (
        <div className="glass-card rounded-2xl p-6 border-border-subtle space-y-5">
          <div><h3 className="font-display font-semibold">Configuração do Envio</h3><p className="text-xs text-muted-foreground mt-1">Controle de velocidade e anti-bloqueio.</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-xs">Nome do disparo (opcional)</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Prospecção maio" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Instância Evolution</Label><Input value="Gpressi" disabled className="opacity-60" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Delay entre mensagens (segundos)</Label>
              <Input type="number" value={delaySeconds} onChange={e => setDelaySeconds(Math.max(3, Number(e.target.value)))} min={3} max={60} />
              <p className="text-[10px] text-muted-foreground">Mínimo: 3s. Recomendado: 5–15s</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Limite por minuto</Label>
              <Input type="number" value={limitPerMinute} onChange={e => setLimitPerMinute(Math.min(30, Math.max(5, Number(e.target.value))))} min={5} max={30} />
              <p className="text-[10px] text-muted-foreground">Máximo: 30/min</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border-subtle p-4">
            <div><p className="text-sm font-medium">Simular humano</p><p className="text-xs text-muted-foreground">Variação aleatória no delay para parecer natural.</p></div>
            <Switch checked={simulateHuman} onCheckedChange={setSimulateHuman} />
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
            <Button onClick={() => setStep(3)}>Próximo</Button>
          </div>
        </div>
      )}

      {/* STEP 3: Message */}
      {step === 3 && (
        <div className="glass-card rounded-2xl p-6 border-border-subtle space-y-5">
          <div><h3 className="font-display font-semibold">Mensagem</h3><p className="text-xs text-muted-foreground mt-1">Escreva a mensagem que será enviada.</p></div>
          <div className="space-y-2">
            <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder={"Fala {nome}, tudo bem?\n\nVi que você atua com {segmento} em {cidade}..."} />
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] text-muted-foreground mr-1">Variáveis:</span>
              {["{nome}", "{empresa}", "{cidade}", "{segmento}"].map(v => (
                <button key={v} type="button" onClick={() => setMessage(m => m + v)}
                  className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] font-mono text-primary hover:bg-primary/20">{v}</button>
              ))}
            </div>
          </div>
          {message && (
            <div className="rounded-xl bg-surface/60 border border-border-subtle p-4 space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium">Prévia:</p>
              <p className="text-sm whitespace-pre-wrap">{message.replace(/\{nome\}/gi, "João").replace(/\{empresa\}/gi, "Empresa X").replace(/\{cidade\}/gi, "São Paulo").replace(/\{segmento\}/gi, "Tecnologia")}</p>
            </div>
          )}
          <div className="rounded-xl border border-border-subtle bg-surface/40 p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Resumo do disparo:</p>
            <p>📩 {getSelectedRecipients().length} destinatários</p>
            <p>⏱️ Delay: {delaySeconds}s {simulateHuman && "(com variação)"} · Limite: {limitPerMinute}/min</p>
            <p>⏳ Tempo estimado: ~{Math.ceil(getSelectedRecipients().length * delaySeconds / 60)} minutos</p>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
            <Button onClick={handleCreate} disabled={creating || !message.trim()} className="bg-gradient-primary text-primary-foreground shadow-glow">
              {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</> : <><Send className="h-4 w-4 mr-2" /> Iniciar Disparo</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
