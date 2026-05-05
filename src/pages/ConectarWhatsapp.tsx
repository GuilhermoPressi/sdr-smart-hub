import { useState, useEffect } from "react";
import { useApp } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingModal } from "@/components/shared/LoadingModal";
import { CheckCircle2, MessageCircle, QrCode, ShieldCheck, FileCheck2, Smartphone, RefreshCw, LogOut } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const phrases = ["Preparando conexão...", "Gerando ambiente seguro...", "Aguardando QR Code..."];

export default function ConectarWhatsapp() {
  const { connections, setConnection } = useApp();
  const [loadingKey, setLoadingKey] = useState<null | "official" | "evolution">(null);
  const [number, setNumber] = useState("");
  const [newInstanceName, setNewInstanceName] = useState("rodrigo");
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  useEffect(() => {
    const loadInstances = async () => {
      try {
        const data = await api.listInstances();
        setInstances(data);
        if (data.length > 0) {
          const connected = data.find(i => i.status === 'connected' || i.status === 'open');
          setSelectedInstance(connected || data[0]);
          setConnection("evolution", connected ? ("connected" as any) : "pending");
          if (!connected && data[0].status === 'pending') {
            fetchQrCode(data[0].instanceName);
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

    loadInstances();
  }, [setConnection]);

  // Poll status se houver instância pendente selecionada
  useEffect(() => {
    let interval: any;
    if (selectedInstance && selectedInstance.status === "pending") {
      interval = setInterval(async () => {
        try {
          const status = await api.getInstanceStatus(selectedInstance.instanceName);
          const state = status?.instance?.state || status?.state;
          
          if (state === 'open') {
            setConnection("evolution", "connected" as any);
            setQrCode(null);
            setSelectedInstance(prev => ({ ...prev, status: 'connected' }));
            toast.success("WhatsApp conectado com sucesso!");
            clearInterval(interval);
          } else if (state === 'disconnected' || state === 'close') {
            if (!qrCode) fetchQrCode(selectedInstance.instanceName);
          }
        } catch (e) {
          // ignore
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [selectedInstance, qrCode]);

  const fetchQrCode = async (instName: string) => {
    try {
      const data = await api.getQrCode(instName);
      const base64 = data?.qrcode?.base64 || data?.base64 || data?.code || null;
      if (base64) {
        const src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
        setQrCode(src);
      }
    } catch (error) {
      console.error("Erro ao buscar QR Code", error);
    }
  };

  const handleConnectEvolution = async () => {
    if (!newInstanceName.trim()) {
      toast.error("Informe um nome para a instância.");
      return;
    }
    setLoadingKey("evolution");
    try {
      const created = await api.createInstance(newInstanceName);
      const data = await api.listInstances();
      setInstances(data);
      const newInst = data.find(i => i.instanceName === created.instanceName) || created;
      setSelectedInstance(newInst);
      
      const base64 = created?.qrcode?.base64 || created?.base64 || created?.qrCode;
      if (base64) { const src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`; setQrCode(src); }
      else await fetchQrCode(newInst.instanceName);
      
      setConnection("evolution", "pending");
      setNewInstanceName("");
    } catch (error: any) {
      toast.error("Erro ao criar instância");
    } finally {
      setLoadingKey(null);
    }
  };

  const handleDisconnect = async (instName: string) => {
    if (!confirm("Deseja realmente desconectar? A instância será removida.")) return;
    try {
      await api.deleteInstance(instName);
      setInstances(instances.filter(i => i.instanceName !== instName));
      if (selectedInstance?.instanceName === instName) {
        setSelectedInstance(null);
        setConnection("evolution", "disconnected");
        setQrCode(null);
      }
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
                  <p className="text-xs text-muted-foreground">Suas conexões ativas</p>
                </div>
              </div>
            </div>

            {instances.length > 0 && (
              <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                {instances.map(inst => (
                  <div key={inst.id} className={`flex items-center justify-between p-2 rounded-lg border ${selectedInstance?.id === inst.id ? 'border-primary bg-primary/5' : 'border-border-subtle bg-background/50'} cursor-pointer`} onClick={() => { setSelectedInstance(inst); setConnection("evolution", inst.status === 'connected' ? ('connected' as any) : 'pending'); if(inst.status !== 'connected') fetchQrCode(inst.instanceName); }}>
                    <div>
                      <p className="text-sm font-medium">{inst.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">ID: {inst.instanceName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusVariant state={inst.status === 'connected' ? 'connected' : 'pending'} />
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleDisconnect(inst.instanceName); }}>
                        <LogOut className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="aspect-square max-w-[240px] mx-auto w-full rounded-2xl border-2 border-dashed border-border bg-background/40 grid place-items-center text-center p-6 relative overflow-hidden">
              {!selectedInstance ? (
                 <div className="space-y-2">
                   <QrCode className="h-12 w-12 text-muted-foreground/60 mx-auto" />
                   <p className="text-sm font-medium text-foreground/80">Nenhuma instância selecionada</p>
                 </div>
              ) : qrCode && selectedInstance.status !== 'connected' ? (
                <div className="space-y-3 animate-in fade-in zoom-in duration-500">
                  <img src={qrCode} alt="QR Code" className="w-full aspect-square rounded-lg shadow-glow-sm" />
                  <p className="text-[10px] text-muted-foreground animate-pulse">Escaneie para conectar {selectedInstance.name}</p>
                </div>
              ) : selectedInstance.status === 'connected' ? (
                <div className="space-y-3 text-whatsapp">
                  <div className="h-16 w-16 rounded-full bg-whatsapp/20 grid place-items-center mx-auto">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-semibold">WhatsApp Conectado</p>
                  <p className="text-[11px] text-muted-foreground">{selectedInstance.name} pronto.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <RefreshCw className="h-8 w-8 text-muted-foreground mx-auto animate-spin" />
                  <p className="text-sm font-medium text-foreground/80">Carregando...</p>
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
              <Input
                placeholder="Ex: rodrigo"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleConnectEvolution}
                disabled={isChecking || loadingKey === "evolution" || !newInstanceName}
                className="bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90 shadow-glow-sm"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Criar
              </Button>
            </div>
            
            {selectedInstance && selectedInstance.status !== 'connected' && (
              <Button
                variant="outline"
                onClick={() => fetchQrCode(selectedInstance.instanceName)}
                className="w-full border-border-subtle"
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Atualizar QR Code
              </Button>
            )}
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
