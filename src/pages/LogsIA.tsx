/**
 * LogsIA.tsx
 * Página que exibe informação sobre o status da IA no backend.
 * Os logs reais agora ficam no console do backend (NestJS).
 * Aqui mostramos informações úteis para o usuário.
 */

import { useState, useEffect } from "react";
import { useApp } from "@/store/app";
import { api } from "@/lib/api";
import { Bot, RefreshCw, CheckCircle2, Info, AlertTriangle, Zap, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AiConfigInfo {
  id: string;
  displayName: string;
  internalName: string;
  company: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function LogsIA() {
  const { agents } = useApp();
  const [configs, setConfigs] = useState<AiConfigInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const activeAgent = agents.find((a: any) => a.active) || agents[0] || null;

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    setLoading(true);
    try {
      const data = await api.getAiConfigs();
      setConfigs(data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            Status da IA
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Status do processamento automático de mensagens via OpenAI.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-border-subtle gap-2"
          onClick={loadConfigs}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Status geral */}
      <div className="glass-card rounded-2xl p-5 border-border-subtle space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">Processamento no Backend</p>
            <p className="text-xs text-muted-foreground">
              As respostas da IA são processadas 100% no servidor via OpenAI (gpt-4o-mini).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* IA Ativa */}
          <div className={cn(
            "rounded-xl border p-4",
            activeAgent ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"
          )}>
            <div className="flex items-center gap-2 mb-2">
              {activeAgent ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-warning" />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                IA Ativa
              </span>
            </div>
            <p className="text-sm font-medium">
              {activeAgent
                ? (activeAgent.displayName || activeAgent.internalName || "Configurada")
                : "Nenhuma IA ativa"}
            </p>
          </div>

          {/* Empresa */}
          <div className="rounded-xl border border-border-subtle bg-surface/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Empresa
              </span>
            </div>
            <p className="text-sm font-medium">
              {activeAgent?.company || "—"}
            </p>
          </div>

          {/* Motor IA */}
          <div className="rounded-xl border border-border-subtle bg-surface/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Motor IA
              </span>
            </div>
            <p className="text-sm font-medium">OpenAI gpt-4o-mini</p>
          </div>
        </div>
      </div>

      {/* Fluxo */}
      <div className="glass-card rounded-2xl p-5 border-border-subtle">
        <h3 className="font-semibold text-sm mb-4">Fluxo de Resposta Automática</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {[
            "📩 Mensagem recebida via WhatsApp",
            "→",
            "🔗 Webhook Evolution envia ao backend",
            "→",
            "👤 Backend identifica contato",
            "→",
            "🤖 Verifica se IA está ativa",
            "→",
            "💬 OpenAI gera resposta",
            "→",
            "📤 Resposta enviada via Evolution",
          ].map((step, i) => (
            <span key={i} className={cn(
              step === "→" ? "text-primary font-bold text-lg" : "bg-surface-elevated rounded-lg px-3 py-1.5 border border-border-subtle"
            )}>
              {step}
            </span>
          ))}
        </div>
      </div>

      {/* Lista de IAs configuradas */}
      <div className="glass-card rounded-2xl overflow-hidden border-border-subtle">
        <div className="px-5 py-3 border-b border-border-subtle bg-surface/50">
          <h3 className="font-semibold text-sm">Configurações de IA ({configs.length})</h3>
        </div>
        {configs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <Bot className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">Nenhuma IA configurada.</p>
            <p className="text-xs text-muted-foreground/60">Configure uma IA em "Configurar IA de Atendimento".</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {configs.map((config) => (
              <div key={config.id} className="flex items-center gap-3 px-5 py-3">
                <div className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  config.active ? "bg-success animate-pulse" : "bg-muted-foreground/30"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {config.displayName || config.internalName || "Sem nome"}
                  </p>
                  <p className="text-xs text-muted-foreground">{config.company || "—"}</p>
                </div>
                <span className={cn(
                  "text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full",
                  config.active
                    ? "bg-success/10 text-success border border-success/20"
                    : "bg-muted/30 text-muted-foreground"
                )}>
                  {config.active ? "Ativa" : "Inativa"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info sobre logs do backend */}
      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground/60">
          💡 Logs detalhados (mensagens recebidas, respostas geradas, erros) estão disponíveis no console do backend (NestJS).
        </p>
      </div>
    </div>
  );
}
