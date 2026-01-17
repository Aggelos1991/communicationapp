/**
 * API Client for Invoice Tracker Backend
 * Replaces Supabase client
 */

const API_URL = import.meta.env.VITE_API_BASE_URL || '';

// Token management
let authToken: string | null = localStorage.getItem('authToken');

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
};

export const getAuthToken = () => authToken;

// Base fetch wrapper
async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token expired or invalid
    setAuthToken(null);
    window.location.href = '/signin';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  return toCamelCase(data);
}

// Helper to convert camelCase to snake_case
function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }

  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      acc[snakeKey] = toSnakeCase(obj[key]);
      return acc;
    }, {} as any);
  }

  return obj;
}

// Helper to convert snake_case to camelCase
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }

  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[camelKey] = toCamelCase(obj[key]);
      return acc;
    }, {} as any);
  }

  return obj;
}

// API methods
export const api = {
  // Auth
  auth: {
    register: (email: string, password: string, name: string, role?: string) =>
      apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, role }),
      }),

    login: (email: string, password: string) =>
      apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    getMe: () => apiFetch('/api/auth/me'),

    refresh: () => apiFetch('/api/auth/refresh', { method: 'POST' }),
  },

  // Invoices
  invoices: {
    getAll: (teamView?: string, search?: string) => {
      const params = new URLSearchParams();
      if (teamView) params.append('team_view', teamView);
      if (search) params.append('search', search);
      return apiFetch(`/api/invoices?${params}`);
    },

    getById: (id: string) => apiFetch(`/api/invoices/${id}`),

    create: (invoice: any) =>
      apiFetch('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(toSnakeCase(invoice)),
      }),

    update: (id: string, updates: any) =>
      apiFetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(toSnakeCase(updates)),
      }),

    delete: (id: string) =>
      apiFetch(`/api/invoices/${id}`, { method: 'DELETE' }),

    bulkDelete: (ids: string[]) =>
      apiFetch('/api/invoices/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),

    getStats: () => apiFetch('/api/invoices/stats/summary'),
  },

  // Evidence
  evidence: {
    getByInvoiceId: (invoiceId: string) =>
      apiFetch(`/api/evidence/invoice/${invoiceId}`),

    create: (evidence: any) =>
      apiFetch('/api/evidence', {
        method: 'POST',
        body: JSON.stringify(toSnakeCase(evidence)),
      }),

    delete: (id: string) =>
      apiFetch(`/api/evidence/${id}`, { method: 'DELETE' }),
  },

  // Attachments
  attachments: {
    getByEvidenceId: (evidenceId: string) =>
      apiFetch(`/api/attachments/evidence/${evidenceId}`),

    getByPaymentValidationId: (paymentValidationId: string) =>
      apiFetch(`/api/attachments/payment-validation/${paymentValidationId}`),

    create: (attachment: any) =>
      apiFetch('/api/attachments', {
        method: 'POST',
        body: JSON.stringify(toSnakeCase(attachment)),
      }),

    delete: (id: string) =>
      apiFetch(`/api/attachments/${id}`, { method: 'DELETE' }),
  },

  // File Upload
  upload: async (files: File[]) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    const data = await response.json();
    return toCamelCase(data);
  },

  // Payment Validations
  paymentValidations: {
    getByInvoiceId: (invoiceId: string) =>
      apiFetch(`/api/payment-validations/invoice/${invoiceId}`),

    create: (validation: any) =>
      apiFetch('/api/payment-validations', {
        method: 'POST',
        body: JSON.stringify(toSnakeCase(validation)),
      }),

    update: (id: string, updates: any) =>
      apiFetch(`/api/payment-validations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(toSnakeCase(updates)),
      }),
  },

  // Profiles
  profiles: {
    getMe: () => apiFetch('/api/profiles/me'),

    updateMe: (updates: any) =>
      apiFetch('/api/profiles/me', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),

    updateTotp: (totp_secret: string | null, totp_enabled: boolean) =>
      apiFetch('/api/profiles/totp', {
        method: 'POST',
        body: JSON.stringify({ totp_secret, totp_enabled }),
      }),
  },
};

export default api;
