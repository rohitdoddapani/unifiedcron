import { Router, IRouter } from 'express';
import { PushError, SupabasePushService } from '../services/SupabasePushService';
import { clientAddressKey, pushAddressLimiter, pushConnectionLimiter } from '../lib/rateLimit';

export const ingestRouter: IRouter = Router();
ingestRouter.post('/supabase/:id', async (req,res,next) => {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.params.id)) return res.status(401).json({error:'Invalid push destination'});
  const addressExceeded = pushAddressLimiter.exceeded(clientAddressKey(req));
  const connectionExceeded = pushConnectionLimiter.exceeded(`connection:${req.params.id.toLowerCase()}`);
  if (addressExceeded || connectionExceeded) return res.status(429).json({error:'Push rate limit exceeded'});
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
