'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus,
  Database,
  Settings,
  Trash2,
  TestTube,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const SUPABASE_PLATFORM = {
  id: 'supabase',
  name: 'Supabase',
  icon: Database,
  color: 'bg-green-100 text-green-800',
  description: 'Discover and monitor pg_cron jobs in your Supabase database',
  fields: [
    { name: 'projectUrl', label: 'Project URL', type: 'url', placeholder: 'https://your-project.supabase.co' },
    { name: 'anonKey', label: 'Anonymous Key', type: 'password', placeholder: 'eyJ...' }
  ]
};

function ConnectionsPageContent() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [discoveringJobs, setDiscoveringJobs] = useState<{ [key: string]: boolean }>({});
  
  // Form state
  const [formData, setFormData] = useState({
    label: '',
    projectUrl: '',
    anonKey: ''
  });

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First check if API is healthy
      const healthCheck = await api.health();
      if (!healthCheck.success) {
        throw new Error('API health check failed');
      }
      
      // Get default user ID first
      const userIdValue = await api.getDefaultUserId();
      setUserId(userIdValue);
      
      // Then fetch connections
      await fetchConnections(userIdValue);
    } catch (error) {
      console.error('Failed to initialize:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to connect to API. Please make sure the API server is running on port 3001.';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const fetchConnections = async (userIdParam?: string) => {
    try {
      setLoading(true);
      const id = userIdParam || userId;
      if (!id) {
        throw new Error('User ID not available');
      }
      const response = await api.getConnections(id);
      if (response.success && response.data) {
        setConnections(response.data);
      } else {
        console.error('Failed to fetch connections:', response.error);
        setError(response.error || 'Failed to load connections.');
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
      setError(error instanceof Error ? error.message : 'Failed to load connections. Make sure the API is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) {
      return;
    }

    // Ensure we have a user ID
    let currentUserId = userId;
    if (!currentUserId) {
      try {
        currentUserId = await api.getDefaultUserId();
        setUserId(currentUserId);
      } catch (error) {
        alert('Failed to get user ID. Please refresh the page.');
        return;
      }
    }

    try {
      const response = await api.deleteConnection(connectionId, currentUserId);
      if (response.success) {
        setConnections(connections.filter(c => c.id !== connectionId));
      } else {
        alert(`Failed to delete connection: ${response.error}`);
      }
    } catch (error) {
      console.error('Error deleting connection:', error);
      alert('Failed to delete connection');
    }
  };

  const handleTestConnection = async (connectionId: string) => {
    // Ensure we have a user ID
    let currentUserId = userId;
    if (!currentUserId) {
      try {
        currentUserId = await api.getDefaultUserId();
        setUserId(currentUserId);
      } catch (error) {
        alert('Failed to get user ID. Please refresh the page.');
        return;
      }
    }

    try {
      const response = await api.testConnection(connectionId, currentUserId);
      if (response.success) {
        const result = response.data;
        if (result.success) {
          alert('✅ Connection test successful!');
        } else {
          alert(`❌ Connection test failed: ${result.message}`);
        }
      } else {
        alert(`❌ Test failed: ${response.error}`);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      alert('Failed to test connection');
    }
  };

  const handleDiscoverJobs = async (connectionId: string) => {
    // Ensure we have a user ID
    let currentUserId = userId;
    if (!currentUserId) {
      try {
        currentUserId = await api.getDefaultUserId();
        setUserId(currentUserId);
      } catch (error) {
        alert('Failed to get user ID. Please refresh the page.');
        return;
      }
    }

    try {
      setDiscoveringJobs(prev => ({ ...prev, [connectionId]: true }));
      
      const response = await api.refreshJobs(connectionId, currentUserId);
      if (response.success && response.data) {
        const { added, updated, errors } = response.data;
        const message = `✅ Discovered ${added} new job(s) and updated ${updated} existing job(s)`;
        alert(errors.length > 0 ? `${message}\n\nErrors: ${errors.join(', ')}` : message);
        
        // Optionally redirect to jobs page or show a link
        if (added > 0 || updated > 0) {
          if (confirm('Jobs discovered! Would you like to view them on the Jobs page?')) {
            window.location.href = '/jobs';
          }
        }
      } else {
        alert(`❌ Failed to discover jobs: ${response.error}`);
      }
    } catch (error) {
      console.error('Error discovering jobs:', error);
      alert(`❌ Failed to discover jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDiscoveringJobs(prev => ({ ...prev, [connectionId]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Ensure we have a user ID
    let currentUserId = userId;
    if (!currentUserId) {
      try {
        currentUserId = await api.getDefaultUserId();
        setUserId(currentUserId);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to get user ID. Please refresh the page.');
        setSubmitting(false);
        return;
      }
    }

    try {
      // Create the connection
      const response = await api.createConnection({
        userId: currentUserId,
        platform: 'supabase',
        label: formData.label,
        config: {
          projectUrl: formData.projectUrl,
          anonKey: formData.anonKey
        }
      });

      if (response.success) {
        // Connection created successfully
        await fetchConnections(currentUserId); // Refresh the list
        setShowAddForm(false);
        setFormData({ label: '', projectUrl: '', anonKey: '' });
        setError(null);
      } else {
        setError(response.error || 'Failed to create connection');
      }
    } catch (error) {
      console.error('Error creating connection:', error);
      setError(error instanceof Error ? error.message : 'Failed to create connection. Make sure the API is running.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Connections</h1>
          <p className="text-gray-600 mt-1">
            Connect your Supabase database to discover cron jobs
          </p>
        </div>
        <Button 
          onClick={() => setShowAddForm(true)}
          className="btn-primary"
          disabled={loading}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Supabase Connection
        </Button>
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900 mb-1">Error</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 mb-1">Supabase Only</h3>
              <p className="text-sm text-blue-700">
                Currently, UnifiedCron supports Supabase only. Other platforms (GitHub Actions, Vercel, Netlify, n8n) will be added in future releases.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Connection Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
            <h2 className="text-xl font-semibold mb-4">
              Add Supabase Connection
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center mb-4">
                <div className={`p-2 rounded-full ${SUPABASE_PLATFORM.color} mr-3`}>
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">{SUPABASE_PLATFORM.name}</h3>
                  <p className="text-sm text-gray-500">{SUPABASE_PLATFORM.description}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Connection Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Production Database"
                    className="input w-full"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://your-project.supabase.co"
                    className="input w-full"
                    value={formData.projectUrl}
                    onChange={(e) => setFormData({ ...formData, projectUrl: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Anonymous Key
                  </label>
                  <input
                    type="password"
                    placeholder="eyJ..."
                    className="input w-full"
                    value={formData.anonKey}
                    onChange={(e) => setFormData({ ...formData, anonKey: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {error}
                  </div>
                )}

                <div className="flex space-x-3 pt-4">
                  <Button 
                    type="submit" 
                    className="btn-primary flex-1"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Test & Connect'
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false);
                      setFormData({ label: '', projectUrl: '', anonKey: '' });
                      setError(null);
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>

            <button
              onClick={() => {
                setShowAddForm(false);
                setFormData({ label: '', projectUrl: '', anonKey: '' });
                setError(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              disabled={submitting}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      )}

      {/* Connections List */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connections.map(connection => {
            return (
              <Card key={connection.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${SUPABASE_PLATFORM.color}`}>
                        <Database className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{connection.label}</CardTitle>
                        <CardDescription>{SUPABASE_PLATFORM.name}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={connection.status === 'connected' || !connection.status ? 'default' : 'destructive'}>
                      {connection.status === 'connected' || !connection.status ? 'Connected' : 'Error'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>Created: {formatDate(connection.createdAt)}</p>
                    {connection.lastChecked && (
                      <p>Last checked: {formatDate(connection.lastChecked)}</p>
                    )}
                  </div>
                  
                  <div className="flex space-x-2 mt-4">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleTestConnection(connection.id)}
                    >
                      <TestTube className="h-4 w-4 mr-1" />
                      Test
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleDiscoverJobs(connection.id)}
                      disabled={discoveringJobs[connection.id]}
                    >
                      {discoveringJobs[connection.id] ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Discovering...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Discover Jobs
                        </>
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleDeleteConnection(connection.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && connections.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No connections yet</h3>
            <p className="text-gray-500 mb-4">
              Connect your Supabase database to start discovering cron jobs
            </p>
            <Button onClick={() => setShowAddForm(true)} className="btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Add Supabase Connection
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <ProtectedRoute>
      <ConnectionsPageContent />
    </ProtectedRoute>
  );
}