import { getSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    // Get session token for authenticated requests
    const session = await getSession();
    const token = (session as any)?.accessToken; // JWT token from session

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
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

// Helper to get user ID from session
export async function getUserIdFromSession(): Promise<string | null> {
  const session = await getSession();
  return (session?.user as any)?.id || null;
}

export const api = {
  // Health check
  async health() {
    return apiRequest('/health');
  },

  // Auth
  async register(email: string, password: string, name?: string) {
    return apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },

  async login(email: string, password: string) {
    return apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async getCurrentUser() {
    return apiRequest('/api/auth/me');
  },

  // Connections
  async getConnections(userId?: string) {
    const id = userId || await getUserIdFromSession();
    if (!id) throw new Error('User ID not available');
    return apiRequest(`/api/connections?userId=${id}`);
  },

  async createConnection(
    userId: string | undefined,
    platform: string,
    label: string,
    config: any
  ) {
    const id = userId || await getUserIdFromSession();
    if (!id) throw new Error('User ID not available');
    return apiRequest('/api/connections', {
      method: 'POST',
      body: JSON.stringify({ userId: id, platform, label, config }),
    });
  },

  async deleteConnection(connectionId: string, userId?: string) {
    const id = userId || await getUserIdFromSession();
    if (!id) throw new Error('User ID not available');
    return apiRequest(`/api/connections/${connectionId}?userId=${id}`, {
      method: 'DELETE',
    });
  },

  async testConnection(connectionId: string, userId?: string) {
    const id = userId || await getUserIdFromSession();
    if (!id) throw new Error('User ID not available');
    return apiRequest(`/api/connections/${connectionId}/test?userId=${id}`, {
      method: 'POST',
    });
  },

  async refreshJobs(connectionId: string, userId?: string) {
    const id = userId || await getUserIdFromSession();
    if (!id) throw new Error('User ID not available');
    return apiRequest(`/api/jobs/${connectionId}/refresh?userId=${id}`, {
      method: 'POST',
    });
  },

  // Jobs
  async getJobs(userId?: string, options?: {
    platform?: string;
    limit?: number;
    offset?: number;
  }) {
    const id = userId || await getUserIdFromSession();
    if (!id) throw new Error('User ID not available');
    const params = new URLSearchParams({
      userId: id,
      ...(options?.platform && { platform: options.platform }),
      ...(options?.limit && { limit: String(options.limit) }),
      ...(options?.offset && { offset: String(options.offset) }),
    });
    return apiRequest(`/api/jobs?${params}`);
  },
};

