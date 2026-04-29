import { create } from "zustand";

export type Temperature = "Frio" | "Morno" | "Quente";
export type StageId =
  | "novo"
  | "abordado"
  | "respondeu"
  | "qualificado"
  | "aguardando"
  | "proposta"
  | "fechado"
  | "perdido";

export interface Lead {
  id: string;
  name: string;
  role?: string;
  company?: string;
  phone: string;
  email: string;
  linkedin?: string;
  origin: string;
  tags: string[];
  crm: string;
  stage: StageId;
  status: string; // human-readable
  iaStatus: string;
  temperature: Temperature;
  lastInteraction: string;
}

export interface AIConfig {
  internalName: string;
  displayName: string;
  company: string;
  segment: string;
  product: string;
  audience: string;
  problem: string;
  benefit: string;
  tone: "Profissional" | "Consultivo" | "Amigável" | "Direto" | "Premium";
  goal: string;
  bant: { budget: string; authority: string; need: string; timeline: string };
  criteria: string;
  instructions: string;
  built: boolean;
}

export interface Connections {
  official: "disconnected" | "connecting" | "pending";
  evolution: "disconnected" | "connecting" | "pending";
}

interface Store {
  ai: AIConfig;
  setAI: (patch: Partial<AIConfig>) => void;
  markBuilt: () => void;

  connections: Connections;
  setConnection: (key: keyof Connections, value: Connections[keyof Connections]) => void;

  leads: Lead[];
  addLeads: (leads: Lead[]) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  bulkUpdate: (ids: string[], patch: Partial<Lead>) => void;
  moveLead: (id: string, stage: StageId) => void;
}

const defaultAI: AIConfig = {
  internalName: "",
  displayName: "",
  company: "",
  segment: "",
  product: "",
  audience: "",
  problem: "",
  benefit: "",
  tone: "Consultivo",
  goal: "",
  bant: {
    budget: "Pergunte de forma natural se ele já investe ou tem previsão de investimento para resolver esse problema.",
    authority: "Pergunte se ele é responsável pela decisão ou se existe outra pessoa envolvida.",
    need: "Pergunte qual é o principal desafio atual e o impacto desse problema no negócio.",
    timeline: "Pergunte em quanto tempo ele pretende resolver esse problema ou iniciar uma solução.",
  },
  criteria: "",
  instructions: "",
  built: false,
};

const seedLeads: Lead[] = [
  {
    id: "l1",
    name: "Mariana Costa",
    role: "Dentista",
    company: "Clínica Costa",
    phone: "+55 11 98765-4321",
    email: "mariana@email.com",
    linkedin: "/in/marianacosta",
    origin: "LinkedIn",
    tags: ["Dentistas SP"],
    crm: "Pipeline Comercial",
    stage: "novo",
    status: "Novo",
    iaStatus: "Aguardando abordagem",
    temperature: "Morno",
    lastInteraction: "Há 2 horas",
  },
  {
    id: "l2",
    name: "Rafael Lima",
    role: "Diretor",
    company: "Odonto Prime",
    phone: "+55 11 91234-5678",
    email: "rafael@email.com",
    linkedin: "/in/rafaellima",
    origin: "LinkedIn",
    tags: ["Clínicas"],
    crm: "Pipeline Comercial",
    stage: "respondeu",
    status: "Em conversa",
    iaStatus: "Em qualificação",
    temperature: "Quente",
    lastInteraction: "Há 14 minutos",
  },
  {
    id: "l3",
    name: "Camila Rocha",
    role: "Sócia",
    company: "Clínica Rocha",
    phone: "+55 11 99888-1122",
    email: "camila@email.com",
    linkedin: "/in/camilarocha",
    origin: "LinkedIn",
    tags: ["Odonto SP"],
    crm: "Pipeline Comercial",
    stage: "aguardando",
    status: "Qualificado",
    iaStatus: "Aguardando proposta",
    temperature: "Quente",
    lastInteraction: "Ontem",
  },
  {
    id: "l4",
    name: "Eduardo Martins",
    role: "CEO",
    company: "Smile Group",
    phone: "+55 21 99888-7766",
    email: "edu@smilegroup.com",
    origin: "LinkedIn",
    tags: ["Decisor"],
    crm: "Pipeline Comercial",
    stage: "abordado",
    status: "Template enviado",
    iaStatus: "Aguardando resposta",
    temperature: "Morno",
    lastInteraction: "Há 1 hora",
  },
  {
    id: "l5",
    name: "Patrícia Alves",
    role: "Gestora",
    company: "Orto Vida",
    phone: "+55 31 91234-5678",
    email: "patricia@ortovida.com",
    origin: "LinkedIn",
    tags: ["Ortodontia"],
    crm: "Pipeline Comercial",
    stage: "qualificado",
    status: "BANT completo",
    iaStatus: "Pronto para vendedor",
    temperature: "Quente",
    lastInteraction: "Há 30 minutos",
  },
  {
    id: "l6",
    name: "Lucas Ferreira",
    role: "Diretor Comercial",
    company: "Dental Plus",
    phone: "+55 11 95555-1010",
    email: "lucas@dentalplus.com",
    origin: "LinkedIn",
    tags: ["Clínicas"],
    crm: "Pipeline Comercial",
    stage: "proposta",
    status: "Proposta enviada",
    iaStatus: "Aguardando retorno",
    temperature: "Quente",
    lastInteraction: "Há 3 dias",
  },
  {
    id: "l7",
    name: "Renata Souza",
    role: "Sócia",
    company: "Estética Bella",
    phone: "+55 41 98888-2020",
    email: "renata@bella.com",
    origin: "LinkedIn",
    tags: ["Estética"],
    crm: "Pipeline Comercial",
    stage: "fechado",
    status: "Cliente",
    iaStatus: "Negócio fechado",
    temperature: "Quente",
    lastInteraction: "Semana passada",
  },
  {
    id: "l8",
    name: "Bruno Tavares",
    role: "Dentista",
    company: "Sorriso Real",
    phone: "+55 51 97777-3030",
    email: "bruno@sorrisoreal.com",
    origin: "LinkedIn",
    tags: ["Dentistas"],
    crm: "Pipeline Comercial",
    stage: "perdido",
    status: "Sem interesse",
    iaStatus: "Não respondeu",
    temperature: "Frio",
    lastInteraction: "Há 2 semanas",
  },
];

export const useApp = create<Store>((set) => ({
  ai: defaultAI,
  setAI: (patch) => set((s) => ({ ai: { ...s.ai, ...patch, bant: { ...s.ai.bant, ...(patch.bant || {}) } } })),
  markBuilt: () => set((s) => ({ ai: { ...s.ai, built: true } })),

  connections: { official: "disconnected", evolution: "disconnected" },
  setConnection: (key, value) =>
    set((s) => ({ connections: { ...s.connections, [key]: value } })),

  leads: seedLeads,
  addLeads: (leads) => set((s) => ({ leads: [...leads, ...s.leads] })),
  updateLead: (id, patch) =>
    set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
  bulkUpdate: (ids, patch) =>
    set((s) => ({
      leads: s.leads.map((l) =>
        ids.includes(l.id)
          ? { ...l, ...patch, tags: patch.tags ? Array.from(new Set([...l.tags, ...patch.tags])) : l.tags }
          : l,
      ),
    })),
  moveLead: (id, stage) =>
    set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, stage } : l)) })),
}));

export const STAGES: { id: StageId; title: string; description: string; accent: string }[] = [
  { id: "novo", title: "Novo lead", description: "Leads recém-criados ou importados.", accent: "hsl(200 95% 60%)" },
  { id: "abordado", title: "Foi abordado", description: "Receberam a primeira abordagem oficial.", accent: "hsl(258 90% 70%)" },
  { id: "respondeu", title: "Respondeu abordagem", description: "Responderam à abordagem inicial.", accent: "hsl(165 65% 50%)" },
  { id: "qualificado", title: "Qualificado", description: "Passaram pelos critérios BANT.", accent: "hsl(145 100% 60%)" },
  { id: "aguardando", title: "Aguardando proposta", description: "Precisam da ação manual do vendedor.", accent: "hsl(38 92% 60%)" },
  { id: "proposta", title: "Proposta enviada", description: "Receberam uma proposta comercial.", accent: "hsl(280 80% 65%)" },
  { id: "fechado", title: "Fechado", description: "Clientes que fecharam negócio.", accent: "hsl(145 65% 50%)" },
  { id: "perdido", title: "Perdido", description: "Leads que não avançaram.", accent: "hsl(0 60% 55%)" },
];
