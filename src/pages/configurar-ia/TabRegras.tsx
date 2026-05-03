import { useState } from "react";
import { Settings2, ArrowRightLeft, Clock, KanbanSquare, UserCheck, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AIConfig, AutoRules } from "@/store/app";
import { cn } from "@/lib/utils";

interface Props {
  ai: AIConfig;
  setAI: (patch: Partial<AIConfig>) => void;
}

const defaultRules = (): AutoRules => ({
  transferKeywords: [],
  followUpEnabled: false,
  followUpHours: 24,
  moveOnQualify: true,
  qualifyStage: "qualificado",
  pauseOnHumanReply: true,
});

export default function TabRegras({ ai, setAI }: Props) {
  const rules = ai.autoRules || defaultRules();
  const [newKeyword, setNewKeyword] = useState("");

  const update = (patch: Partial<AutoRules>) => {
    setAI({ autoRules: { ...rules, ...patch } });
  };

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    update({ transferKeywords: [...rules.transferKeywords, newKeyword.trim().toLowerCase()] });
    setNewKeyword("");
  };

  const removeKeyword = (idx: number) => {
    update({ transferKeywords: rules.transferKeywords.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          Regras Automáticas
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Gatilhos que são avaliados ANTES da IA responder. Controle quando transferir, pausar ou mover leads.
        </p>
      </div>

      {/* ── 1. Transfer Keywords ── */}
      <div className="rounded-xl border border-border-subtle bg-surface/40 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-500/10 grid place-items-center text-amber-500 shrink-0">
            <ArrowRightLeft className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm text-foreground">Transferir para humano</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Quando o lead enviar uma mensagem contendo estas palavras-chave, a IA para e o vendedor assume.
            </p>
          </div>
        </div>

        {rules.transferKeywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {rules.transferKeywords.map((kw, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                {kw}
                <button type="button" onClick={() => removeKeyword(i)} className="hover:text-destructive">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
            placeholder="Ex: falar com humano, cancelar, reclamação"
            className="text-xs"
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }} />
          <Button type="button" variant="outline" size="sm" onClick={addKeyword} disabled={!newKeyword.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* ── 2. Follow-up Automático ── */}
      <div className={cn(
        "rounded-xl border bg-surface/40 p-5 space-y-4 transition-all",
        rules.followUpEnabled ? "border-primary/20" : "border-border-subtle",
      )}>
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 grid place-items-center text-blue-500 shrink-0">
            <Clock className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm text-foreground">Follow-up automático</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Se o lead não responder, a IA envia uma mensagem de follow-up após o tempo configurado.
            </p>
          </div>
          <Switch checked={rules.followUpEnabled} onCheckedChange={v => update({ followUpEnabled: v })} />
        </div>

        {rules.followUpEnabled && (
          <div className="flex items-center gap-3 pl-12 animate-fade-in">
            <span className="text-xs text-muted-foreground">Enviar após</span>
            <Input type="number" value={rules.followUpHours} onChange={e => update({ followUpHours: Number(e.target.value) })}
              className="w-20 text-xs text-center" min={1} max={168} />
            <span className="text-xs text-muted-foreground">horas sem resposta</span>
          </div>
        )}
      </div>

      {/* ── 3. Mover no CRM ── */}
      <div className={cn(
        "rounded-xl border bg-surface/40 p-5 space-y-4 transition-all",
        rules.moveOnQualify ? "border-emerald-500/20" : "border-border-subtle",
      )}>
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 grid place-items-center text-emerald-500 shrink-0">
            <KanbanSquare className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm text-foreground">Mover lead no CRM ao qualificar</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Quando o lead chegar na etapa de handoff/fechamento, move automaticamente no CRM.
            </p>
          </div>
          <Switch checked={rules.moveOnQualify} onCheckedChange={v => update({ moveOnQualify: v })} />
        </div>

        {rules.moveOnQualify && (
          <div className="flex items-center gap-3 pl-12 animate-fade-in">
            <span className="text-xs text-muted-foreground">Mover para:</span>
            <Input value={rules.qualifyStage} onChange={e => update({ qualifyStage: e.target.value })}
              className="w-48 text-xs" placeholder="qualificado" />
          </div>
        )}
      </div>

      {/* ── 4. Pausar quando humano assumir ── */}
      <div className={cn(
        "rounded-xl border bg-surface/40 p-5 transition-all",
        rules.pauseOnHumanReply ? "border-purple-500/20" : "border-border-subtle",
      )}>
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-purple-500/10 grid place-items-center text-purple-500 shrink-0">
            <UserCheck className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm text-foreground">Pausar IA quando humano assumir</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Se um vendedor humano responder no chat, a IA para de responder automaticamente.
            </p>
          </div>
          <Switch checked={rules.pauseOnHumanReply} onCheckedChange={v => update({ pauseOnHumanReply: v })} />
        </div>
      </div>
    </div>
  );
}
