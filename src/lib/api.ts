const API_BASE = '';

let authToken: string | null = localStorage.getItem('ws_token');

export function setToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem('ws_token', token);
  else localStorage.removeItem('ws_token');
}

export function getToken(): string | null {
  return authToken;
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Auth
export const authApi = {
  signup: (body: { email: string; password: string; firstName: string; lastName: string }) =>
    request<{ token: string; user: any }>('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: any }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  google: (credential: string) =>
    request<{ token: string; user: any }>('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),

  apple: (idToken: string, firstName?: string, lastName?: string) =>
    request<{ token: string; user: any }>('/api/auth/apple', { method: 'POST', body: JSON.stringify({ idToken, firstName, lastName }) }),

  me: () => request<{ user: any }>('/api/auth/me'),

  logout: () => request('/api/auth/logout', { method: 'POST' }),
};

// Users
export const userApi = {
  updateProfile: (body: { firstName: string; lastName: string }) =>
    request<{ user: any }>('/api/users/profile', { method: 'PUT', body: JSON.stringify(body) }),

  addOrgMember: (email: string) =>
    request<{ organizationEmails: string[] }>('/api/users/org/add', { method: 'POST', body: JSON.stringify({ email }) }),

  removeOrgMember: (email: string) =>
    request<{ organizationEmails: string[] }>('/api/users/org/remove', { method: 'POST', body: JSON.stringify({ email }) }),
};

// Library
export const libraryApi = {
  list: () => request<{ items: any[] }>('/api/library'),

  save: (item: any) =>
    request<{ item: any }>('/api/library', { method: 'POST', body: JSON.stringify(item) }),

  remove: (id: string) =>
    request<{ success: boolean }>(`/api/library/${id}`, { method: 'DELETE' }),
};

// Stripe
export const stripeApi = {
  createCheckout: (priceId: string) =>
    request<{ url: string }>('/api/create-checkout-session', { method: 'POST', body: JSON.stringify({ priceId }) }),
};

// Config
export const configApi = {
  get: () => request<{
    appUrl: string;
    stripePublicKey: string;
    stripePriceIdSingle: string;
    stripePriceIdOrg: string;
    stripeConfigured: boolean;
    googleClientId: string;
    appleClientId: string;
  }>('/api/config'),
};

// Admin
export const adminApi = {
  getSettings: () => request<{ settings: Record<string, string>; raw: Record<string, string> }>('/api/admin/settings'),
  updateSettings: (settings: Record<string, string>) =>
    request<{ success: boolean; settings: Record<string, string> }>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }),
};
