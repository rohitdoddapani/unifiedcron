import { getSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface WebhookEndpoint { id: string; name: string; url: string; active: boolean; secret?: string }
export interface DeliveryAttempt { id: string; attempt: number; status: string; startedAt: string; finishedAt?: string; responseStatus?: number; errorMessage?: string; responseBody?: string }
export interface NotificationDelivery { id: string; endpointName: string; event: string; status: string; attempt: number; nextRetryAt?: string; createdAt: string; responseStatus?: number; errorMessage?: string; processing: boolean; attempts?: DeliveryAttempt[] }

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  const token = (session as any)?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  requireAuth: boolean = true
): Promise<ApiResponse<T>> {
  try {
    const authHeaders = requireAuth ? await getAuthHeaders() : {};
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    console.error('API request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
}

export const api = {
  async health() {
    return apiRequest('/health', {}, false);
  },

  async getCurrentUser() {
    return apiRequest('/api/users/me');
  },

  async getConnections() {
    return apiRequest('/api/connections');
  },

  async getConnection(id: string) {
    return apiRequest(`/api/connections/${id}`);
  },

  async createConnection(data: {
    platform: string;
    label: string;
    config: Record<string, string>;
  }) {
    return apiRequest('/api/connections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateConnection(
    id: string,
    data: {
      label?: string;
      config?: Record<string, string>;
    }
  ) {
    return apiRequest(`/api/connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteConnection(id: string) {
    return apiRequest(`/api/connections/${id}`, {
      method: 'DELETE',
    });
  },

  async testConnection(id: string) {
    return apiRequest(`/api/connections/${id}/test`, {
      method: 'POST',
    });
  },

  async getSupabaseSetup() {
    return apiRequest<{ sql: string; username: string }>('/api/connections/supabase/setup');
  },

  async createSupabasePush(input: {label: string; projectRef: string; connectionId?: string}) {
    return apiRequest<{connection: {id: string}; sql: string}>('/api/connections/supabase/push', {method:'POST',body:JSON.stringify(input)});
  },

  async getSupabasePushSetup(id: string) {
    return apiRequest<{sql: string}>(`/api/connections/${id}/push-setup`);
  },

  async getJobs(options?: { platform?: string; limit?: number; offset?: number }) {
    const params = new URLSearchParams({
      ...(options?.platform && { platform: options.platform }),
      ...(options?.limit && { limit: String(options.limit) }),
      ...(options?.offset && { offset: String(options.offset) }),
    });

    const queryString = params.toString();
    return apiRequest(`/api/jobs${queryString ? `?${queryString}` : ''}`);
  },

  async getJob(id: string) {
    return apiRequest(`/api/jobs/${id}`);
  },

  async getJobRuns(id: string, options?: { limit?: number; offset?: number }) {
    const params = new URLSearchParams({
      ...(options?.limit && { limit: String(options.limit) }),
      ...(options?.offset && { offset: String(options.offset) }),
    });
    const queryString = params.toString();
    return apiRequest(`/api/jobs/${id}/runs${queryString ? `?${queryString}` : ''}`);
  },

  async getJobStats(id: string) {
    return apiRequest(`/api/jobs/${id}/stats`);
  },

  async refreshJobs(connectionId: string) {
    return apiRequest(`/api/jobs/${connectionId}/refresh`, {
      method: 'POST',
    });
  },

  async getAlerts(options?: { type?: string; status?: string; limit?: number; offset?: number }) {
    const params = new URLSearchParams({
      ...(options?.type && { type: options.type }),
      ...(options?.status && { status: options.status }),
      ...(options?.limit && { limit: String(options.limit) }),
      ...(options?.offset && { offset: String(options.offset) }),
    });
    const queryString = params.toString();
    return apiRequest(`/api/alerts${queryString ? `?${queryString}` : ''}`);
  },

  async resolveAlert(id: string, options?: { reason?: string }) {
    const body = options?.reason ? JSON.stringify({ reason: options.reason }) : undefined;
    return apiRequest(`/api/alerts/${id}/resolve`, {
      method: 'PATCH',
      ...(body ? { body } : {}),
    });
  },

  async getAlertStats() {
    return apiRequest('/api/alerts/stats/overview');
  },

  async getWebhooks() {
    return apiRequest<WebhookEndpoint[]>('/api/notifications/webhooks');
  },

  async createWebhook(data: { name: string; url: string; secret?: string; active?: boolean }) {
    return apiRequest<WebhookEndpoint>('/api/notifications/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteWebhook(id: string) {
    return apiRequest(`/api/notifications/webhooks/${id}`, {
      method: 'DELETE',
    });
  },

  async updateWebhook(id: string, data: { name?: string; url?: string; secret?: string; active?: boolean }) {
    return apiRequest<WebhookEndpoint>(`/api/notifications/webhooks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  async getDeliveries(options: { status?: string; endpointId?: string; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) if (value !== undefined && value !== '') params.set(key, String(value));
    return apiRequest<NotificationDelivery[]>(`/api/notifications/deliveries?${params}`);
  },

  async getDelivery(id: string) {
    return apiRequest<NotificationDelivery>(`/api/notifications/deliveries/${id}`);
  },

  async getNotificationMetrics() {
    return apiRequest<Record<string, number>>('/api/notifications/metrics');
  },

  async testWebhook(id: string) {
    return apiRequest(`/api/notifications/webhooks/${id}/test`, {
      method: 'POST',
    });
  },
};
