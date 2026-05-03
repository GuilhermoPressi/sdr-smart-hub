/**
 * LogsIA.tsx
 * Página que exibe em tempo real os logs do AI Responder
 */

import { useState, useEffect } from "react";
import { getLogs, AILog } from "@/lib/ai-responder";
import { Bot, RefreshCw, AlertCircle, CheckCircle2, Info, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function LevelIcon({ level }: { level: AILog["level"] }) {
  if (level === "error") return <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  if (level === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />;
  if (level === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />;
  return <Info className="h-3.5 w-3.5 text-primary shrink-0" />;
}

function levelColor(level: AILog["level"]) {
  if (level === "error") return "border-l-destructive bg-destructive/5";
  if (level === "warn") return "border-l-warning bg-warning/5";
  if (level === "success") return "border-l-success bg-success/5";
  return "border-l-primary/40 bg-primary/5";
}

export default function LogsIA() {
  const [logs, setLogs] = useState<AILog[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const refresh = () => setLogs(getLogs());
    refresh();
    if (!autoRefresh) return;
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            Logs da IA
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Registro em tempo real das respostas automáticas geradas pela IA.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn("border-border-subtle gap-2", autoRefresh && "border-primary/40 text-primary")}
            onClick={() => setAutoRefresh(v => !v)}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", autoRefresh && "animate-spin")} />
            {autoRefresh ? "Ao vivo" : "Pausado"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-border-subtle gap-2 text-muted-foreground"
            onClick={() => setLogs([])}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Status geral */}
      <div className="glass-card rounded-2xl p-4 border-border-subtle flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-muted-foreground">Watcher ativo</span>
        </div>
        <div className="h-4 w-px bg-border-subtle" />
        <span className="text-sm text-muted-foreground">{logs.length} evento{logs.length !== 1 ? "s" : ""} registrado{logs.length !== 1 ? "s" : ""}</span>
        <div className="h-4 w-px bg-border-subtle" />
        <span className="text-xs text-muted-foreground">Atualização a cada 2s</span>
      </div>

      {/* Lista de logs */}
      <div className="glass-card rounded-2xl overflow-hidden border-border-subtle">
        {logs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <Bot className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">Nenhum log ainda.</p>
            <p className="text-xs text-muted-foreground/60">Os logs aparecerão aqui quando a IA processar mensagens.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {logs.map((log, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 px-5 py-3 border-l-2 font-mono text-xs",
                  levelColor(log.level)
                )}
              >
                <LevelIcon level={log.level} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted-foreground/60 shrink-0">
                      {log.ts.slice(11, 19)}
                    </span>
                    {log.contactName && (
                      <span className="text-primary font-medium shrink-0">{log.contactName}</span>
                    )}
                    <span className="font-semibold text-foreground">{log.event}</span>
                  </div>
                  {log.detail && (
                    <p className="text-muted-foreground mt-0.5 break-all">{log.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
