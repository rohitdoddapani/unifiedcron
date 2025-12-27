'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Github,
  Zap,
  Cloud,
  Workflow,
  Filter,
  Search,
  Bell,
  BellOff
} from 'lucide-react';

const PLATFORMS = [
  { id: 'supabase', name: 'Supabase', icon: Database, color: 'bg-green-100 text-green-800' },
  { id: 'github', name: 'GitHub Actions', icon: Github, color: 'bg-gray-100 text-gray-800' },
  { id: 'vercel', name: 'Vercel', icon: Zap, color: 'bg-black text-white' },
  { id: 'netlify', name: 'Netlify', icon: Cloud, color: 'bg-blue-100 text-blue-800' },
  { id: 'n8n', name: 'n8n', icon: Workflow, color: 'bg-orange-100 text-orange-800' },
];

export default function AlertsPage() {
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const [alerts, setAlerts] = useState([
    {
      id: '1',
      type: 'failure',
      jobName: 'Daily Database Backup',
      platform: 'supabase',
      project: 'production-db',
      message: 'Database connection timeout after 30 seconds',
      createdAt: new Date('2024-01-20T14:30:00Z'),
      resolved: false,
      details: {
        jobRun: {
          status: 'failed',
          startTime: '2024-01-20T14:00:00Z',
          endTime: '2024-01-20T14:30:00Z',
          message: 'Database connection timeout after 30 seconds'
        }
      }
    },
    {
      id: '2',
      type: 'failure',
      jobName: 'Weekly Report Generation',
      platform: 'github',
      project: 'my-org/reports',
      message: 'Build failed due to missing dependencies',
      createdAt: new Date('2024-01-20T09:15:00Z'),
      resolved: true,
      resolvedAt: new Date('2024-01-20T10:00:00Z'),
      details: {
        jobRun: {
          status: 'failed',
          startTime: '2024-01-20T09:00:00Z',
          endTime: '2024-01-20T09:15:00Z',
          message: 'Build failed due to missing dependencies'
        }
      }
    },
    {
      id: '3',
      type: 'failure',
      jobName: 'Cache Cleanup',
      platform: 'vercel',
      project: 'my-app',
      message: 'Function execution timeout',
      createdAt: new Date('2024-01-19T16:45:00Z'),
      resolved: false,
      details: {
        jobRun: {
          status: 'failed',
          startTime: '2024-01-19T16:30:00Z',
          endTime: '2024-01-19T16:45:00Z',
          message: 'Function execution timeout'
        }
      }
    },
    {
      id: '4',
      type: 'failure',
      jobName: 'Email Newsletter',
      platform: 'n8n',
      project: 'automation',
      message: 'SMTP server unavailable',
      createdAt: new Date('2024-01-19T08:00:00Z'),
      resolved: true,
      resolvedAt: new Date('2024-01-19T09:30:00Z'),
      details: {
        jobRun: {
          status: 'failed',
          startTime: '2024-01-19T08:00:00Z',
          endTime: '2024-01-19T08:15:00Z',
          message: 'SMTP server unavailable'
        }
      }
    }
  ]);

  const getPlatformData = (platformId: string) => {
    return PLATFORMS.find(p => p.id === platformId);
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'unresolved') return !alert.resolved;
    if (filter === 'resolved') return alert.resolved;
    return true;
  });

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes}m ago`;
  };

  const handleResolveAlert = (alertId: string) => {
    setAlerts(alerts.map(alert => 
      alert.id === alertId 
        ? { ...alert, resolved: true, resolvedAt: new Date() }
        : alert
    ));
  };

  const stats = {
    total: alerts.length,
    unresolved: alerts.filter(a => !a.resolved).length,
    resolved: alerts.filter(a => a.resolved).length,
    today: alerts.filter(a => {
      const today = new Date();
      const alertDate = new Date(a.createdAt);
      return alertDate.toDateString() === today.toDateString();
    }).length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
          <p className="text-gray-600 mt-1">
            Monitor and manage job failure notifications
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unresolved</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.unresolved}</div>
            <p className="text-xs text-muted-foreground">
              Requiring attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
            <p className="text-xs text-muted-foreground">
              Successfully handled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.today}</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Alert History</CardTitle>
          <CardDescription>
            View and manage job failure alerts across all platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2 mb-6">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              All ({stats.total})
            </Button>
            <Button
              variant={filter === 'unresolved' ? 'default' : 'outline'}
              onClick={() => setFilter('unresolved')}
            >
              Unresolved ({stats.unresolved})
            </Button>
            <Button
              variant={filter === 'resolved' ? 'default' : 'outline'}
              onClick={() => setFilter('resolved')}
            >
              Resolved ({stats.resolved})
            </Button>
          </div>

          {/* Alerts List */}
          <div className="space-y-4">
            {filteredAlerts.map(alert => {
              const platformData = getPlatformData(alert.platform);
              const PlatformIcon = platformData?.icon || Database;
              
              return (
                <div key={alert.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`p-2 rounded-full ${platformData?.color} mt-1`}>
                        <PlatformIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-medium text-gray-900">{alert.jobName}</h3>
                          <Badge variant={alert.resolved ? 'secondary' : 'destructive'}>
                            {alert.resolved ? 'Resolved' : 'Failed'}
                          </Badge>
                          <Badge variant="outline">{platformData?.name}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{alert.project}</span>
                          <span>•</span>
                          <span>{formatDate(alert.createdAt)}</span>
                          {alert.resolved && alert.resolvedAt && (
                            <>
                              <span>•</span>
                              <span>Resolved {formatDate(alert.resolvedAt)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {!alert.resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolveAlert(alert.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredAlerts.length === 0 && (
            <div className="text-center py-12">
              <BellOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filter === 'unresolved' ? 'No unresolved alerts' : 
                 filter === 'resolved' ? 'No resolved alerts' : 'No alerts yet'}
              </h3>
              <p className="text-gray-500">
                {filter === 'unresolved' ? 'Great! All your jobs are running smoothly.' :
                 filter === 'resolved' ? 'No alerts have been resolved yet.' :
                 'Connect platforms and start monitoring to see alerts here.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
