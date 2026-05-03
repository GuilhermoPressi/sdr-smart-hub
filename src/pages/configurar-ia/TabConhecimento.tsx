import { useState } from "react";
import { BookOpen, HelpCircle, Link2, FileText, Plus, X, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AIConfig, KnowledgeBase } from "@/store/app";
import { Group, Field } from "./components";
import { cn } from "@/lib/utils";

interface Props {
  ai: AIConfig;
  setAI: (patch: Partial<AIConfig>) => void;
}

const emptyKnowledge = (): KnowledgeBase => ({
  faq: [],
  urls: [],
  files: [],
  priority: "faq_first",
});

export default function TabConhecimento({ ai, setAI }: Props) {
  const knowledge = ai.knowledge || emptyKnowledge();
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const update = (patch: Partial<KnowledgeBase>) => {
    setAI({ knowledge: { ...knowledge, ...patch } });
  };

  // FAQ
  const addFaq = () => {
    if (!newQ.trim() || !newA.trim()) return;
    update({ faq: [...knowledge.faq, { question: newQ.trim(), answer: newA.trim() }] });
    setNewQ("");
    setNewA("");
  };

  const removeFaq = (idx: number) => {
    update({ faq: knowledge.faq.filter((_, i) => i !== idx) });
  };

  // URLs
  const addUrl = () => {
    if (!newUrl.trim()) return;
    update({ urls: [...knowledge.urls, newUrl.trim()] });
    setNewUrl("");
  };

  const removeUrl = (idx: number) => {
    update({ urls: knowledge.urls.filter((_, i) => i !== idx) });
  };

  // Files (metadata only)
  const addFileMeta = () => {
    const name = prompt("Nome do arquivo (ex: catalogo.pdf):");
    if (!name) return;
    update({
      files: [...knowledge.files, { name, uploadedAt: new Date().toISOString() }],
    });
  };

  const removeFile = (idx: number) => {
    update({ files: knowledge.files.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-6">
      {/* Priority */}
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border-subtle bg-surface/40">
        <BookOpen className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-medium text-foreground">Prioridade do conhecimento</p>
          <p className="text-[11px] text-muted-foreground">Quando o lead perguntar algo que está no FAQ, o que a IA prioriza?</p>
        </div>
        <div className="flex gap-1">
          {([
            { value: "faq_first" as const, label: "FAQ primeiro" },
            { value: "ai_first" as const, label: "IA primeiro" },
          ]).map(opt => (
            <button key={opt.value} type="button" onClick={() => update({ priority: opt.value })}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
                knowledge.priority === opt.value
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "border-border-subtle bg-surface text-muted-foreground hover:text-foreground",
              )}>{opt.label}</button>
          ))}
        </div>
      </div>

      {/* ── Seção A: FAQ ── */}
      <Group icon={HelpCircle} title="Perguntas e Respostas (FAQ)" description="Respostas prontas que a IA deve usar quando o lead perguntar.">
        {knowledge.faq.length > 0 && (
          <div className="space-y-2">
            {knowledge.faq.map((faq, i) => (
              <div key={i} className="rounded-xl border border-border-subtle bg-surface/50 p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-primary">P: {faq.question}</p>
                    <p className="text-xs text-foreground/80 mt-1">R: {faq.answer}</p>
                  </div>
                  <button type="button" onClick={() => removeFaq(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 rounded-xl border border-dashed border-border-subtle p-4">
          <Field label="Pergunta">
            <Input value={newQ} onChange={e => setNewQ(e.target.value)} placeholder="Ex: Quanto custa?" className="text-xs" />
          </Field>
          <Field label="Resposta">
            <Textarea value={newA} onChange={e => setNewA(e.target.value)} rows={2}
              placeholder="Ex: O valor depende do tamanho e necessidade. Posso te ajudar a entender melhor?" className="text-xs" />
          </Field>
          <Button type="button" variant="outline" size="sm" onClick={addFaq} disabled={!newQ.trim() || !newA.trim()} className="w-full text-xs">
            <Plus className="h-3 w-3 mr-1" /> Adicionar ao FAQ
          </Button>
        </div>
      </Group>

      {/* ── Seção B: URLs ── */}
      <Group icon={Link2} title="URLs de Referência" description="Sites, landing pages ou documentos online que a IA pode consultar (uso futuro).">
        {knowledge.urls.length > 0 && (
          <div className="space-y-1.5">
            {knowledge.urls.map((url, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-surface/60 rounded-lg px-3 py-2 border border-border-subtle">
                <Link2 className="h-3 w-3 text-primary shrink-0" />
                <span className="flex-1 truncate font-mono">{url}</span>
                <button type="button" onClick={() => removeUrl(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..."
            className="text-xs font-mono" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }} />
          <Button type="button" variant="outline" size="sm" onClick={addUrl} disabled={!newUrl.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </Group>

      {/* ── Seção C: Arquivos ── */}
      <Group icon={FileText} title="Arquivos" description="Documentos que a IA pode usar como referência (salva metadados — upload real em breve).">
        {knowledge.files.length > 0 && (
          <div className="space-y-1.5">
            {knowledge.files.map((file, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-surface/60 rounded-lg px-3 py-2 border border-border-subtle">
                <FileText className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="flex-1 truncate">{file.name}</span>
                <span className="text-muted-foreground/50 text-[10px]">
                  {new Date(file.uploadedAt).toLocaleDateString("pt-BR")}
                </span>
                <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addFileMeta}
          className="w-full rounded-xl border-2 border-dashed border-border-subtle hover:border-primary/30 bg-surface/30 p-6 flex flex-col items-center gap-2 transition-colors"
        >
          <Upload className="h-6 w-6 text-muted-foreground/40" />
          <span className="text-xs text-muted-foreground">Clique para adicionar referência de arquivo</span>
          <span className="text-[10px] text-muted-foreground/50">Upload real será implementado em breve</span>
        </button>
      </Group>
    </div>
  );
}
