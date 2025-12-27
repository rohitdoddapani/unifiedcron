const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
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

// For MVP, we'll fetch or create a default user ID
// In production, this would come from authentication
let cachedUserId: string | null = null;

// Helper function to get default user ID (used internally by api methods)
async function getDefaultUserIdHelper(): Promise<string> {
  if (cachedUserId) {
    return cachedUserId;
  }

  try {
    const response = await apiRequest<{ userId: string; email: string; name: string }>('/api/users/default');
    // The apiRequest spreads the API response, so userId is directly on response, not response.data
    if (response.success && response.userId) {
      cachedUserId = response.userId;
      return response.userId;
    }
    throw new Error(response.error || 'Failed to get default user ID');
  } catch (error) {
    console.error('Error in getDefaultUserIdHelper:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to get default user ID';
    throw new Error(
      `Failed to connect to API at ${API_URL}. Please make sure the API server is running on port 3001. Error: ${errorMessage}`
    );
  }
}

export const api = {
  // Health check
  async health() {
    return apiRequest('/health');
  },

  // Users
  async getDefaultUserId() {
    return getDefaultUserIdHelper();
  },

  // Connections
  async getConnections(userId: string) {
    return apiRequest(`/api/connections?userId=${userId}`);
  },

  async getConnection(id: string, userId: string) {
    return apiRequest(`/api/connections/${id}?userId=${userId}`);
  },

  async createConnection(data: {
    userId: string;
    platform: string;
    label: string;
    config: Record<string, string>;
  }) {
    return apiRequest('/api/connections', {
      method: 'POST',
      body: JSON.stringify({
        userId: data.userId,
        platform: data.platform,
        label: data.label,
        config: data.config,
      }),
    });
  },

  async updateConnection(
    id: string,
    data: {
      userId: string;
      label?: string;
      config?: Record<string, string>;
    }
  ) {
    return apiRequest(`/api/connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        userId: data.userId,
        label: data.label,
        config: data.config,
      }),
    });
  },

  async deleteConnection(id: string, userId: string) {
    return apiRequest(`/api/connections/${id}?userId=${userId}`, {
      method: 'DELETE',
    });
  },

  async testConnection(id: string, userId: string) {
    return apiRequest(`/api/connections/${id}/test?userId=${userId}`, {
      method: 'POST',
    });
  },

  // Jobs
  async getJobs(userId?: string, options?: {
    platform?: string;
    limit?: number;
    offset?: number;
  }) {
    const id = userId || await getDefaultUserIdHelper();
    const params = new URLSearchParams({
      userId: id,
      ...(options?.platform && { platform: options.platform }),
      ...(options?.limit && { limit: String(options.limit) }),
      ...(options?.offset && { offset: String(options.offset) }),
    });
    return apiRequest(`/api/jobs?${params}`);
  },

  async getJob(id: string, userId?: string) {
    const idParam = userId || await getDefaultUserIdHelper();
    return apiRequest(`/api/jobs/${id}?userId=${idParam}`);
  },

  async refreshJobs(connectionId: string, userId?: string) {
    const idParam = userId || await getDefaultUserIdHelper();
    return apiRequest(`/api/jobs/${connectionId}/refresh?userId=${idParam}`, {
      method: 'POST',
    });
  },
};
