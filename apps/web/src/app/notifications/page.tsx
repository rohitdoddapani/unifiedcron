'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Endpoint { id: string; name: string; url: string; active: boolean }
interface Attempt { id: string; attempt: number; status: string; startedAt: string; finishedAt?: string; responseStatus?: number; errorMessage?: string; responseBody?: string }
interface Delivery { id: string; endpointName: string; event: string; status: string; attempt: number; nextRetryAt?: string; createdAt: string; responseStatus?: number; errorMessage?: string; processing: boolean; attempts?: Attempt[] }
const date = (value?: string) => value ? new Date(value).toLocaleString() : '-';
const inputClass = 'w-full rounded-md border border-gray-300 p-2 text-sm';

function NotificationsContent() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState('');
  const [endpointFilter, setEndpointFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState({ name: '', url: '', secret: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const loadRevision = useRef(0);
  const load = useCallback(async () => {
    const revision = ++loadRevision.current;
    const responses = await Promise.all([api.getWebhooks(), api.getDeliveries({ status: filter, endpointId: endpointFilter, offset, limit: 25 }), api.getNotificationMetrics()]);
    if (revision !== loadRevision.current) return;
    const failed = responses.find(response => !response.success);
    if (failed) setError(failed.error || 'Unable to load notifications');
    else {
      setEndpoints(responses[0].data || []); setDeliveries(responses[1].data || []); setMetrics(responses[2].data || {});
    }
    setLoading(false);
  }, [filter, endpointFilter, offset]);
  useEffect(() => { void load(); const timer = setInterval(load, 15_000); return () => clearInterval(timer); }, [load]);

  async function action(task: () => Promise<{ success: boolean; error?: string; data?: any }>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await task();
      if (!result.success) { setError(result.error || 'Action failed'); return false; }
      setNotice(message); await load(); return true;
    } finally { setBusy(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const input = { name: form.name, url: form.url, ...(form.secret ? { secret: form.secret } : {}) };
    const ok = await action(async () => {
      const result = editing ? await api.updateWebhook(editing, input) : await api.createWebhook(input);
      if (result.success && result.data?.secret) setSecret(result.data.secret);
      return result;
    }, editing ? 'Webhook updated.' : 'Webhook created. Save the signing secret below.');
    if (ok) { setEditing(null); setForm({ name: '', url: '', secret: '' }); }
  }
  async function inspect(id: string) {
    const result = await api.getDelivery(id);
    if (result.success) setSelected(result.data || null);
    else setError(result.error || 'Unable to load attempt history');
  }
  return (
    <div className="px-4 space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div><h2 className="text-2xl font-bold">Notifications</h2><p className="text-gray-600">Send signed failure alerts to your webhook receivers and track every attempt.</p></div>
        <Button variant="outline" onClick={() => void load()}>Refresh</Button>
      </div>
      {error && <p role="alert" className="p-3 rounded bg-red-50 text-red-700">{error}</p>}
      {notice && <p role="status" className="p-3 rounded bg-green-50 text-green-800">{notice}</p>}
      {secret && <div className="rounded border border-amber-300 bg-amber-50 p-4 space-y-2">
        <p className="font-medium">Signing secret: shown only now</p><p className="text-sm">Store it in your receiver before dismissing. It cannot be retrieved later.</p>
        <code className="block break-all select-all">{secret}</code>
        <Button variant="outline" size="sm" onClick={() => setSecret('')}>I have saved it</Button>
      </div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['pending', 'retrying', 'succeeded', 'failed'].map(status => <Card key={status}><CardContent className="pt-4"><p className="capitalize text-sm text-gray-600">{status}</p><p className="text-2xl font-bold">{metrics[status] || 0}</p></CardContent></Card>)}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <Card><CardHeader><CardTitle>{editing ? 'Edit webhook' : 'Add webhook'}</CardTitle></CardHeader><CardContent>
          <form onSubmit={save} className="space-y-4">
            <label className="block text-sm">Name<input required maxLength={100} className={inputClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
            <label className="block text-sm">Receiver URL<input required type="url" maxLength={2048} placeholder="https://example.com/webhooks" className={inputClass} value={form.url} onChange={event => setForm({ ...form, url: event.target.value })} /></label>
            <label className="block text-sm">{editing ? 'New secret (leave blank to keep)' : 'Secret (leave blank to generate)'}<input type="password" minLength={16} maxLength={255} autoComplete="new-password" className={inputClass} value={form.secret} onChange={event => setForm({ ...form, secret: event.target.value })} /></label>
            <p className="text-xs text-gray-500">HTTP(S) destinations only. Private networks require explicit server configuration.</p>
            <div className="flex gap-2"><Button disabled={busy}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Create webhook'}</Button>
              {editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setForm({ name: '', url: '', secret: '' }); }}>Cancel</Button>}</div>
          </form>
        </CardContent></Card>
        <div className="lg:col-span-2 space-y-3">
          <h3 className="font-semibold">Webhook endpoints</h3>
          {!loading && !endpoints.length && <p className="text-gray-600">No webhooks yet. Add a receiver to start sending failure alerts.</p>}
          {endpoints.map(endpoint => <Card key={endpoint.id}><CardContent className="pt-4 space-y-3">
            <div className="flex justify-between gap-2"><strong>{endpoint.name}</strong><span className={`text-sm ${endpoint.active ? 'text-green-700' : 'text-gray-500'}`}>{endpoint.active ? 'Active' : 'Paused'}</span></div>
            <p className="text-sm text-gray-600 break-all">{endpoint.url}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy || !endpoint.active} onClick={() => void action(() => api.testWebhook(endpoint.id), 'Test queued. Delivery status updates automatically.')}>Send test</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => { setEditing(endpoint.id); setForm({ name: endpoint.name, url: endpoint.url, secret: '' }); }}>Edit</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void action(() => api.updateWebhook(endpoint.id, { active: !endpoint.active }), endpoint.active ? 'Webhook paused.' : 'Webhook resumed.')}>{endpoint.active ? 'Pause' : 'Resume'}</Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => { if (window.confirm('Delete this webhook and its delivery history?')) void action(() => api.deleteWebhook(endpoint.id), 'Webhook deleted.'); }}>Delete</Button>
            </div>
          </CardContent></Card>)}
        </div>
      </div>
      <Card><CardHeader><CardTitle>Delivery history</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">Status<select className={`${inputClass} mt-1`} value={filter} onChange={event => { setFilter(event.target.value); setOffset(0); }}><option value="">All statuses</option>{['pending', 'retrying', 'succeeded', 'failed'].map(status => <option key={status}>{status}</option>)}</select></label>
          <label className="text-sm">Endpoint<select className={`${inputClass} mt-1`} value={endpointFilter} onChange={event => { setEndpointFilter(event.target.value); setOffset(0); }}><option value="">All endpoints</option>{endpoints.map(endpoint => <option key={endpoint.id} value={endpoint.id}>{endpoint.name}</option>)}</select></label>
        </div>
        {loading ? <p>Loading notifications...</p> : !deliveries.length ? <p className="text-gray-600">No deliveries match these filters.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Endpoint / event</th><th className="p-2">Status</th><th className="p-2">Attempts</th><th className="p-2">Next retry</th><th className="p-2">Details</th></tr></thead><tbody>{deliveries.map(delivery => <tr key={delivery.id} className="border-b">
          <td className="p-2"><p className="font-medium">{delivery.endpointName}</p><p className="text-gray-500">{delivery.event}</p><p className="text-xs text-gray-500">{date(delivery.createdAt)}</p></td>
          <td className={`p-2 ${delivery.status === 'failed' ? 'text-red-700' : delivery.status === 'succeeded' ? 'text-green-700' : 'text-amber-700'}`}>{delivery.processing ? 'Sending' : delivery.status}</td><td className="p-2">{delivery.attempt}</td><td className="p-2">{date(delivery.nextRetryAt)}</td><td className="p-2"><Button size="sm" variant="outline" onClick={() => void inspect(delivery.id)}>Attempts</Button></td>
        </tr>)}</tbody></table></div>}
        <div className="flex justify-between"><Button variant="outline" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button><Button variant="outline" disabled={deliveries.length < 25} onClick={() => setOffset(offset + 25)}>Next</Button></div>
      </CardContent></Card>
      {selected && <Card><CardHeader><div className="flex justify-between"><CardTitle>Attempt history</CardTitle><Button variant="outline" size="sm" onClick={() => setSelected(null)}>Close</Button></div></CardHeader><CardContent className="space-y-3">
        <p className="text-sm">{selected.endpointName} / {selected.event} / {selected.status}</p>
        {!selected.attempts?.length && <p>No attempts yet. The worker checks queued events every 15 seconds.</p>}
        {selected.attempts?.map(attempt => <div key={attempt.id} className="border rounded p-3 text-sm space-y-1"><p className="font-medium">Attempt {attempt.attempt}: {attempt.status}{attempt.responseStatus ? ` (HTTP ${attempt.responseStatus})` : ''}</p><p>{date(attempt.startedAt)} to {date(attempt.finishedAt)}</p>{attempt.errorMessage && <p className="text-red-700">{attempt.errorMessage}</p>}{attempt.responseBody && <pre className="whitespace-pre-wrap break-all bg-gray-50 p-2 max-h-40 overflow-auto">{attempt.responseBody}</pre>}</div>)}
      </CardContent></Card>}
    </div>
  );
}

export default function NotificationsPage() {
  return <ProtectedRoute><NotificationsContent /></ProtectedRoute>;
}
