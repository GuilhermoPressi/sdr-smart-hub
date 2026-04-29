import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "info" | "muted" | "accent" | "whatsapp" | "danger";

const variants: Record<Variant, string> = {
  default: "bg-surface text-foreground border-border-subtle",
  success: "bg-primary/15 text-primary border-primary/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  info: "bg-info/15 text-info border-info/30",
  muted: "bg-muted/40 text-muted-foreground border-border-subtle",
  accent: "bg-accent/15 text-accent border-accent/30",
  whatsapp: "bg-whatsapp/15 text-whatsapp border-whatsapp/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
};

export function StatusBadge({
  children,
  variant = "default",
  className,
  dot = false,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        variants[variant],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
