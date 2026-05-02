import { create } from "zustand";

export type Temperature = "Frio" | "Morno" | "Quente";
export type StageId =
  | "novo"
  | "envio"
  | "respondeu"
  | "atendimento_ia"
  | "qualificado"
  | "atendimento_humano"
  | "orcamento"
  | "followup"
  | "ganho"
  | "perdido";

export interface Message {
  id: string;
  text: string;
  sender: "lead" | "ia" | "human";
  time: string;
  status?: "sent" | "delivered" | "read";
}

export interface Lead {
  id: string;
  name: string;
  jobTitle?: string;
  companyName?: string;
  phone: string;
  email: string;
  profileUrl?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  category?: string;
  username?: string;
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
  id: string;
  displayName: string;
  internalName: string;
  company: string;
  segment: string;
  region: string;
  product: string;
  audience: string;
  problem: string;
  benefit: string;
  differentials: string;
  pricingFactors: string;
  tone: "Profissional" | "Consultivo" | "Amigável" | "Direto" | "Premium";
  formality: "Informal" | "Equilibrado" | "Formal";
  responseLength: "Curtas" | "Médias" | "Detalhadas";
  initialMessage: string;
  goalPreset: string;
  goal: string;
  qualifiedCriteria: string;
  discovery: {
    need: string;
    timeline: string;
    investment: string;
    authority: string;
    quotationData: string;
  };
  neverPromise: string;
  neverAsk: string;
  instructions: string;
  built: boolean;
}

export interface Connections {
  official: "disconnected" | "connecting" | "pending";
  evolution: "disconnected" | "connecting" | "pending";
}

export interface FlowConfig {
  officialInitialMsg: string;
  officialTransitionMsg: string;
  evolutionInitialMsg: string;
  noResponseTimeout: number; // hours
  noResponseAction: "novo" | "followup" | "perdido";
  pauseOnHumanReply: boolean;
  qualifiedStage: StageId;
}

interface Store {
  ai: AIConfig;
  setAI: (patch: Partial<AIConfig>) => void;
  markBuilt: () => void;

  agents: AIConfig[];
  saveAgent: (agent: AIConfig) => void;
  deleteAgent: (id: string) => void;
  resetAI: () => void;

  flow: FlowConfig;
  setFlow: (patch: Partial<FlowConfig>) => void;
  connections: { official: "disconnected" | "connecting" | "pending"; evolution: "disconnected" | "connecting" | "pending" };
  setConnection: (key: "official" | "evolution", val: "disconnected" | "connecting" | "pending") => void;

  leads: Lead[];
  addLeads: (leads: Lead[]) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  bulkUpdate: (ids: string[], patch: Partial<Lead>) => void;
  moveLead: (id: string, stage: StageId) => void;
  fetchLeads: () => Promise<void>;

  chatHistory: Record<string, Message[]>;
  addMessage: (leadId: string, msg: Message) => void;
  fetchMessages: (leadId: string) => Promise<void>;
  activeChatLeadId: string | null;
  setActiveChatLead: (id: string | null) => void;
}

const defaultAI: AIConfig = {
  id: "",
  displayName: "",
  internalName: "",
  company: "",
  segment: "",
  region: "",
  product: "",
  audience: "",
  problem: "",
  benefit: "",
  differentials: "",
  pricingFactors: "",
  tone: "Consultivo",
  formality: "Equilibrado",
  responseLength: "Curtas",
  initialMessage: "",
  goalPreset: "",
  goal: "",
  qualifiedCriteria: "",
  discovery: {
    need: "Pergunte qual é o principal desafio atual e o que o lead quer resolver.",
    timeline: "Pergunte em quanto tempo ele pretende resolver isso ou iniciar a solução.",
    investment: "Pergunte de forma natural se ele já tem uma previsão de investimento ou se ainda está levantando valores.",
    authority: "Pergunte se ele mesmo decide ou se existem outras pessoas envolvidas na decisão.",
    quotationData: "",
  },
  neverPromise: "",
  neverAsk: "",
  instructions: "",
  built: false,
};

const seedLeads: Lead[] = [
  {
    id: "l1",
    name: "Mariana Costa",
    jobTitle: "Dentista",
    companyName: "Clínica Costa",
    phone: "+55 11 98765-4321",
    email: "mariana@email.com",
    profileUrl: "https://linkedin.com/in/marianacosta",
    city: "São Paulo",
    state: "SP",
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
    jobTitle: "Diretor",
    companyName: "Odonto Prime",
    phone: "+55 11 91234-5678",
    email: "rafael@email.com",
    profileUrl: "https://linkedin.com/in/rafaellima",
    city: "Campinas",
    state: "SP",
    origin: "LinkedIn",
    tags: ["Clínicas"],
    crm: "Pipeline Comercial",
    stage: "atendimento_ia",
    status: "Em conversa",
    iaStatus: "Em qualificação",
    temperature: "Quente",
    lastInteraction: "Há 14 minutos",
  },
  {
    id: "l3",
    name: "Camila Rocha",
    jobTitle: "Sócia",
    companyName: "Clínica Rocha",
    phone: "+55 11 99888-1122",
    email: "camila@email.com",
    profileUrl: "https://linkedin.com/in/camilarocha",
    city: "Ribeirão Preto",
    state: "SP",
    origin: "LinkedIn",
    tags: ["Odonto SP"],
    crm: "Pipeline Comercial",
    stage: "atendimento_humano",
    status: "Qualificado",
    iaStatus: "Vendedor assumiu",
    temperature: "Quente",
    lastInteraction: "Ontem",
  },
  {
    id: "l4",
    name: "Eduardo Martins",
    jobTitle: "CEO",
    companyName: "Smile Group",
    phone: "+55 21 99888-7766",
    email: "edu@smilegroup.com",
    profileUrl: "https://linkedin.com/in/edumartins",
    city: "Rio de Janeiro",
    state: "RJ",
    origin: "LinkedIn",
    tags: ["Decisor"],
    crm: "Pipeline Comercial",
    stage: "envio",
    status: "Mensagem enviada",
    iaStatus: "Aguardando resposta",
    temperature: "Morno",
    lastInteraction: "Há 1 hora",
  },
  {
    id: "l5",
    name: "Patrícia Alves",
    jobTitle: "Gestora",
    companyName: "Orto Vida",
    phone: "+55 31 91234-5678",
    email: "patricia@ortovida.com",
    profileUrl: "https://linkedin.com/in/patalves",
    city: "Belo Horizonte",
    state: "MG",
    origin: "LinkedIn",
    tags: ["Ortodontia"],
    crm: "Pipeline Comercial",
    stage: "qualificado",
    status: "Lead qualificado",
    iaStatus: "Pronto para vendedor",
    temperature: "Quente",
    lastInteraction: "Há 30 minutos",
  },
  {
    id: "l6",
    name: "Lucas Ferreira",
    jobTitle: "Diretor Comercial",
    companyName: "Dental Plus",
    phone: "+55 11 95555-1010",
    email: "lucas@dentalplus.com",
    profileUrl: "https://linkedin.com/in/lucasferreira",
    city: "Osasco",
    state: "SP",
    origin: "LinkedIn",
    tags: ["Clínicas"],
    crm: "Pipeline Comercial",
    stage: "orcamento",
    status: "Orçamento enviado",
    iaStatus: "Aguardando retorno",
    temperature: "Quente",
    lastInteraction: "Há 3 dias",
  },
  {
    id: "l7",
    name: "Renata Souza",
    jobTitle: "Sócia",
    companyName: "Estética Bella",
    phone: "+55 41 98888-2020",
    email: "renata@bella.com",
    profileUrl: "https://instagram.com/esteticabella",
    city: "Curitiba",
    state: "PR",
    origin: "LinkedIn",
    tags: ["Estética"],
    crm: "Pipeline Comercial",
    stage: "ganho",
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

const defaultFlow: FlowConfig = {
  officialInitialMsg: "Olá, tudo bem? Aqui é da equipe {{nome_empresa}}. Vi seu interesse em {{produto_servico}} e queria entender melhor sua necessidade para te direcionar corretamente.",
  officialTransitionMsg: "Perfeito. Vou continuar seu atendimento por outro número para facilitar a conversa, tudo bem?",
  evolutionInitialMsg: "Oi, aqui é {{nome_ia}}, da {{nome_empresa}}. Falei com você pelo outro número e vou seguir por aqui para te atender melhor. Me conta rapidinho: o que você está buscando resolver nesse momento?",
  noResponseTimeout: 24,
  noResponseAction: "novo",
  pauseOnHumanReply: true,
  qualifiedStage: "qualificado",
};

export const useApp = create<Store>((set) => ({
  ai: defaultAI,
  setAI: (patch) => set((s) => ({ ai: { ...s.ai, ...patch, discovery: { ...s.ai.discovery, ...(patch.discovery || {}) } } })),
  markBuilt: () => set((s) => ({ ai: { ...s.ai, built: true } })),

  agents: [],
  saveAgent: (agent) => set((s) => {
    const exists = s.agents.some(a => a.id === agent.id);
    if (exists) {
      return { agents: s.agents.map(a => a.id === agent.id ? agent : a) };
    }
    return { agents: [...s.agents, agent] };
  }),
  deleteAgent: (id) => set((s) => ({ agents: s.agents.filter(a => a.id !== id) })),
  resetAI: () => set({ ai: defaultAI }),

  flow: defaultFlow,
  setFlow: (patch) => set((s) => ({ flow: { ...s.flow, ...patch } })),

  connections: { official: "disconnected", evolution: "disconnected" },
  setConnection: (key, value) =>
    set((s) => ({ connections: { ...s.connections, [key]: value } })),

  leads: seedLeads,
  addLeads: (leads) => set((s) => ({ leads: [...leads, ...s.leads] })),
  updateLead: (id, patch) => {
    set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
    import("@/lib/api").then(({ api }) => {
      api.updateContact(id, patch).catch(console.error);
    });
  },
  bulkUpdate: (ids, patch) =>
    set((s) => ({
      leads: s.leads.map((l) =>
        ids.includes(l.id)
          ? { ...l, ...patch, tags: patch.tags ? Array.from(new Set([...l.tags, ...patch.tags])) : l.tags }
          : l,
      ),
    })),
  moveLead: (id, stage) => {
    set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, stage } : l)) }));
    import("@/lib/api").then(({ api }) => {
      api.updateContact(id, { stage }).catch(console.error);
    });
  },
  fetchLeads: async () => {
    const { api } = await import("@/lib/api");
    try {
      const contacts = await api.getContacts();
      if (contacts && contacts.length > 0) {
        set({ leads: contacts.map(c => ({
          ...c,
          temperature: c.temperature || "Frio",
          stage: c.stage || "novo",
          status: c.status || "Novo",
          iaStatus: c.iaStatus || "Aguardando",
          tags: c.tags || [],
        })) });
      }
    } catch (e) {
      console.error("Failed to fetch leads", e);
    }
  },

  chatHistory: {
    "1": [
      { id: "msg1", text: "Olá! Gostaria de saber mais sobre os serviços.", sender: "lead", time: "10:00" },
      { id: "msg2", text: "Olá! Tudo bem? Aqui é a Assistente da empresa. Como posso ajudar?", sender: "ia", time: "10:01", status: "read" },
      { id: "msg3", text: "Qual o valor do produto X?", sender: "lead", time: "10:05" },
      { id: "msg4", text: "O valor pode variar conforme a necessidade. Você busca para uso pessoal ou empresarial?", sender: "ia", time: "10:06", status: "read" }
    ]
  },
  addMessage: (leadId, msg) => set((s) => ({
    chatHistory: { ...s.chatHistory, [leadId]: [...(s.chatHistory[leadId] || []), msg] }
  })),
  fetchMessages: async (leadId) => {
    const { api } = await import("@/lib/api");
    try {
      const msgs = await api.getMessages(leadId);
      if (msgs && msgs.length > 0) {
        set((s) => ({
          chatHistory: {
            ...s.chatHistory,
            [leadId]: msgs.map((m: any) => ({
              id: m.id,
              text: m.text,
              sender: m.sender,
              time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: m.status,
            }))
          }
        }));
      }
    } catch (e) {
      console.error("Failed to fetch messages", e);
    }
  },
  activeChatLeadId: null,
  setActiveChatLead: (id) => set({ activeChatLeadId: id }),
}));

export const STAGES: { id: StageId; title: string; description: string; accent: string }[] = [
  { id: "novo",              title: "Novo Lead",             description: "Leads cadastrados ou importados.",                          accent: "hsl(200 95% 60%)" },
  { id: "envio",             title: "Envio de Mensagem",     description: "Aguardando envio ou resposta da mensagem oficial.",        accent: "hsl(258 90% 70%)" },
  { id: "respondeu",         title: "Respondeu Abordagem",   description: "Responderam à mensagem da API Oficial.",                  accent: "hsl(165 65% 50%)" },
  { id: "atendimento_ia",    title: "Em Atendimento IA",     description: "A IA SDR está conversando com o lead.",                   accent: "hsl(38 92% 60%)" },
  { id: "qualificado",       title: "Lead Qualificado",      description: "A IA cumpriu o objetivo. Vendedor humano deve assumir.", accent: "hsl(145 100% 60%)" },
  { id: "atendimento_humano",title: "Atendimento Humano",    description: "Vendedor está atendendo manualmente.",                    accent: "hsl(280 80% 65%)" },
  { id: "orcamento",         title: "Orçamento Enviado",     description: "Proposta ou orçamento foi enviado.",                      accent: "hsl(30 90% 55%)" },
  { id: "followup",          title: "Follow-up",             description: "Leads que precisam de acompanhamento.",                   accent: "hsl(50 90% 55%)" },
  { id: "ganho",             title: "Ganho",                 description: "Venda fechada com sucesso.",                              accent: "hsl(145 65% 50%)" },
  { id: "perdido",           title: "Perdido",               description: "Oportunidade perdida.",                                   accent: "hsl(0 60% 55%)" },
];
