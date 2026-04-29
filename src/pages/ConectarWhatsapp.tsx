import { useState } from "react";
import { useApp } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingModal } from "@/components/shared/LoadingModal";
import { CheckCircle2, MessageCircle, QrCode, ShieldCheck, FileCheck2, Smartphone } from "lucide-react";
import { toast } from "sonner";

const phrases = ["Preparando conexão...", "Gerando ambiente seguro...", "Aguardando QR Code..."];

export default function ConectarWhatsapp() {
  const { connections, setConnection } = useApp();
  const [loadingKey, setLoadingKey] = useState<null | "official" | "evolution">(null);
  const [number, setNumber] = useState("");

  const start = (k: "official" | "evolution") => {
    setConnection(k, "connecting");
    setLoadingKey(k);
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Official */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-info/20 blur-3xl" />
          <div className="relative space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-info/15 border border-info/30 grid place-items-center">
                  <ShieldCheck className="h-5 w-5 text-info" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">WhatsApp API Oficial</h3>
                  <p className="text-xs text-muted-foreground">Templates aprovados pela Meta.</p>
                </div>
              </div>
              <StatusVariant state={connections.official} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Número oficial</Label>
              <Input
                placeholder="+55 11 90000-0000"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="rounded-xl border border-border-subtle bg-background/40 p-4 space-y-2">
              <p className="text-xs font-medium text-foreground flex items-center gap-2">
                <FileCheck2 className="h-3.5 w-3.5 text-primary" /> Templates aprovados
              </p>
              {["Primeira abordagem comercial", "Apresentação da empresa", "Convite para conversa"].map((t) => (
                <div key={t} className="flex items-center justify-between text-xs py-1.5 border-b border-border-subtle last:border-0">
                  <span className="text-foreground/80">{t}</span>
                  <StatusBadge variant="success" dot>Aprovado</StatusBadge>
                </div>
              ))}
            </div>

            <Button
              onClick={() => start("official")}
              disabled={connections.official !== "disconnected"}
              className="w-full bg-gradient-primary text-primary-foreground"
            >
              {connections.official === "pending" ? (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Aguardando ativação</>
              ) : (
                <>Conectar API Oficial</>
              )}
            </Button>
          </div>
        </div>

        {/* Evolution */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute -top-20 -left-20 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-whatsapp/15 border border-whatsapp/30 grid place-items-center">
                  <MessageCircle className="h-5 w-5 text-whatsapp" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">WhatsApp Evolution API</h3>
                  <p className="text-xs text-muted-foreground">Atendimento automatizado com IA.</p>
                </div>
              </div>
              <StatusVariant state={connections.evolution} />
            </div>

            <div className="aspect-square max-w-[240px] mx-auto w-full rounded-2xl border-2 border-dashed border-border bg-background/40 grid place-items-center text-center p-6">
              <div className="space-y-2">
                <QrCode className="h-12 w-12 text-muted-foreground/60 mx-auto" />
                <p className="text-sm font-medium text-foreground/80">QR Code será exibido aqui</p>
                <p className="text-[11px] text-muted-foreground">
                  Em breve, escaneie este QR Code para conectar seu WhatsApp.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border-subtle bg-background/40 p-3 flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Use um número dedicado para o atendimento da IA.
              </p>
            </div>

            <Button
              onClick={() => start("evolution")}
              disabled={connections.evolution !== "disconnected"}
              className="w-full bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90"
            >
              {connections.evolution === "pending" ? (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> QR Code aguardando integração</>
              ) : (
                <>Conectar Evolution</>
              )}
            </Button>
          </div>
        </div>
      </div>

      <LoadingModal
        open={loadingKey !== null}
        phrases={phrases}
        durationMs={3000}
        title="Conectando WhatsApp"
        onComplete={() => {
          if (loadingKey) {
            setConnection(loadingKey, "pending");
            toast.success("QR Code aguardando integração", {
              description: "Conexão preparada. Integração real será ativada futuramente.",
            });
          }
          setLoadingKey(null);
        }}
      />
    </>
  );
}

function StatusVariant({ state }: { state: "disconnected" | "connecting" | "pending" }) {
  if (state === "pending") return <StatusBadge variant="warning" dot>Aguardando</StatusBadge>;
  if (state === "connecting") return <StatusBadge variant="info" dot>Conectando</StatusBadge>;
  return <StatusBadge variant="muted" dot>Não conectado</StatusBadge>;
}
