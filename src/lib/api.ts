const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || 'https://api.sdr.grupogpressi.com.br').replace(/\/$/, '');

export interface SearchLeadsPayload {
  query: string;
  limit: number;
}

export interface LeadResult {
  name: string;
  phone: string;
  phone_normalized: string;
  has_whatsapp: boolean;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  category: string;
  score: number | null;
  reviewsCount: number | null;
  profileUrl: string;
  imported: boolean;
  duplicate: boolean;
}

export interface SearchLeadsResponse {
  searchId: string;
  query: string;
  totalFound: number;
  totalImported: number;
  totalDuplicates: number;
  duration: number;
  results: LeadResult[];
}

export interface ApifyLeadSearch {
  id: string;
  source: string;
  query: string;
  status: string;
  totalFound: number;
  totalImported: number;
  error?: string;
  createdAt: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}/api/v1${path}`;
  console.log('[API] →', options.method || 'GET', url);
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

export const api = {
  searchLeads: (payload: SearchLeadsPayload) =>
    request<SearchLeadsResponse>('/apify-leads/search', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getSearchHistory: () => request<ApifyLeadSearch[]>('/apify-leads/searches'),
  getSearchById: (id: string) => request<ApifyLeadSearch>(`/apify-leads/searches/${id}`),

  // ─── Evolution API (WhatsApp) ─────────────────────────
  createInstance: (instanceName: string, webhookUrl?: string) =>
    request<any>('/evolution/instances', {
      method: 'POST',
      body: JSON.stringify({ instanceName, webhookUrl }),
    }),

  listInstances: () =>
    request<any[]>('/evolution/instances'),

  getQrCode: (instanceName: string) =>
    request<any>(`/evolution/instances/${instanceName}/qrcode`),

  getInstanceStatus: (instanceName: string) =>
    request<any>(`/evolution/instances/${instanceName}/status`),

  deleteInstance: (instanceName: string) =>
    request<any>(`/evolution/instances/${instanceName}`, { method: 'DELETE' }),

  sendText: (instanceName: string, phone: string, text: string) =>
    request<any>('/evolution/send-text', {
      method: 'POST',
      body: JSON.stringify({ instanceName, phone, text }),
    }),

  // ─── AI Config ────────────────────────────────────────
  getAiConfigs: () =>
    request<any[]>('/ai-config'),

  getAiConfig: (id: string) =>
    request<any>(`/ai-config/${id}`),

  saveAiConfig: (data: any) =>
    request<any>('/ai-config', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAiConfig: (id: string, data: any) =>
    request<any>(`/ai-config/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteAiConfig: (id: string) =>
    request<any>(`/ai-config/${id}`, { method: 'DELETE' }),

  // ─── Contacts & CRM ─────────────────────────────────────
  getContacts: () => request<any[]>('/contacts'),
  getContact: (id: string) => request<any>(`/contacts/${id}`),
  updateContact: (id: string, data: any) =>
    request<any>(`/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // ─── Messages ───────────────────────────────────────────
  getMessages: (contactId: string) =>
    request<any[]>(`/messages/contact/${contactId}`),
};
