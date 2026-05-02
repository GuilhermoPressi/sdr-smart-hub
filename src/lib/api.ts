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
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = Array.isArray(body?.message) ? body.message.join(', ') : (body?.message || `Erro ${res.status}`);
    throw new Error(msg);
  }
  return res.json();
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
};

// Retrocompat para código que ainda usa evolutionApi
export const evolutionApi = api;
