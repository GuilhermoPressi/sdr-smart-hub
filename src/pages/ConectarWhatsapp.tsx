import { useState, useEffect } from "react";
import { useApp } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingModal } from "@/components/shared/LoadingModal";
import { CheckCircle2, MessageCircle, QrCode, ShieldCheck, FileCheck2, Smartphone, RefreshCw, LogOut } from "lucide-react";
import { toast } from "sonner";
import { evolutionApi } from "@/lib/api";

const phrases = ["Preparando conexão...", "Gerando ambiente seguro...", "Aguardando QR Code..."];

export default function ConectarWhatsapp() {
  const { connections, setConnection } = useApp();
  const [loadingKey, setLoadingKey] = useState<null | "official" | "evolution">(null);
  const [number, setNumber] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceName] = useState("Gpressi");
  const [isChecking, setIsChecking] = useState(true);

  // Check initial status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const instances = await evolutionApi.listInstances();
        const instance = instances.find(i => i.name === instanceName);
        
        if (instance) {
          if (instance.connectionStatus === 'open') {
            setConnection("evolution", "connected" as any);
          } else {
            setConnection("evolution", "pending");
            fetchQrCode();
          }
        } else {
          setConnection("evolution", "disconnected");
        }
      } catch (error) {
        console.error("Erro ao carregar instâncias", error);
      } finally {
        setIsChecking(false);
      }
    };

    checkStatus();
  }, []);

  // Poll status if pending
  useEffect(() => {
    let interval: any;
    if (connections.evolution === "pending") {
      interval = setInterval(async () => {
        try {
          const status = await evolutionApi.getInstanceStatus(instanceName);
          const state = status?.instance?.state || status?.state;
          
          if (state === 'open') {
            setConnection("evolution", "connected" as any);
            setQrCode(null);
            toast.success("WhatsApp conectado com sucesso!");
            clearInterval(interval);
          } else if (state === 'disconnected' || state === 'close') {
            // If it disconnected, try to get QR again
            if (!qrCode) fetchQrCode();
          }
        } catch (e) {
          // ignore
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [connections.evolution, qrCode]);

  const fetchQrCode = async () => {
    try {
      const data = await evolutionApi.getQrCode(instanceName);
      // Evolution v2: { qrcode: { base64: "data:image/png;base64,..." } }
      // Evolution v1: { base64: "..." } or { code: "..." }
      const base64 = data?.qrcode?.base64 || data?.base64 || data?.code || null;
      if (base64) {
        // Garante prefixo data URI
        const src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
        setQrCode(src);
      } else {
        console.warn('QR Code não encontrado na resposta:', JSON.stringify(data));
      }
    } catch (error) {
      console.error("Erro ao buscar QR Code", error);
    }
  };

  const handleConnectEvolution = async () => {
    setLoadingKey("evolution");
    try {
      // Try to create or just get QR if already exists
      const created = await evolutionApi.createInstance(instanceName);
      // Evolution pode retornar QR já no create
      const base64 = created?.qrcode?.base64 || created?.base64;
      if (base64) { const src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`; setQrCode(src); }
      await fetchQrCode();
      setConnection("evolution", "pending");
    } catch (error: any) {
      // If already exists, just fetch QR
      await fetchQrCode();
      setConnection("evolution", "pending");
    } finally {
      setLoadingKey(null);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Deseja realmente desconectar? A instância será removida.")) return;
    try {
      await evolutionApi.deleteInstance(instanceName);
      setConnection("evolution", "disconnected");
      setQrCode(null);
      toast.success("Desconectado com sucesso.");
    } catch (error) {
      toast.error("Erro ao desconectar.");
    }
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
              onClick={() => toast.info('API Oficial não configurada neste plano.')}
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

            <div className="aspect-square max-w-[240px] mx-auto w-full rounded-2xl border-2 border-dashed border-border bg-background/40 grid place-items-center text-center p-6 relative overflow-hidden">
              {qrCode ? (
                <div className="space-y-3 animate-in fade-in zoom-in duration-500">
                  <img src={qrCode} alt="QR Code" className="w-full aspect-square rounded-lg shadow-glow-sm" />
                  <p className="text-[10px] text-muted-foreground animate-pulse">Escaneie para conectar</p>
                </div>
              ) : connections.evolution === ("connected" as any) ? (
                <div className="space-y-3 text-whatsapp">
                  <div className="h-16 w-16 rounded-full bg-whatsapp/20 grid place-items-center mx-auto">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-semibold">WhatsApp Conectado</p>
                  <p className="text-[11px] text-muted-foreground">Pronto para automatizar com IA.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <QrCode className="h-12 w-12 text-muted-foreground/60 mx-auto" />
                  <p className="text-sm font-medium text-foreground/80">
                    {isChecking ? "Verificando status..." : "QR Code será exibido aqui"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Clique no botão abaixo para gerar a conexão.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border-subtle bg-background/40 p-3 flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Use um número dedicado para o atendimento da IA.
              </p>
            </div>

            <div className="flex gap-2">
              {connections.evolution === ("connected" as any) || connections.evolution === "pending" ? (
                <>
                  <Button
                    variant="outline"
                    onClick={fetchQrCode}
                    className="flex-1 border-border-subtle"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDisconnect}
                    className="flex-1"
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Desconectar
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleConnectEvolution}
                  disabled={isChecking || loadingKey === "evolution"}
                  className="w-full bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90 shadow-glow-sm"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {isChecking ? "Verificando..." : "Conectar Evolution"}
                </Button>
              )}
            </div>
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

function StatusVariant({ state }: { state: "disconnected" | "connecting" | "pending" | "connected" }) {
  if (state === "connected") return <StatusBadge variant="success" dot>Conectado</StatusBadge>;
  if (state === "pending") return <StatusBadge variant="warning" dot>Aguardando QR</StatusBadge>;
  if (state === "connecting") return <StatusBadge variant="info" dot>Conectando</StatusBadge>;
  return <StatusBadge variant="muted" dot>Desconectado</StatusBadge>;
}
