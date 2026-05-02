const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || 'https://api.sdr.grupogpressi.com.br').replace(/\/$/, '');

export interface SearchLeadsPayload {
  source: 'google' | 'linkedin' | 'instagram' | 'website';
  query: string;
  limit: number;
}

export interface LeadResult {
  name: string;
  phone: string;
  email: string;
  companyName: string;
  jobTitle: string;
  website: string;
  address: string;
  city: string;
  state: string;
  profileUrl: string;
  sourceUrl: string;
  category: string;
  score: number | null;
  reviewsCount: number | null;
  username: string;
  source: string;
  imported: boolean;
  duplicate: boolean;
}

export interface SearchLeadsResponse {
  searchId: string;
  source: string;
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
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
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

  getSearchHistory: () =>
    request<ApifyLeadSearch[]>('/apify-leads/searches'),

  getSearchById: (id: string) =>
    request<ApifyLeadSearch>(`/apify-leads/searches/${id}`),
};
