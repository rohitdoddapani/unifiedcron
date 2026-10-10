'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type AlertFilter = 'all' | 'open' | 'resolved';

interface AlertRecord {
  id: string;
  type: string;
  sourceRunId?: string;
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
  details: AlertDetails;
  jobName?: string;
  platform?: string;
  project?: string;
}

interface AlertStats {
  totalAlerts: string | number;
  failureAlerts: string | number;
  resolvedAlerts: string | number;
  openAlerts: string | number;
  recentAlerts: string | number;
}

interface AlertRunDetails {
  sourceRunId?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
  message?: string;
}

interface AlertResolutionDetails {
  source?: string;
  reason?: string;
  resolvedByUserId?: string;
  sourceRunId?: string;
  resolvedAt?: string;
}

interface AlertDetails extends Record<string, unknown> {
  jobRun?: AlertRunDetails;
  detectedAt?: string;
  resolution?: AlertResolutionDetails;
}

interface TimelineEvent {
  id: string;
  label: string;
  time?: string;
  description?: string;
  tone: 'danger' | 'success' | 'neutral';
}

function parseTime(value?: string): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function timelineDotClass(tone: TimelineEvent['tone']): string {
  if (tone === 'danger') {
    return 'bg-red-500';
  }
  if (tone === 'success') {
    return 'bg-green-500';
  }
  return 'bg-gray-400';
}

function resolutionSourceLabel(source?: string): string {
  if (source === 'auto_success') {
    return 'Auto (success run)';
  }
  if (source === 'manual') {
    return 'Manual';
  }
  return source || 'Unknown';
}

function AlertsContent() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [filter, setFilter] = useState<AlertFilter>('open');
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [alertsResponse, statsResponse] = await Promise.all([
        api.getAlerts({ status: filter === 'all' ? undefined : filter }),
        api.getAlertStats(),
      ]);

      if (!alertsResponse.success) {
        throw new Error(alertsResponse.error || 'Failed to load alerts');
      }
      if (!statsResponse.success) {
        throw new Error(statsResponse.error || 'Failed to load alert stats');
      }

      setAlerts((alertsResponse.data as AlertRecord[]) || []);
      setStats((statsResponse.data as AlertStats) || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleResolve(alertId: string) {
    try {
      setResolving((previous) => ({ ...previous, [alertId]: true }));
      const response = await api.resolveAlert(alertId, {
        reason: 'Resolved manually from alerts dashboard.',
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to resolve alert');
      }

      await loadData();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : 'Failed to resolve alert');
    } finally {
      setResolving((previous) => ({ ...previous, [alertId]: false }));
    }
  }

  const parsedStats = useMemo(() => {
    if (!stats) {
      return {
        total: 0,
        open: 0,
        resolved: 0,
        recent: 0,
      };
    }

    return {
      total: Number(stats.totalAlerts || 0),
      open: Number(stats.openAlerts || 0),
      resolved: Number(stats.resolvedAlerts || 0),
      recent: Number(stats.recentAlerts || 0),
    };
  }, [stats]);

  const formatDate = (value?: string): string => {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const buildTimeline = (alert: AlertRecord): TimelineEvent[] => {
    const timeline: TimelineEvent[] = [];
    const run = alert.details?.jobRun;
    const resolution = alert.details?.resolution;

    if (run?.startTime) {
      timeline.push({
        id: 'run-started',
        label: 'Run started',
        time: run.startTime,
        tone: 'neutral',
      });
    }

    if (run?.endTime) {
      timeline.push({
        id: 'run-ended',
        label: 'Run ended',
        time: run.endTime,
        tone: run.status === 'failed' ? 'danger' : 'neutral',
      });
    }

    timeline.push({
      id: 'alert-created',
      label: 'Failure detected',
      time: alert.details?.detectedAt || alert.createdAt,
      description: run?.message || 'Failure detected',
      tone: 'danger',
    });

    if (alert.status === 'resolved') {
      timeline.push({
        id: 'alert-resolved',
        label: `Resolved (${resolutionSourceLabel(resolution?.source)})`,
        time: alert.resolvedAt || resolution?.resolvedAt,
        description: resolution?.reason || undefined,
        tone: 'success',
      });
    }

    return timeline.sort((left, right) => {
      const leftTime = parseTime(left.time);
      const rightTime = parseTime(right.time);

      if (leftTime === null && rightTime === null) {
        return 0;
      }
      if (leftTime === null) {
        return 1;
      }
      if (rightTime === null) {
        return -1;
      }
      return leftTime - rightTime;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
          <p className="text-gray-600 mt-1">Live failure alerts for discovered jobs</p>
        </div>
        <Button onClick={loadData} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{parsedStats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{parsedStats.open}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{parsedStats.resolved}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 24h</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{parsedStats.recent}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by current alert state</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {(['all', 'open', 'resolved'] as AlertFilter[]).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={filter === option ? 'default' : 'outline'}
              onClick={() => setFilter(option)}
            >
              {option}
            </Button>
          ))}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-gray-600">No alerts found for this filter.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {alerts.map((alert) => {
            const timeline = buildTimeline(alert);
            const resolution = alert.details?.resolution;
            const run = alert.details?.jobRun;

            return (
              <Card key={alert.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{alert.jobName || 'Job failure'}</CardTitle>
                      <CardDescription>{alert.platform || 'unknown'} • {alert.project || 'unknown project'}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={alert.status === 'open' ? 'destructive' : 'secondary'}>
                        {alert.status}
                      </Badge>
                      {alert.status === 'resolved' && resolution?.source && (
                        <Badge variant="outline">{resolutionSourceLabel(resolution.source)}</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-700">{run?.message || 'Failure detected'}</p>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Run: {run?.sourceRunId || alert.sourceRunId || 'n/a'}</p>
                    <p>Created: {formatDate(alert.createdAt)}</p>
                    <p>Resolved: {formatDate(alert.resolvedAt)}</p>
                    {alert.status === 'resolved' && (
                      <p>Resolution: {resolution?.reason || 'Resolved'}</p>
                    )}
                  </div>

                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-2">
                      Timeline
                    </p>
                    <div className="space-y-2">
                      {timeline.map((event) => (
                        <div key={`${alert.id}-${event.id}`} className="flex items-start gap-2">
                          <span className={`mt-1.5 h-2 w-2 rounded-full ${timelineDotClass(event.tone)}`} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-800">{event.label}</p>
                            {event.description && (
                              <p className="text-xs text-gray-600">{event.description}</p>
                            )}
                            <p className="text-[11px] text-gray-500">{formatDate(event.time)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {alert.status === 'open' && (
                    <Button
                      size="sm"
                      onClick={() => handleResolve(alert.id)}
                      disabled={resolving[alert.id]}
                    >
                      {resolving[alert.id] ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Resolving...
                        </>
                      ) : (
                        'Mark Resolved'
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AlertsPage() {
  return (
    <ProtectedRoute>
      <AlertsContent />
    </ProtectedRoute>
  );
}
