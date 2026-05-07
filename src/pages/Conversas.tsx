import { useState, useEffect, useRef } from "react";
import { useApp } from "@/store/app";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Search, Send, Bot, User, Check, CheckCheck, AlertTriangle,
  ArrowLeft, PauseCircle, PlayCircle, MessageSquare, Zap, UserCheck,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";

/** Verifica se a IA deve responder esta conversa */
function shouldAiRespond(conv: any): boolean {
  if (!conv) return false;
  return conv.aiEnabled && !conv.waitingHumanReply;
}

interface Conversation {
  id: string;
  name: string;
  phone: string;
  iaStatus: string;
  stage: string;
  lastMessageText: string;
  lastMessageSender: string;
  lastMessageAt: string;
  unreadCount: number;
  waitingHumanReply?: boolean;
  handoffReason?: string;
  handoffAt?: string;
}

interface Message {
  id: string;
  text: string;
  sender: string;
  status: string;
  createdAt: string;
}

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatFullTime(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function Conversas() {
  const { 
    conversations, 
    fetchConversations, 
    activeConversationId, 
    setActiveConversation, 
    updateConversationStore,
    agents 
  } = useApp();
  
  const activeAiName = agents[0]?.displayName || agents[0]?.internalName || "IA";
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeConversationId) || null;

  // ── Poll conversas a cada 5s ────────────────────────────────────────────
  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Poll mensagens do chat ativo a cada 5s ──────────────────────────────
  useEffect(() => {
    if (!activeConv?.id) return;
    loadMessages(activeConv.id);
    const interval = setInterval(() => loadMessages(activeConv.id), 5000);
    return () => clearInterval(interval);
  }, [activeConv?.id]);

  // ── Scroll para última mensagem ─────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages(convId: string) {
    setLoadingMsgs(true);
    try {
      const data = await api.getConversationMessages(convId);
      setMessages(data || []);
    } catch {
      // silencioso
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function handleSelectConversation(id: string) {
    setActiveConversation(id);
    setMessages([]);
    // Marca como lida
    try {
      await api.markAsRead(id);
      fetchConversations(); // recarrega para zerar unreadCount
    } catch {}
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || !activeConv || isSending) return;
    const text = inputValue.trim();
    setInputValue("");
    setIsSending(true);

    // Otimista
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      text,
      sender: "human",
      status: "sent",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      await api.sendText(activeConv.instanceName, activeConv.contact?.phone || "", text);
      await new Promise(r => setTimeout(r, 800));
      if (activeConv.contactId) loadMessages(activeConv.contactId);
      fetchConversations();
    } catch {
      toast.error("Falha ao enviar mensagem");
      setMessages(prev => prev.filter(m => !m.id.startsWith("temp-")));
    } finally {
      setIsSending(false);
    }
  }

  async function handleToggleIA() {
    if (!activeConv) return;

    try {
      if (!activeConv.aiEnabled) {
        // RETOMANDO IA
        const updates = {
          aiEnabled: true,
          currentStage: "atendimento_ia",
          waitingHumanReply: false,
          handoffReason: null,
          handoffAt: null,
        };
        await updateConversationStore(activeConv.id, updates);
        toast.success("IA retomada nesta conversa!");
      } else {
        // PAUSANDO IA
        await updateConversationStore(activeConv.id, { aiEnabled: false });
        toast.success("IA pausada para este contato.");
      }
      fetchConversations();
    } catch {
      toast.error("Erro ao alterar IA");
    }
  }

  const filtered = conversations
    .filter((c) => {
      const q = search.toLowerCase();
      const contact = c.contact;
      return (contact?.name || "").toLowerCase().includes(q) || (contact?.phone || "").includes(q);
    })
    .sort((a, b) => {
      if (a.waitingHumanReply && !b.waitingHumanReply) return -1;
      if (!a.waitingHumanReply && b.waitingHumanReply) return 1;
      return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
    });

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[600px] flex gap-4">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div className={cn(
        "shrink-0 flex-col glass-card rounded-2xl overflow-hidden w-full md:w-80",
        activeConv ? "hidden md:flex" : "flex",
      )}>
        <div className="p-4 border-b border-border-subtle bg-surface/50 shrink-0">
          <h2 className="font-display font-semibold mb-3 text-sm">Conversas</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..." className="pl-9 h-9 text-xs bg-background" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto conversations-scroll">
          {filtered.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {search ? "Nenhuma conversa encontrada." : "Nenhuma conversa ativa ainda."}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {!search && "As conversas aparecerão quando alguém enviar uma mensagem."}
              </p>
            </div>
          ) : (
            filtered.map((conv) => (
              <button key={conv.id} onClick={() => handleSelectConversation(conv.id)}
                className={cn(
                  "w-full text-left p-4 border-b border-border-subtle transition-colors hover:bg-surface-elevated flex gap-3 items-start",
                  activeId === conv.id && "bg-primary/5 hover:bg-primary/5",
                  conv.waitingHumanReply && "bg-amber-500/5 border-l-2 border-l-amber-500",
                )}>
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full bg-surface-elevated grid place-items-center shrink-0 border border-border-subtle">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <p className={cn("text-sm truncate pr-1", conv.unreadCount > 0 ? "font-bold text-foreground" : "font-medium text-foreground/80")}>
                      {conv.contact?.name || conv.contact?.phone || "Desconhecido"}
                    </p>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                      {formatTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.lastMessageSender !== "lead" && <span className="mr-1 opacity-60">Você:</span>}
                      {conv.lastMessageText || "Sem mensagens"}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Badge aguardando atendente */}
                      {conv.waitingHumanReply && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/20 text-[9px] font-medium text-amber-400" title={`Handoff: ${conv.handoffReason || 'keyword'}`}>
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Aguardando
                        </span>
                      )}
                      {/* Badge IA ativa */}
                      {!conv.waitingHumanReply && shouldAiRespond(conv) && agents.length > 0 && (
                        <span title="IA respondendo automaticamente">
                          <Zap className="h-3 w-3 text-primary" />
                        </span>
                      )}
                      {conv.unreadCount > 0 && (
                        <span className="h-4 min-w-4 px-1 rounded-full bg-destructive text-[9px] font-bold text-white grid place-items-center">
                          {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Chat Area ───────────────────────────────────────────────────── */}
      {activeConv ? (
        <div className="flex-1 flex flex-col glass-card rounded-2xl overflow-hidden min-w-0">

          {/* Header */}
          <div className="p-4 border-b border-border-subtle bg-surface/50 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button className="md:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:bg-surface-elevated"
                onClick={() => setActiveId(null)}>
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="h-9 w-9 rounded-full bg-surface-elevated grid place-items-center border border-border-subtle shrink-0">
                <User className="h-4 w-4 text-foreground/70" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{activeConv.contact?.name || activeConv.contact?.phone}</p>
                <p className="text-xs text-muted-foreground">{activeConv.contact?.phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Handoff badge */}
              {activeConv.waitingHumanReply && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1 animate-pulse">
                  <AlertTriangle className="h-3 w-3" />
                  Aguardando atendente
                </div>
              )}
              {/* IA status badge */}
              {!activeConv.waitingHumanReply && shouldAiRespond(activeConv) && agents.length > 0 ? (
                <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 border border-success/20 rounded-full px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  {activeAiName} ativa
                </div>
              ) : !activeConv.waitingHumanReply && !activeConv.aiEnabled ? (
                <StatusBadge variant="warning" dot className="text-[10px] hidden sm:flex">IA pausada</StatusBadge>
              ) : null}
              <Button variant={!activeConv.aiEnabled ? "default" : "outline"}
                size="sm" className={cn("h-8 text-xs gap-1.5",
                  !activeConv.aiEnabled ? "bg-warning text-warning-foreground hover:bg-warning/90" : ""
                )}
                onClick={handleToggleIA}>
                {!activeConv.aiEnabled
                  ? <><PlayCircle className="h-3.5 w-3.5" /> Retomar IA</>
                  : <><PauseCircle className="h-3.5 w-3.5" /> Pausar IA</>}
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/30 conversations-scroll">
            {loadingMsgs && messages.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-8">Carregando mensagens...</div>
            )}

            {messages.length > 0 && (
              <div className="text-center mb-4">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-surface px-2 py-1 rounded-md">
                  Conversa
                </span>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.sender === "lead" ? "justify-start" : "justify-end")}>
                <div className={cn(
                  "max-w-[75%] rounded-2xl px-3 py-2",
                  msg.sender === "lead"
                    ? "bg-surface-elevated border border-border-subtle text-foreground rounded-tl-sm"
                    : msg.sender === "ia"
                      ? "bg-primary/10 border border-primary/20 text-foreground rounded-tr-sm"
                      : "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground rounded-tr-sm",
                )}>
                  {msg.sender === "ia" && (
                    <div className="flex items-center gap-1 mb-1 opacity-60">
                      <Bot className="h-3 w-3" />
                      <span className="text-[10px] uppercase tracking-wide font-medium">IA</span>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <div className={cn("flex items-center justify-end gap-1 mt-0.5",
                    msg.sender !== "lead" ? "text-primary-foreground/60" : "text-muted-foreground")}>
                    <span className="text-[10px]">{formatFullTime(msg.createdAt)}</span>
                    {msg.sender !== "lead" && (
                      msg.status === "read" ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border-subtle bg-surface/50 shrink-0">
            {!activeConv.aiEnabled || activeConv.waitingHumanReply ? (
              <form onSubmit={handleSend} className="flex gap-2">
                <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)}
                  placeholder={activeConv.waitingHumanReply ? "O lead está aguardando — responda agora..." : "Você assumiu o controle — escreva sua mensagem..."}
                  className="flex-1 bg-background text-sm" />
                <Button type="submit" disabled={!inputValue.trim() || isSending}
                  className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            ) : shouldAiRespond(activeConv) && agents.length > 0 ? (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{activeAiName} está respondendo automaticamente</p>
                  <p className="text-muted-foreground/70">Clique em <strong>Pausar IA</strong> para assumir o controle da conversa.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Bot className="h-4 w-4 text-primary shrink-0" />
                <p>A IA está respondendo automaticamente. Clique em <strong>Pausar IA</strong> para assumir o controle.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center glass-card rounded-2xl border-dashed border-2 border-border-subtle">
          <div className="h-16 w-16 rounded-full bg-surface-elevated grid place-items-center mb-4 border border-border-subtle">
            <MessageSquare className="h-7 w-7 text-muted-foreground/60" />
          </div>
          <p className="font-display font-medium text-lg">Suas conversas</p>
          <p className="text-sm text-muted-foreground max-w-xs text-center mt-2">
            Selecione uma conversa na lateral para ver o histórico e interagir.
          </p>
        </div>
      )}
    </div>
  );
}
