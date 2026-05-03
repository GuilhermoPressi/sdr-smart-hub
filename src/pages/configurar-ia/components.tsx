import React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/* ── Section Card ── */
export function Group({ icon: Icon, title, description, children }: {
  icon: any; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface/40 p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0">
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

/* ── Toggle Card ── */
export function ToggleCard({ icon: Icon, label, subtext, value, onChange, accent, enabled, onToggle }: {
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
