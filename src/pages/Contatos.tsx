import { useMemo, useState } from "react";
import { useApp, StageId } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingModal } from "@/components/shared/LoadingModal";
import { Search, Filter, UserPlus, Tag, Plus, Workflow, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const stageOptions: { id: StageId; label: string }[] = [
  { id: "novo", label: "Novo lead" },
  { id: "abordado", label: "Foi abordado" },
  { id: "respondeu", label: "Respondeu abordagem" },
  { id: "qualificado", label: "Qualificado" },
  { id: "aguardando", label: "Aguardando proposta" },
  { id: "proposta", label: "Proposta enviada" },
  { id: "fechado", label: "Fechado" },
  { id: "perdido", label: "Perdido" },
];

const phrases = ["Aplicando configurações...", "Atualizando contatos...", "Enviando contatos para o CRM...", "Concluído."];

export default function Contatos() {
  const { leads, bulkUpdate } = useApp();
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState("all");
  const [tag, setTag] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);

  const [tagInput, setTagInput] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [crm, setCrm] = useState("");
  const [pipeline, setPipeline] = useState("");
  const [stage, setStage] = useState<StageId | "">("");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (search && !`${l.name} ${l.email} ${l.company}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (origin !== "all" && l.origin !== origin) return false;
      if (tag !== "all" && !l.tags.includes(tag)) return false;
      if (status !== "all" && l.status !== status) return false;
      return true;
    });
  }, [leads, search, origin, tag, status]);

  const allTags = Array.from(new Set(leads.flatMap((l) => l.tags)));
  const allOrigins = Array.from(new Set(leads.map((l) => l.origin)));
  const allStatuses = Array.from(new Set(leads.map((l) => l.status)));
  const allSelected = filtered.length > 0 && filtered.every((l) => selected.includes(l.id));

  const toggleAll = () => {
    if (allSelected) setSelected(selected.filter((id) => !filtered.find((l) => l.id === id)));
    else setSelected(Array.from(new Set([...selected, ...filtered.map((l) => l.id)])));
  };

  const apply = () => setLoading(true);

  return (
    <>
      <div className="space-y-5">
        <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, e-mail, empresa..." className="pl-9" />
          </div>
          <FilterSelect icon label="Origem" value={origin} onChange={setOrigin} options={["all", ...allOrigins]} />
          <FilterSelect label="Tag" value={tag} onChange={setTag} options={["all", ...allTags]} />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={["all", ...allStatuses]} />
          <Button className="bg-gradient-primary text-primary-foreground shrink-0">
            <UserPlus className="h-4 w-4 mr-2" /> Novo contato
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                    </th>
                    <Th>Nome</Th><Th>Telefone</Th><Th>E-mail</Th><Th>Origem</Th><Th>Tags</Th><Th>CRM</Th><Th>Etapa</Th><Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => {
                    const checked = selected.includes(l.id);
                    return (
                      <tr key={l.id} className={cn("border-t border-border-subtle transition-colors", checked ? "bg-primary/5" : "hover:bg-surface/40")}>
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => setSelected(v ? [...selected, l.id] : selected.filter((x) => x !== l.id))}
                          />
                        </td>
                        <Td>
                          <div className="font-medium text-foreground">{l.name}</div>
                          <div className="text-[11px] text-muted-foreground">{l.role} • {l.company}</div>
                        </Td>
                        <Td className="font-mono text-xs">{l.phone}</Td>
                        <Td className="text-foreground/80">{l.email}</Td>
                        <Td><StatusBadge variant="info" dot>{l.origin}</StatusBadge></Td>
                        <Td>
                          {l.tags.length === 0
                            ? <span className="text-muted-foreground text-xs">Sem tag</span>
                            : <div className="flex flex-wrap gap-1">{l.tags.map((t) => <StatusBadge key={t} variant="accent">{t}</StatusBadge>)}</div>}
                        </Td>
                        <Td className="text-foreground/80">{l.crm}</Td>
                        <Td><span className="text-foreground/80">{stageOptions.find((s) => s.id === l.stage)?.label}</span></Td>
                        <Td><StatusBadge variant={statusVariant(l.status)} dot>{l.status}</StatusBadge></Td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">Nenhum contato encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bulk panel */}
          <aside className={cn(
            "glass-card rounded-2xl p-5 space-y-4 self-start xl:sticky xl:top-24 transition-all",
            selected.length === 0 && "opacity-60",
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Ações em massa</p>
                <p className="font-display font-semibold">{selected.length} selecionados</p>
              </div>
              {selected.length > 0 && (
                <button onClick={() => setSelected([])} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              )}
            </div>

            <Section icon={Tag} title="Criar/adicionar tag">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Ex: Dentistas SP" />
            </Section>

            <Section icon={Plus} title="Adicionar campo personalizado">
              <Input value={fieldName} onChange={(e) => setFieldName(e.target.value)} placeholder="Nome do campo (ex: Especialidade)" />
              <Input value={fieldValue} onChange={(e) => setFieldValue(e.target.value)} placeholder="Valor (ex: Ortodontia)" />
            </Section>

            <Section icon={Workflow} title="Enviar para o CRM">
              <Select value={crm} onValueChange={setCrm}>
                <SelectTrigger><SelectValue placeholder="Escolha o CRM" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRM Comercial">CRM Comercial</SelectItem>
                  <SelectItem value="CRM Pós-venda">CRM Pós-venda</SelectItem>
                </SelectContent>
              </Select>
              <Select value={pipeline} onValueChange={(v) => { setPipeline(v); setStage(""); }}>
                <SelectTrigger><SelectValue placeholder="Escolha o pipeline" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pipeline de Vendas">Pipeline de Vendas</SelectItem>
                  <SelectItem value="Pipeline Inbound">Pipeline Inbound</SelectItem>
                </SelectContent>
              </Select>
              {pipeline && (
                <Select value={stage} onValueChange={(v) => setStage(v as StageId)}>
                  <SelectTrigger className="animate-fade-in"><SelectValue placeholder="Escolha a etapa" /></SelectTrigger>
                  <SelectContent>
                    {stageOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </Section>

            <Button
              onClick={apply}
              disabled={selected.length === 0}
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
            >
              Aplicar
            </Button>
          </aside>
        </div>
      </div>

      <LoadingModal
        open={loading}
        phrases={phrases}
        durationMs={3000}
        title="Atualizando contatos"
        onComplete={() => {
          const patch: any = {};
          if (tagInput) patch.tags = [tagInput];
          if (stage) patch.stage = stage;
          if (crm) patch.crm = crm;
          bulkUpdate(selected, patch);
          setLoading(false);
          toast.success("Ações aplicadas aos contatos selecionados.");
          setSelected([]);
          setTagInput(""); setFieldName(""); setFieldValue(""); setCrm(""); setPipeline(""); setStage("");
        }}
      />
    </>
  );
}

function statusVariant(s: string) {
  if (s === "Novo") return "info" as const;
  if (s === "Cliente") return "success" as const;
  if (s === "Qualificado") return "success" as const;
  if (s === "Sem interesse") return "danger" as const;
  return "muted" as const;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[]; icon?: boolean }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[170px]">
        <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{o === "all" ? `Todas as ${label.toLowerCase()}s` : o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs flex items-center gap-1.5"><Icon className="h-3 w-3 text-primary" /> {title}</Label>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th className="text-left px-4 py-3 font-medium">{children}</th>; }
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <td className={cn("px-4 py-3 text-foreground/90", className)}>{children}</td>; }
