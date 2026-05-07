import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  contact?: any; // Se fornecido, entra em modo de edição
}

export function ContactModal({ open, onOpenChange, onSuccess, contact }: ContactModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    companyName: "",
    jobTitle: "",
  });

  const isEditing = !!contact;

  useEffect(() => {
    if (contact && open) {
      setFormData({
        name: contact.name || "",
        phone: contact.phone || "",
        email: contact.email || "",
        companyName: contact.companyName || "",
        jobTitle: contact.jobTitle || "",
      });
    } else if (!open) {
      // Reset ao fechar
      setFormData({ name: "", phone: "", email: "", companyName: "", jobTitle: "" });
    }
  }, [contact, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error("Nome e Telefone são obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        await api.updateContact(contact.id, formData);
        toast.success("Contato atualizado com sucesso!");
      } else {
        await api.createContact(formData);
        toast.success("Contato criado com sucesso!");
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || `Erro ao ${isEditing ? 'atualizar' : 'criar'} contato`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border-subtle sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isEditing ? "Editar Contato" : "Novo Contato"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo *</Label>
            <Input
              id="name"
              placeholder="Ex: João Silva"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp (com DDD) *</Label>
            <Input
              id="phone"
              placeholder="Ex: 11999998888"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Se omitido, o DDI 55 (Brasil) será adicionado automaticamente.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="joao@empresa.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Empresa</Label>
              <Input
                id="companyName"
                placeholder="Empresa Ltda"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Cargo</Label>
              <Input
                id="jobTitle"
                placeholder="Diretor"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-gradient-primary text-primary-foreground shadow-glow" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : isEditing ? "Salvar Alterações" : "Criar Contato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
