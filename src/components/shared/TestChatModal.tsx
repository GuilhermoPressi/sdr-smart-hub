import { useState, useRef, useEffect } from "react";
import { Bot, User, Send, X, RotateCcw, Loader2, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";

interface TestChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiId: string;
  aiName: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function TestChatModal({ open, onOpenChange, aiId, aiName }: TestChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string>("boas_vindas"); // Fallback initial stage
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get the AI from store to know the first stage
  const ai = useApp(s => s.agents.find(a => a.id === aiId) || s.ai);

  useEffect(() => {
    if (open) {
      const firstStage = ai?.conversationFlow?.[0]?.id || "boas_vindas";
      setStage(firstStage);
      setMessages([]);
      setInput("");
    }
  }, [open, ai]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;

    const newMsg: ChatMessage = { role: "user", content: text };
    const currentHistory = [...messages];
    
    setMessages(prev => [...prev, newMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await api.testAiChat(aiId, {
        message: text,
        history: currentHistory,
        stage: stage,
      });

      if (response && response.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: response.reply }]);
        if (response.stage) {
          setStage(response.stage);
        }
      } else {
        throw new Error("Resposta vazia");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar resposta da IA");
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Ocorreu um erro ao processar a resposta." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    const firstStage = ai?.conversationFlow?.[0]?.id || "boas_vindas";
    setStage(firstStage);
  };

  const suggestions = [
    "Oi, quero saber mais",
    "Quanto custa?",
    "Quero falar com um atendente",
    "Como funciona?",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden glass-card border-border-subtle">
        
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border-subtle bg-surface/50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-primary grid place-items-center shadow-glow shrink-0">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <DialogTitle className="font-display text-base">Teste: {aiName}</DialogTitle>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface border border-border-subtle">
                    <span className="font-medium text-foreground">Etapa:</span> {stage}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleClear} title="Reiniciar conversa" className="h-8 w-8">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/50">
          
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-70 animate-fade-in">
              <div className="h-12 w-12 rounded-2xl bg-surface border border-border-subtle grid place-items-center mb-4">
                <Bot className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">Simulador de IA</p>
              <p className="text-xs text-muted-foreground max-w-[250px] mb-6">
                Envie uma mensagem para testar como sua IA responde baseada nas configurações e regras.
              </p>
              
              <div className="flex flex-wrap justify-center gap-2 max-w-[300px]">
                {suggestions.map(s => (
                  <button 
                    key={s}
                    onClick={() => handleSend(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border-subtle bg-surface hover:bg-surface/80 hover:text-primary transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex w-full", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "flex max-w-[80%] gap-2",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}>
                <div className={cn(
                  "h-8 w-8 rounded-full grid place-items-center shrink-0 mt-auto",
                  msg.role === "user" ? "bg-primary/20 text-primary" : "bg-gradient-primary text-primary-foreground shadow-glow"
                )}>
                  {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={cn(
                  "px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap shadow-soft",
                  msg.role === "user" 
                    ? "bg-primary text-primary-foreground rounded-br-sm" 
                    : "bg-surface border border-border-subtle rounded-bl-sm"
                )}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex w-full justify-start">
              <div className="flex max-w-[80%] gap-2 flex-row">
                <div className="h-8 w-8 rounded-full bg-gradient-primary text-primary-foreground shadow-glow grid place-items-center shrink-0 mt-auto">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-surface border border-border-subtle rounded-bl-sm flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-surface/50 border-t border-border-subtle shrink-0">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite uma mensagem para testar..."
              className="bg-background border-border-subtle focus-visible:ring-primary/50"
              disabled={loading}
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={!input.trim() || loading}
              className="bg-gradient-primary text-primary-foreground shrink-0 shadow-glow"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <Info className="h-3 w-3" />
            Esta conversa é apenas para teste e não salva contatos no CRM.
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
