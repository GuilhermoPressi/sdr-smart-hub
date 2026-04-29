import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Building2, Megaphone, Target, Sparkles, CheckCircle2, ArrowRight, Wand2, Briefcase, Users2, Lightbulb, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingModal } from "@/components/shared/LoadingModal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useApp } from "@/store/app";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const tones = ["Profissional", "Consultivo", "Amigável", "Direto", "Premium"] as const;

const buildPhrases = [
  "Analisando suas informações...",
  "Montando a personalidade da IA...",
  "Criando estratégia de qualificação BANT...",
  "Preparando abordagem comercial...",
  "Sua inteligência artificial está sendo construída...",
];

export default function ConfigurarIA() {
  const navigate = useNavigate();
  const { ai, setAI, markBuilt } = useApp();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const summary = useMemo(() => {
    const name = ai.displayName || ai.internalName || "[Nome da IA]";
    const company = ai.company || "[Empresa]";
    const tone = ai.tone.toLowerCase();
    const product = ai.product || "[produto ou serviço]";
    return `Você é ${name}, assistente comercial da empresa ${company}. Seu papel é atender leads pelo WhatsApp de forma ${tone}, entender suas necessidades e qualificá-los usando a metodologia BANT.

Durante a conversa, você deve identificar:
1. Se o lead possui orçamento ou intenção de investimento.
2. Se o lead é o tomador de decisão ou influencia a decisão.
3. Se existe uma necessidade real relacionada a ${product}.
4. Qual é o prazo ou urgência para resolver o problema.

Faça uma pergunta por vez, mantenha a conversa natural e encaminhe o lead para o vendedor quando ele atender aos critérios de qualificação.`;
  }, [ai]);

  const handleBuild = () => {
    setLoading(true);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-8">
      <div className="space-y-6">
        <Group icon={Bot} title="Identidade da IA" description="Como sua IA será conhecida internamente e pelos leads.">
          <Field label="Nome da IA" hint="Apenas para você identificar internamente.">
            <Input value={ai.internalName} onChange={(e) => setAI({ internalName: e.target.value })} placeholder="Ex: Sofia, Pedro, Ana Comercial" />
          </Field>
          <Field label="Nome que a IA usará no atendimento">
            <Input value={ai.displayName} onChange={(e) => setAI({ displayName: e.target.value })} placeholder="Ex: Ana, consultora da equipe comercial" />
          </Field>
          <Field label="Nome da empresa">
            <Input value={ai.company} onChange={(e) => setAI({ company: e.target.value })} placeholder="Ex: Clínica Sorriso Premium" />
          </Field>
          <Field label="Segmento da empresa">
            <Input value={ai.segment} onChange={(e) => setAI({ segment: e.target.value })} placeholder="Ex: estética, odontologia, marketing, software, imobiliária" />
          </Field>
        </Group>

        <Group icon={Briefcase} title="Oferta" description="O que sua empresa vende e para quem.">
          <Field label="Produto ou serviço vendido">
            <Input value={ai.product} onChange={(e) => setAI({ product: e.target.value })} placeholder="Ex: consultoria de tráfego pago para clínicas odontológicas" />
          </Field>
          <Field label="Público-alvo">
            <Input value={ai.audience} onChange={(e) => setAI({ audience: e.target.value })} placeholder="Ex: donos de clínicas odontológicas em São Paulo" />
          </Field>
          <Field label="Principal problema que a solução resolve">
            <Input value={ai.problem} onChange={(e) => setAI({ problem: e.target.value })} placeholder="Ex: falta de pacientes novos todos os meses" />
          </Field>
          <Field label="Benefício principal da solução">
            <Input value={ai.benefit} onChange={(e) => setAI({ benefit: e.target.value })} placeholder="Ex: aumentar o número de agendamentos qualificados" />
          </Field>
        </Group>

        <Group icon={Megaphone} title="Personalidade" description="Como sua IA deve se comunicar.">
          <Field label="Tom de voz da IA">
            <div className="flex flex-wrap gap-2">
              {tones.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAI({ tone: t })}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200",
                    ai.tone === t
                      ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                      : "border-border-subtle bg-surface text-foreground hover:border-primary/40",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Objetivo da conversa">
            <Textarea value={ai.goal} onChange={(e) => setAI({ goal: e.target.value })} placeholder="Ex: qualificar o lead e encaminhar para um vendedor quando ele estiver pronto" rows={2} />
          </Field>
        </Group>

        <Group icon={Target} title="Qualificação BANT" description="Como sua IA vai descobrir se o lead está pronto.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BantCard
              icon={Heart}
              letter="B"
              title="Budget"
              question="Como a IA deve descobrir se o lead tem orçamento?"
              value={ai.bant.budget}
              onChange={(v) => setAI({ bant: { ...ai.bant, budget: v } })}
              accent="hsl(165 65% 50%)"
            />
            <BantCard
              icon={Users2}
              letter="A"
              title="Authority"
              question="Como a IA deve identificar se o lead decide a compra?"
              value={ai.bant.authority}
              onChange={(v) => setAI({ bant: { ...ai.bant, authority: v } })}
              accent="hsl(258 90% 70%)"
            />
            <BantCard
              icon={Lightbulb}
              letter="N"
              title="Need"
              question="Como a IA deve entender a necessidade?"
              value={ai.bant.need}
              onChange={(v) => setAI({ bant: { ...ai.bant, need: v } })}
              accent="hsl(38 92% 60%)"
            />
            <BantCard
              icon={Building2}
              letter="T"
              title="Timeline"
              question="Como a IA deve entender a urgência?"
              value={ai.bant.timeline}
              onChange={(v) => setAI({ bant: { ...ai.bant, timeline: v } })}
              accent="hsl(200 95% 60%)"
            />
          </div>
        </Group>

        <Group icon={CheckCircle2} title="Critérios e instruções" description="Quando o lead é considerado qualificado e regras finais.">
          <Field label="Critérios para considerar o lead qualificado">
            <Textarea
              value={ai.criteria}
              onChange={(e) => setAI({ criteria: e.target.value })}
              rows={3}
              placeholder="Ex: tem orçamento, é decisor ou influencia a decisão, tem necessidade clara e deseja resolver em até 30 dias."
            />
          </Field>
          <Field label="Instruções adicionais para a IA">
            <Textarea
              value={ai.instructions}
              onChange={(e) => setAI({ instructions: e.target.value })}
              rows={3}
              placeholder="Ex: não ser insistente, fazer uma pergunta por vez, responder de forma curta e natural."
            />
          </Field>
        </Group>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" className="border-border-subtle">Salvar rascunho</Button>
          <Button
            onClick={handleBuild}
            className="bg-gradient-primary text-primary-foreground hover:opacity-95 shadow-glow font-medium"
            size="lg"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Construir minha IA
          </Button>
        </div>
      </div>

      {/* Live preview */}
      <aside className="xl:sticky xl:top-24 self-start space-y-4">
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Resumo da IA</p>
                <p className="font-display font-semibold">{ai.displayName || ai.internalName || "Sua IA SDR"}</p>
              </div>
            </div>
            <div className="rounded-xl bg-background/60 border border-border-subtle p-4 text-sm text-foreground/90 leading-relaxed whitespace-pre-line max-h-[420px] overflow-y-auto">
              {summary}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <Mini label="Tom" value={ai.tone} />
              <Mini label="Segmento" value={ai.segment || "—"} />
              <Mini label="Empresa" value={ai.company || "—"} />
              <Mini label="Público" value={ai.audience || "—"} />
            </div>
          </div>
        </div>
      </aside>

      <LoadingModal
        open={loading}
        phrases={buildPhrases}
        durationMs={4500}
        title="Construindo sua IA SDR"
        onComplete={() => {
          setLoading(false);
          markBuilt();
          setSuccess(true);
          toast.success("IA criada com sucesso");
        }}
      />

      <Dialog open={success} onOpenChange={setSuccess}>
        <DialogContent className="glass-card border-border-subtle max-w-md p-8 text-center [&>button]:hidden">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-primary blur-2xl opacity-50" />
              <div className="relative h-16 w-16 rounded-full bg-gradient-primary grid place-items-center shadow-glow animate-scale-in">
                <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold">IA criada com sucesso</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Sua IA SDR está pronta para ser conectada ao WhatsApp.
              </p>
            </div>
            <div className="flex gap-2 w-full pt-2">
              <Button variant="outline" className="flex-1 border-border-subtle" onClick={() => setSuccess(false)}>
                Editar configurações
              </Button>
              <Button
                className="flex-1 bg-gradient-primary text-primary-foreground"
                onClick={() => { setSuccess(false); navigate("/whatsapp"); }}
              >
                Conectar WhatsApp <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Group({ icon: Icon, title, description, children }: { icon: any; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground/90">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function BantCard({ icon: Icon, letter, title, question, value, onChange, accent }: any) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface/50 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="h-9 w-9 rounded-lg grid place-items-center font-display font-bold text-sm"
          style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}
        >
          {letter}
        </div>
        <div>
          <p className="font-display font-semibold text-sm">{title}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Icon className="h-3 w-3" /> {question}</p>
        </div>
      </div>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="text-xs" />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-background/40 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-foreground/90 truncate">{value}</p>
    </div>
  );
}
