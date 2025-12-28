'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Plus,
  RefreshCw,
  Database,
  Loader2
} from 'lucide-react';
import { api } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const SUPABASE_PLATFORM = {
  id: 'supabase',
  name: 'Supabase',
  icon: Database,
  color: 'bg-green-100 text-green-800'
};

function DashboardContent() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalJobs: 0,
    totalConnections: 0,
    activeAlerts: 0,
    recentFailures: 0
  });
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get user ID first
      const userId = await api.getDefaultUserId();
      
      // Fetch real connections
      const connectionsResponse = await api.getConnections(userId);
      if (connectionsResponse.success && connectionsResponse.data && Array.isArray(connectionsResponse.data)) {
        const conns = connectionsResponse.data;
        setConnections(conns);
        setStats({
          totalJobs: 0,
          totalConnections: conns.length,
          activeAlerts: 0,
          recentFailures: 0
        });
      }

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Monitor and manage your Supabase cron jobs
          </p>
        </div>
        <Button className="btn-primary" onClick={() => router.push('/connections')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Connection
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalConnections}</div>
            <p className="text-xs text-muted-foreground">
              Supabase databases connected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Connections */}
      {connections.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Supabase Connections</CardTitle>
            <CardDescription>
              Manage your Supabase database connections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connections.map((connection: any) => {
                return (
                  <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${SUPABASE_PLATFORM.color}`}>
                        <Database className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{connection.label}</h3>
                        <p className="text-sm text-gray-500">{SUPABASE_PLATFORM.name}</p>
                      </div>
                    </div>
                    <Badge variant={connection.status === 'connected' || !connection.status ? 'default' : 'destructive'}>
                      {connection.status === 'connected' || !connection.status ? 'Connected' : 'Error'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No connections yet</h3>
              <p className="text-gray-500 mb-4">
                Get started by adding your first Supabase connection
              </p>
              <Button onClick={() => router.push('/connections')} className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Add Connection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
