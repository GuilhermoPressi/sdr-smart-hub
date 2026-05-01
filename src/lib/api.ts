const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const API_KEY = import.meta.env.VITE_INTERNAL_API_KEY || '';

export interface SearchLeadsPayload {
  source: 'google' | 'linkedin' | 'instagram' | 'website';
  query: string;
  limit: number;
}

export interface SearchLeadsResponse {
  searchId: string;
  source: string;
  query: string;
  totalFound: number;
  totalImported: number;
  duplicatesIgnored: number;
  executionTimeSeconds: number;
  status: string;
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
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Erro ${res.status}: ${res.statusText}`);
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
