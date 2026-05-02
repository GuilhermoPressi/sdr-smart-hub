import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Phone, Mail, MessageCircle, Globe, MapPin } from "lucide-react";
import { useApp, Lead, STAGES } from "@/store/app";
import { useNavigate } from "react-router-dom";

export function ContactDetailsSheet({ 
  viewingContact, 
  setViewingContact 
}: { 
  viewingContact: Lead | null; 
  setViewingContact: (lead: Lead | null) => void;
}) {
  const navigate = useNavigate();
  const { setActiveChatLead } = useApp();

  const statusVariant = (status: string) => {
    switch (status) {
      case "Ganho": return "success";
      case "Perdido": return "danger";
      case "Novo": return "info";
      default: return "warning";
    }
  };

  return (
    <Sheet open={!!viewingContact} onOpenChange={(open) => !open && setViewingContact(null)}>
      <SheetContent className="bg-background border-l border-border-subtle sm:max-w-md w-full overflow-y-auto z-[1000]">
        {viewingContact && (
          <div className="space-y-8 mt-6">
            <SheetHeader className="text-left">
              <SheetTitle className="font-display text-xl">{viewingContact.name}</SheetTitle>
              <div className="text-sm text-muted-foreground">{viewingContact.jobTitle || "Sem cargo"} • {viewingContact.companyName || "Sem empresa"}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge variant={statusVariant(viewingContact.status)} dot>{viewingContact.status}</StatusBadge>
                <StatusBadge variant="info">{viewingContact.origin}</StatusBadge>
                <StatusBadge variant="warning">{viewingContact.iaStatus}</StatusBadge>
              </div>
              <Button 
                className="mt-4 w-full bg-gradient-primary text-primary-foreground shadow-glow"
                onClick={() => {
                  setActiveChatLead(viewingContact.id);
                  setViewingContact(null);
                  navigate("/conversas");
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Abrir Conversa
              </Button>
            </SheetHeader>

            <div className="space-y-6">
              <div>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Contato</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-surface-elevated flex items-center justify-center text-primary"><Phone className="h-4 w-4" /></div>
                    <span className="font-mono">{viewingContact.phone}</span>
                  </div>
                  {viewingContact.email && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-surface-elevated flex items-center justify-center text-primary"><Mail className="h-4 w-4" /></div>
                      <span>{viewingContact.email}</span>
                    </div>
                  )}
                  {viewingContact.website && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-surface-elevated flex items-center justify-center text-primary"><Globe className="h-4 w-4" /></div>
                      <a href={viewingContact.website} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate max-w-[200px]">
                        {viewingContact.website.replace(/https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {(viewingContact.address || viewingContact.city || viewingContact.state) && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-surface-elevated flex items-center justify-center text-primary"><MapPin className="h-4 w-4" /></div>
                      <span className="truncate max-w-[200px]">
                        {[viewingContact.address, viewingContact.city, viewingContact.state].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Status de Vendas</h4>
                <div className="bg-surface-elevated p-4 rounded-xl border border-border-subtle space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pipeline CRM:</span>
                    <span className="font-medium text-foreground text-right">{viewingContact.crm || "Nenhum"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Etapa Atual:</span>
                    <span className="font-medium text-foreground text-right">{STAGES.find(s => s.id === viewingContact.stage)?.title || viewingContact.stage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Temperatura:</span>
                    <span className="font-medium text-foreground text-right">{viewingContact.temperature}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Última Interação:</span>
                    <span className="font-medium text-foreground text-right">{viewingContact.lastInteraction}</span>
                  </div>
                </div>
              </div>

              {viewingContact.tags.length > 0 && (
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingContact.tags.map(t => <StatusBadge key={t} variant="accent">{t}</StatusBadge>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
