import { useState } from "react";
import { useApp, Lead } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingModal } from "@/components/shared/LoadingModal";
import { Linkedin, MapPin, Search, Trash2, UserPlus, Sparkles, Building2, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const searchPhrases = [
  "Iniciando busca no LinkedIn...",
  "Analisando perfis...",
  "Coletando informações públicas...",
  "Organizando contatos encontrados...",
  "Preparando sua lista...",
];

const createPhrases = [
  "Criando contatos...",
  "Validando formato dos números...",
  "Organizando informações...",
  "Contatos criados com sucesso.",
];

const mockLeads: Lead[] = [
  { id: "n1", name: "Mariana Costa", role: "Dentista", company: "Clínica Costa", phone: "+55 11 98765-4321", email: "mariana@email.com", linkedin: "/in/marianacosta", origin: "LinkedIn", tags: [], crm: "Pipeline Comercial", stage: "novo", status: "Novo", iaStatus: "Aguardando", temperature: "Morno", lastInteraction: "—" },
  { id: "n2", name: "Rafael Lima", role: "Diretor", company: "Odonto Prime", phone: "+55 11 91234-5678", email: "rafael@email.com", linkedin: "/in/rafaellima", origin: "LinkedIn", tags: [], crm: "Pipeline Comercial", stage: "novo", status: "Novo", iaStatus: "Aguardando", temperature: "Frio", lastInteraction: "—" },
  { id: "n3", name: "Camila Rocha", role: "Sócia", company: "Clínica Rocha", phone: "+55 11 99888-1122", email: "camila@email.com", linkedin: "/in/camilarocha", origin: "LinkedIn", tags: [], crm: "Pipeline Comercial", stage: "novo", status: "Novo", iaStatus: "Aguardando", temperature: "Morno", lastInteraction: "—" },
];

const quantities = [50, 100, 250, 500];

export default function CriarLista() {
  const { addLeads } = useApp();
  const [source, setSource] = useState<"linkedin" | "maps">("linkedin");
  const [qty, setQty] = useState(100);
  const [searchLoading, setSearchLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [results, setResults] = useState<Lead[] | null>(null);

  return (
    <>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">1. Escolha a fonte de busca</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SourceCard
              active={source === "linkedin"}
              onClick={() => setSource("linkedin")}
              icon={Linkedin}
              title="LinkedIn"
              description="Buscar leads profissionais por cargo, segmento e localização."
              badge={<StatusBadge variant="success" dot>Disponível</StatusBadge>}
            />
            <SourceCard
              active={false}
              disabled
              onClick={() => {}}
              icon={MapPin}
              title="Google Maps"
              description="Buscar empresas locais por região e categoria."
              badge={<StatusBadge variant="warning" dot>Em breve</StatusBadge>}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="glass-card rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-info/15 grid place-items-center text-info">
                <Search className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-display font-semibold">Buscar leads no LinkedIn</h3>
                <p className="text-xs text-muted-foreground">Preencha os filtros para encontrar contatos qualificados.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="O que você quer buscar?" icon={Search}>
                <Input placeholder="Ex: dentistas em São Paulo" />
              </Field>
              <Field label="Cargo ou profissão" icon={Briefcase}>
                <Input placeholder="Ex: dentista, CEO, diretor comercial" />
              </Field>
              <Field label="Localização" icon={MapPin}>
                <Input placeholder="Ex: São Paulo, Brasil" />
              </Field>
              <Field label="Segmento" icon={Building2}>
                <Input placeholder="Ex: odontologia, clínicas, estética" />
              </Field>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Quantidade estimada de leads</Label>
              <div className="flex flex-wrap gap-2">
                {quantities.map((q) => (
                  <button
                    key={q}
                    onClick={() => setQty(q)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                      qty === q
                        ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                        : "border-border-subtle bg-surface text-foreground hover:border-primary/40",
                    )}
                  >
                    {q} leads
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => setSearchLoading(true)}
              size="lg"
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Buscar leads
            </Button>
          </div>

          <div className="rounded-2xl border-2 border-dashed border-border bg-surface/30 p-6 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Reservado</p>
            <h3 className="font-display font-semibold">Configuração APIfy</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Espaço reservado para integração futura com APIfy. As credenciais serão configuradas aqui quando a integração estiver ativa.
            </p>
            <div className="rounded-lg bg-background/40 border border-border-subtle p-3 text-xs text-muted-foreground italic">
              Preencher informações aqui
            </div>
          </div>
        </div>

        {results && (
          <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
            <div className="p-5 flex items-center justify-between border-b border-border-subtle">
              <div>
                <h3 className="font-display font-semibold">Leads encontrados</h3>
                <p className="text-xs text-muted-foreground">{results.length} contatos prontos para serem criados.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="border-border-subtle" onClick={() => { setResults(null); toast("Resultados descartados"); }}>
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir contatos
                </Button>
                <Button className="bg-gradient-primary text-primary-foreground" onClick={() => setCreateLoading(true)}>
                  <UserPlus className="h-4 w-4 mr-2" /> Criar esses contatos
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <Th>Nome</Th><Th>Cargo</Th><Th>Empresa</Th><Th>Telefone</Th><Th>E-mail</Th><Th>LinkedIn</Th><Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((l) => (
                    <tr key={l.id} className="border-t border-border-subtle hover:bg-surface/40 transition-colors">
                      <Td className="font-medium">{l.name}</Td>
                      <Td>{l.role}</Td>
                      <Td>{l.company}</Td>
                      <Td className="font-mono text-xs">{l.phone}</Td>
                      <Td className="text-foreground/80">{l.email}</Td>
                      <Td className="text-info">{l.linkedin}</Td>
                      <Td><StatusBadge variant="info" dot>Novo</StatusBadge></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <LoadingModal
        open={searchLoading}
        phrases={searchPhrases}
        durationMs={4500}
        title="Buscando leads"
        onComplete={() => {
          setSearchLoading(false);
          setResults(mockLeads);
          toast.success("Leads encontrados", { description: `${mockLeads.length} contatos prontos.` });
        }}
      />
      <LoadingModal
        open={createLoading}
        phrases={createPhrases}
        durationMs={3200}
        title="Criando contatos"
        onComplete={() => {
          if (results) addLeads(results);
          setCreateLoading(false);
          setResults(null);
          toast.success("Contatos criados com sucesso", {
            description: "Eles já estão disponíveis na aba Contatos.",
          });
        }}
      />
    </>
  );
}

function SourceCard({ active, disabled, onClick, icon: Icon, title, description, badge }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "text-left rounded-2xl border p-5 transition-all duration-300",
        active && "border-primary/50 bg-gradient-to-br from-primary/10 to-accent/5 shadow-glow",
        !active && !disabled && "border-border-subtle bg-surface hover:border-primary/30 hover:bg-surface-elevated",
        disabled && "border-border-subtle bg-surface/50 opacity-60 cursor-not-allowed",
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn("h-11 w-11 rounded-xl grid place-items-center", active ? "bg-gradient-primary text-primary-foreground" : "bg-surface-elevated text-foreground")}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="font-display font-semibold">{title}</p>
            {badge}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </button>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5"><Icon className="h-3 w-3 text-muted-foreground" />{label}</Label>
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-3 font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-foreground/90", className)}>{children}</td>;
}
