import { useState, useEffect } from "react";
import { Plus, Users, Shield, User, Power, ShieldAlert, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UserType {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "attendant";
  active: boolean;
  createdAt: string;
}

const ROLE_MAP: Record<string, { label: string; icon: any; color: string }> = {
  admin: { label: "Administrador", icon: ShieldAlert, color: "text-destructive border-destructive/30 bg-destructive/10" },
  manager: { label: "Gerente", icon: Shield, color: "text-warning border-warning/30 bg-warning/10" },
  attendant: { label: "Atendente", icon: User, color: "text-primary border-primary/30 bg-primary/10" },
};

export default function Equipe() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create">("list");
  
  // Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "attendant">("attendant");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data || []);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) return;
    setCreating(true);
    try {
      await api.createUser({ name, email, passwordHash: password, role, active: true });
      toast.success("Usuário criado com sucesso!");
      setView("list");
      setName(""); setEmail(""); setPassword(""); setRole("attendant");
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar usuário");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(id: string) {
    try {
      await api.deactivateUser(id);
      toast.success("Status atualizado!");
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar status");
    }
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Equipe e Permissões</h2>
            <p className="text-sm text-muted-foreground mt-1">Gerencie os acessos ao painel.</p>
          </div>
          <Button onClick={() => setView("create")} className="bg-gradient-primary text-primary-foreground shadow-glow shrink-0">
            <Plus className="h-4 w-4 mr-2" /> Novo Usuário
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : users.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center border-dashed border-2 border-border-subtle">
            <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="font-display text-lg font-medium">Nenhum usuário</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto mb-4">Cadastre a sua equipe para acessar a plataforma.</p>
          </div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden border border-border-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface/50 border-b border-border-subtle text-xs uppercase text-muted-foreground tracking-wider">
                  <tr>
                    <th className="px-6 py-4 text-left font-medium">Usuário</th>
                    <th className="px-6 py-4 text-left font-medium">Perfil</th>
                    <th className="px-6 py-4 text-left font-medium">Status</th>
                    <th className="px-6 py-4 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {users.map(u => {
                    const r = ROLE_MAP[u.role] || ROLE_MAP.attendant;
                    const Icon = r.icon;
                    return (
                      <tr key={u.id} className="hover:bg-surface/30 transition-colors">
                        <td className="px-6 py-4 align-middle">
                          <p className="font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{u.email}</p>
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium", r.color)}>
                            <Icon className="h-3.5 w-3.5" />
                            {r.label}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center gap-2">
                            <span className={cn("h-2.5 w-2.5 rounded-full", u.active ? "bg-success" : "bg-muted-foreground/30")} />
                            <span className={cn("text-xs font-medium", u.active ? "text-success" : "text-muted-foreground")}>
                              {u.active ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-middle text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn("h-8 gap-2 text-xs", u.active ? "text-destructive hover:text-destructive hover:bg-destructive/10" : "text-success hover:text-success hover:bg-success/10")}
                            onClick={() => handleToggleActive(u.id)}
                          >
                            <Power className="h-3.5 w-3.5" />
                            {u.active ? "Desativar" : "Ativar"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── CREATE VIEW ───────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => setView("list")} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>

      <div className="glass-card rounded-2xl p-6 border-border-subtle space-y-6">
        <div>
          <h3 className="font-display text-xl font-semibold">Novo Usuário</h3>
          <p className="text-sm text-muted-foreground mt-1">Crie um acesso para um membro da equipe.</p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome Completo</Label>
            <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: João Silva" />
          </div>

          <div className="space-y-2">
            <Label>E-mail (Login)</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="joao@empresa.com" />
          </div>

          <div className="space-y-2">
            <Label>Senha Provisória</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" minLength={6} />
          </div>

          <div className="space-y-3 pt-2">
            <Label>Perfil de Acesso</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { key: "admin", label: "Administrador", desc: "Acesso total a IA, Disparos e Configs", icon: ShieldAlert, color: "border-destructive/30 text-destructive bg-destructive/5" },
                { key: "manager", label: "Gerente", desc: "CRM, Contatos e Disparos", icon: Shield, color: "border-warning/30 text-warning bg-warning/5" },
                { key: "attendant", label: "Atendente", desc: "Apenas Chat e CRM", icon: User, color: "border-primary/30 text-primary bg-primary/5" },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRole(opt.key)}
                  className={cn(
                    "flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all",
                    role === opt.key ? opt.color : "border-border-subtle text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                  )}
                >
                  <opt.icon className="h-5 w-5" />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-[10px] mt-0.5 opacity-80 leading-tight">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={creating} className="bg-gradient-primary text-primary-foreground shadow-glow min-w-[150px]">
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Criar Usuário"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
