import { useState, useEffect } from "react";
import { useApp, Lead } from "@/store/app";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Send, Bot, User, Phone, Check, CheckCheck, ArrowLeft, PauseCircle, PlayCircle, MessageSquare } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

export default function Conversas() {
  const { leads, chatHistory, addMessage, activeChatLeadId, setActiveChatLead, updateLead, fetchLeads, fetchMessages } = useApp();
  const [search, setSearch] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Busca contatos ao montar e faz polling a cada 5s para atualizações em tempo real
  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch messages when a chat is selected
  useEffect(() => {
    if (activeChatLeadId) {
      fetchMessages(activeChatLeadId);
      // Opcional: implementar um polling aqui para atualizar as mensagens periodicamente
      const interval = setInterval(() => {
        fetchMessages(activeChatLeadId);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeChatLeadId]);

  const activeLead = leads.find(l => l.id === activeChatLeadId) || null;
  const messages = activeChatLeadId ? chatHistory[activeChatLeadId] || [] : [];

  const filteredLeads = leads.filter(l => 
    l.name.toLowerCase().includes(search.toLowerCase()) || 
    l.phone.includes(search)
  );

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeLead || isSending) return;

    const text = inputValue;
    setInputValue("");
    setIsSending(true);

    try {
      // Temporariamente adiciona no UI para ser rápido
      const newMessage: Message = {
        id: Date.now().toString(),
        text: text,
        sender: "human",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: "sent"
      };
      addMessage(activeLead.id, newMessage);

      // Envia via API
      await api.sendText("Gpressi", activeLead.phone, text);
      
      // Atualiza mensagens reais
      await fetchMessages(activeLead.id);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      // ideally add a toast here
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[600px] flex gap-6">
      {/* Sidebar: Chat List */}
      <div className={cn(
        "shrink-0 flex-col glass-card rounded-2xl overflow-hidden border-border-subtle w-full md:w-80",
        activeLead ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 border-b border-border-subtle bg-surface/50">
          <h2 className="font-display font-semibold mb-3">Conversas</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Buscar contatos..." 
              className="pl-9 h-9 text-xs" 
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredLeads.map(lead => (
            <div 
              key={lead.id}
              onClick={() => setActiveChatLead(lead.id)}
              className={cn(
                "p-4 border-b border-border-subtle cursor-pointer transition-colors hover:bg-surface-elevated flex gap-3",
                activeLead?.id === lead.id && "bg-primary/5 hover:bg-primary/5"
              )}
            >
              <div className="h-10 w-10 rounded-full bg-surface-elevated flex items-center justify-center shrink-0 border border-border-subtle text-foreground/70">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-medium text-sm text-foreground truncate pr-2">{lead.name}</p>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">10:06</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground truncate pr-2">Você busca para uso pessoal...</p>
                  {lead.iaStatus !== "Não respondeu" && (
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredLeads.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma conversa encontrada.
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      {activeLead ? (
        <div className="flex-1 flex flex-col glass-card rounded-2xl overflow-hidden border-border-subtle">
          {/* Chat Header */}
          <div className="p-4 border-b border-border-subtle bg-surface/50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button 
                className="md:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:bg-surface-elevated"
                onClick={() => setActiveChatLead(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="h-10 w-10 rounded-full bg-surface-elevated flex items-center justify-center border border-border-subtle">
                <User className="h-5 w-5 text-foreground/70" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm">{activeLead.name}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {activeLead.phone}
                </p>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Button
                variant={activeLead.iaStatus === "Pausado" ? "default" : "outline"}
                size="sm"
                className={cn("h-8 text-xs", activeLead.iaStatus === "Pausado" ? "bg-warning text-warning-foreground hover:bg-warning/90" : "")}
                onClick={() => updateLead(activeLead.id, { iaStatus: activeLead.iaStatus === "Pausado" ? "Aguardando" : "Pausado" })}
              >
                {activeLead.iaStatus === "Pausado" ? <PlayCircle className="h-3.5 w-3.5 mr-1" /> : <PauseCircle className="h-3.5 w-3.5 mr-1" />}
                {activeLead.iaStatus === "Pausado" ? "Retomar IA" : "Pausar IA"}
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/30">
            <div className="text-center mb-6">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-surface px-2 py-1 rounded-md">
                Hoje
              </span>
            </div>
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex w-full", msg.sender === "lead" ? "justify-start" : "justify-end")}>
                <div className={cn(
                  "max-w-[75%] rounded-2xl p-3 relative group",
                  msg.sender === "lead" ? "bg-surface-elevated border border-border-subtle text-foreground rounded-tl-sm" : 
                  msg.sender === "ia" ? "bg-primary/10 border border-primary/20 text-foreground rounded-tr-sm" : 
                  "bg-gradient-primary text-primary-foreground rounded-tr-sm shadow-soft"
                )}>
                  {msg.sender === "ia" && (
                    <div className="flex items-center gap-1 mb-1 opacity-70">
                      <Bot className="h-3 w-3" />
                      <span className="text-[10px] uppercase font-medium tracking-wide">Assistente IA</span>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <div className={cn(
                    "flex items-center justify-end gap-1 mt-1",
                    msg.sender === "human" ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    <span className="text-[10px]">{msg.time}</span>
                    {msg.sender !== "lead" && (
                      msg.status === "read" ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-border-subtle bg-surface/50">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Digite sua mensagem (você assume o controle da IA)..." 
                className="flex-1 bg-background"
              />
              <Button type="submit" disabled={!inputValue.trim() || isSending} className="bg-gradient-primary text-primary-foreground shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center glass-card rounded-2xl border-border-subtle border-dashed border-2">
          <div className="h-16 w-16 rounded-full bg-surface-elevated flex items-center justify-center mb-4 border border-border-subtle">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-display font-medium text-lg">Suas conversas</h3>
          <p className="text-sm text-muted-foreground max-w-sm text-center mt-2">
            Selecione um contato na barra lateral para visualizar o histórico de mensagens e assumir o atendimento da IA.
          </p>
        </div>
      )}
    </div>
  );
}
