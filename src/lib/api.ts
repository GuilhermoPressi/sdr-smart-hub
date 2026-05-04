const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || 'https://api.sdr.grupogpressi.com.br').replace(/\/$/, '');

// ── Types ─────────────────────────────────────────────────────────────────

export interface SearchLeadsPayload { query: string; limit: number; }

export interface LeadResult {
  name: string; phone: string; phone_normalized: string; has_whatsapp: boolean;
  email: string; website: string; city: string; state: string; address: string;
  category: string; score: number | null; reviewsCount: number | null; profileUrl: string;
}

export interface SearchLeadsResponse {
  searchId: string; query: string; totalFound: number;
  totalImported: number; totalDuplicates: number; duration: number;
  reachedTarget: boolean; results: LeadResult[];
}

export interface ImportLeadsResponse {
  searchId: string; totalImported: number; totalDuplicates: number;
}

export interface ApifyLeadSearch {
  id: string; source: string; query: string; status: string;
  totalFound: number; totalImported: number; error?: string; createdAt: string;
}

// ── Core request ──────────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}/api/v1${path}`;
  
  // Pegar o token do store (precisamos fazer import dinâmico para evitar circular dependency caso useApp importe api.ts)
  let token = null;
  try {
    const storeStr = localStorage.getItem('leadflow-store');
    if (storeStr) {
      const parsed = JSON.parse(storeStr);
      token = parsed?.state?.token;
    }
  } catch {}

  const headers: any = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  
  if (!res.ok) {
    if (res.status === 401 && window.location.pathname !== '/login') {
      // Force logout on frontend
      localStorage.removeItem('leadflow-store');
      window.location.href = '/login';
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    const body = await res.json().catch(() => ({}));
    const msg = Array.isArray(body?.message) ? body.message.join(', ') : (body?.message || `Erro ${res.status}`);
    throw new Error(msg);
  }
  
  // Handle empty responses (204 No Content or empty body)
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text);
}

// ── API unificada (tudo em um objeto, import estático) ────────────────────

export const api = {
  // Apify Leads
  searchLeads: (payload: SearchLeadsPayload) =>
    request<SearchLeadsResponse>('/apify-leads/search', { method: 'POST', body: JSON.stringify(payload) }),
  importLeads: (searchId: string) =>
    request<ImportLeadsResponse>(`/apify-leads/import/${searchId}`, { method: 'POST' }),
  getSearchHistory: () => request<ApifyLeadSearch[]>('/apify-leads/searches'),
  getSearchById: (id: string) => request<ApifyLeadSearch>(`/apify-leads/searches/${id}`),

  // AI Config
  getAiConfigs: () => request<any[]>('/ai-config'),
  getActiveAiConfig: () => request<any>('/ai-config/active'),
  saveAiConfig: (data: any) => {
    // Limpa campos que são APENAS do frontend (não existem no backend)
    const { id, built, goalPreset, evolutionInitialMsg, ...clean } = data;
    // UUID válido = 36 chars com hífens
    const isValidId = id && typeof id === 'string' && id.length === 36 && id.includes('-');
    const payload = { ...clean, tone: clean.tone || 'Profissional' };
    if (isValidId) {
      console.log('[AI] Atualizando config:', id, payload);
      return request<any>(`/ai-config/${id}`, { method: 'PUT', body: JSON.stringify({ ...payload, id }) });
    }
    console.log('[AI] Criando nova config:', payload);
    return request<any>('/ai-config', { method: 'POST', body: JSON.stringify(payload) });
  },
  activateAiConfig: (id: string) =>
    request<any>(`/ai-config/${id}/activate`, { method: 'PATCH' }),
  deactivateAiConfig: (id: string) =>
    request<any>(`/ai-config/${id}/deactivate`, { method: 'PATCH' }),
  deleteAiConfig: (id: string) =>
    request<any>(`/ai-config/${id}`, { method: 'DELETE' }),

  // Contacts
  getContacts: () => request<any[]>('/contacts'),
  getConversations: () => request<any[]>('/contacts/conversations'),
  markAsRead: (contactId: string) => request<any>(`/messages/contact/${contactId}/read`, { method: 'POST' }),
  getContact: (id: string) => request<any>(`/contacts/${id}`),
  updateContact: (id: string, data: Record<string, any>) =>
    request<any>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Messages
  getMessages: (contactId: string, limit = 50) =>
    request<any[]>(`/messages/contact/${contactId}?limit=${limit}`),

  // Evolution / WhatsApp
  sendText: (instanceName: string, phone: string, text: string) =>
    request<any>('/evolution/send-text', { method: 'POST', body: JSON.stringify({ instanceName, phone, text }) }),
  createInstance: (instanceName: string) =>
    request<any>('/evolution/instances', { method: 'POST', body: JSON.stringify({ instanceName }) }),
  listInstances: () => request<any[]>('/evolution/instances'),
  getQrCode: (instanceName: string) => request<any>(`/evolution/instances/${instanceName}/qrcode`),
  getInstanceStatus: (instanceName: string) => request<any>(`/evolution/instances/${instanceName}/status`),
  deleteInstance: (instanceName: string) =>
    request<any>(`/evolution/instances/${instanceName}`, { method: 'DELETE' }),

  // Campaigns (Disparos)
  getCampaigns: () => request<any[]>('/campaigns'),
  getCampaign: (id: string) => request<any>(`/campaigns/${id}`),
  getCampaignRecipients: (id: string) => request<any[]>(`/campaigns/${id}/recipients`),
  createCampaign: (data: any) =>
    request<any>('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  startCampaign: (id: string) =>
    request<any>(`/campaigns/${id}/start`, { method: 'PATCH' }),
  pauseCampaign: (id: string) =>
    request<any>(`/campaigns/${id}/pause`, { method: 'PATCH' }),

  // Auth & Users
  login: (data: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getUsers: () => request<any[]>('/users'),
  createUser: (data: any) => request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => request<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deactivateUser: (id: string) => request<any>(`/users/${id}/deactivate`, { method: 'PATCH' }),
};

// Retrocompat para código que ainda usa evolutionApi
export const evolutionApi = api;
