import React from "react";
import { CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/* ── Step Indicator ── */
export function StepIndicator({ steps, current, status }: {
  steps: { key: string; label: string }[];
  current: number;
  status: boolean[];
}) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => {}}
              data-step={i}
              className="flex items-center gap-2 flex-1 group"
            >
              <div className={cn(
                "h-7 w-7 rounded-full grid place-items-center text-xs font-bold shrink-0 transition-all duration-300",
                status[i]
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : i === current
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "bg-surface border border-border-subtle text-muted-foreground",
              )}>
                {status[i] ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn(
                "text-xs font-medium hidden md:block transition-colors",
                status[i] ? "text-emerald-400" : i === current ? "text-foreground" : "text-muted-foreground",
              )}>{step.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div className={cn(
                "h-[2px] flex-1 mx-2 rounded-full transition-all duration-300",
                status[i] ? "bg-emerald-500/40" : "bg-border-subtle",
              )} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Section Card ── */
export function Group({ icon: Icon, title, description, children }: {
  icon: any; title: string; description: string; children: React.ReactNode;
}) {
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

/* ── Field Wrapper ── */
export function Field({ label, hint, required, recommended, optional, children }: {
  label: string; hint?: string; required?: boolean; recommended?: boolean; optional?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground/90 flex items-center gap-1.5">
        {label}
        {required && <span className="text-red-400 text-[10px]">*</span>}
        {recommended && (
          <span className="text-[10px] font-normal text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
            recomendado
          </span>
        )}
        {optional && <span className="text-muted-foreground text-[10px] font-normal">(opcional)</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ── Qualification Toggle Card ── */
export function QualCard({ icon: Icon, label, subtext, value, onChange, accent, enabled, onToggle }: {
  icon: any; label: string; subtext: string; value: string; onChange: (v: string) => void; accent: string;
  enabled: boolean; onToggle: () => void;
}) {
  return (
    <div className={cn(
      "rounded-xl border bg-surface/50 p-4 space-y-3 transition-all duration-200",
      enabled ? "border-border-subtle" : "border-border-subtle/50 opacity-50",
    )}>
      <div className="flex items-start gap-3">
        <div
          className="h-9 w-9 rounded-lg grid place-items-center shrink-0"
          style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground leading-snug">{label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtext}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="text-xs animate-fade-in" />
      )}
    </div>
  );
}

/* ── Chat Bubble ── */
export function ChatBubble({ from, children, className }: {
  from: "ia" | "lead"; children: React.ReactNode; className?: string;
}) {
  const isIA = from === "ia";
  return (
    <div className={cn("flex", isIA ? "justify-start" : "justify-end", className)}>
      <div className={cn(
        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
        isIA
          ? "bg-surface/80 border border-border-subtle text-foreground/90 rounded-tl-sm"
          : "bg-primary/15 border border-primary/20 text-foreground/80 rounded-tr-sm",
      )}>
        {children}
      </div>
    </div>
  );
}

/* ── Mini Info Box ── */
export function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-background/40 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-foreground/90 truncate">{value}</p>
    </div>
  );
}
