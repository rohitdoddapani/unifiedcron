'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock,
  Database,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const SUPABASE_PLATFORM = {
  name: 'Supabase',
  icon: Database,
  color: 'bg-green-100 text-green-800'
};

function JobsPageContent() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<{ [key: string]: boolean }>({});
  const [connections, setConnections] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get user ID
      const userIdValue = await api.getDefaultUserId();
      setUserId(userIdValue);
      
      // Fetch connections and jobs
      await Promise.all([
        fetchConnections(userIdValue),
        fetchJobs(userIdValue)
      ]);
    } catch (error) {
      console.error('Failed to initialize:', error);
      setError(error instanceof Error ? error.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async (userIdParam?: string) => {
    try {
      const id = userIdParam || userId;
      if (!id) return;
      
      const response = await api.getConnections(id);
      if (response.success && response.data) {
        setConnections(response.data);
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  };

  const fetchJobs = async (userIdParam?: string) => {
    try {
      const id = userIdParam || userId;
      if (!id) return;
      
      const response = await api.getJobs(id);
      if (response.success && response.data) {
        setJobs(response.data);
      } else {
        setError(response.error || 'Failed to load jobs');
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setError(error instanceof Error ? error.message : 'Failed to load jobs');
    }
  };

  const handleDiscoverJobs = async (connectionId: string) => {
    if (!userId) {
      alert('User ID not available. Please refresh the page.');
      return;
    }

    try {
      setRefreshing(prev => ({ ...prev, [connectionId]: true }));
      
      const response = await api.refreshJobs(connectionId, userId);
      if (response.success && response.data) {
        const { added, updated, errors } = response.data;
        const message = `✅ Discovered ${added} new job(s) and updated ${updated} existing job(s)`;
        alert(errors.length > 0 ? `${message}\n\nErrors: ${errors.join(', ')}` : message);
        
        // Refresh jobs list
        await fetchJobs(userId);
      } else {
        alert(`❌ Failed to discover jobs: ${response.error}`);
      }
    } catch (error) {
      console.error('Error discovering jobs:', error);
      alert(`❌ Failed to discover jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRefreshing(prev => ({ ...prev, [connectionId]: false }));
    }
  };

  const formatCron = (cron: string) => {
    // Simple cron display - show the schedule
    return cron;
  };

  const formatDate = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConnectionLabel = (connectionId: string) => {
    const conn = connections.find(c => c.id === connectionId);
    return conn ? conn.label : connectionId;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cron Jobs</h1>
          <p className="text-gray-600 mt-1">
            Discover and monitor cron jobs from your Supabase connections
          </p>
        </div>
        <Button 
          onClick={initialize}
          variant="outline"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
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
              <h3 className="font-medium text-blue-900 mb-1">How to Discover Jobs</h3>
              <p className="text-sm text-blue-700">
                Jobs are discovered from your Supabase connections. Go to the Connections page and click "Discover Jobs" on any connection to fetch cron jobs from that database.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      )}

      {/* Jobs List */}
      {!loading && jobs.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {jobs.map((job: any) => {
            const PlatformIcon = SUPABASE_PLATFORM.icon;
            return (
              <Card key={job.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${SUPABASE_PLATFORM.color}`}>
                        <PlatformIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{job.name}</CardTitle>
                        <CardDescription>
                          {getConnectionLabel(job.connectionId)} • {job.platform}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="default">
                      {job.platform}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">
                          <span className="font-medium">Schedule:</span> {formatCron(job.cron)}
                        </span>
                      </div>
                    </div>
                    {job.project && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Project:</span> {job.project}
                      </div>
                    )}
                    {job.lastSeenAt && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Last seen:</span> {formatDate(job.lastSeenAt)}
                      </div>
                    )}
                    {job.metadata && Object.keys(job.metadata).length > 0 && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-gray-600 font-medium">Details</summary>
                        <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto">
                          {JSON.stringify(job.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && jobs.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs discovered yet</h3>
            <p className="text-gray-500 mb-4">
              Discover jobs from your Supabase connections to see them here
            </p>
            <div className="space-y-2">
              {connections.length > 0 ? (
                <>
                  <p className="text-sm text-gray-600 mb-4">Available connections:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {connections.map((connection: any) => (
                      <Button
                        key={connection.id}
                        onClick={() => handleDiscoverJobs(connection.id)}
                        variant="outline"
                        disabled={refreshing[connection.id]}
                        className="flex items-center"
                      >
                        {refreshing[connection.id] ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Discovering...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Discover from {connection.label}
                          </>
                        )}
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <Button onClick={() => window.location.href = '/connections'} className="btn-primary">
                  Add Connection
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function JobsPage() {
  return (
    <ProtectedRoute>
      <JobsPageContent />
    </ProtectedRoute>
  );
}

