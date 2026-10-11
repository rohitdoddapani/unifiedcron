import { Router, IRouter } from 'express';
import { PushError, SupabasePushService } from '../services/SupabasePushService';

export const ingestRouter: IRouter = Router();
const windows = new Map<string,{ count: number; until: number }>();
function limited(key: string, cap: number) {
  const now = Date.now();
  if (windows.size >= 5000) for (const [id,value] of windows) if (value.until<now) windows.delete(id);
  const value = windows.get(key);
  if (!value || value.until<now) {
    if (windows.size>=5000) return true;
    windows.set(key,{count:1,until:now+60000}); return false;
  }
  return ++value.count>cap;
}
ingestRouter.post('/supabase/:id', async (req,res,next) => {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.params.id)) return res.status(401).json({error:'Invalid push destination'});
  if (limited(`ip:${req.ip}`,600) || limited(`connection:${req.params.id}`,60)) return res.status(429).json({error:'Push rate limit exceeded'});
  if (!Buffer.isBuffer(req.body)) return res.status(415).json({error:'Use application/json'});
  try {
    const result = await new SupabasePushService().receive(req.params.id,req.body,req.get('x-unifiedcron-timestamp') || '',req.get('x-unifiedcron-signature') || '');
    res.json(result);
  } catch (error) {
    if (error instanceof PushError) return res.status(error.status).json({error:error.message});
    if (error instanceof SyntaxError) return res.status(400).json({error:'Invalid JSON'});
    next(error);
  }
});
