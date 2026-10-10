import { Router, IRouter } from 'express';
import { z } from '@unifiedcron/shared';
import { AuthRequest } from '../middleware/auth';
import { NotificationService, WebhookInput, WebhookUpdate } from '../services/NotificationService';

const router: IRouter = Router();
const service = new NotificationService();
const idSchema = z.string().uuid();
const filters = z.object({
  status: z.enum(['pending', 'retrying', 'succeeded', 'failed']).optional(),
  endpointId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get('/webhooks', async (req, res, next) => {
  try { res.json({ success: true, data: await service.listWebhooks((req as AuthRequest).userId!) }); }
  catch (error) { next(error); }
});

router.post('/webhooks', async (req, res, next) => {
  try {
    const input = WebhookInput.parse(req.body);
    res.status(201).json({ success: true, data: await service.createWebhook((req as AuthRequest).userId!, input) });
  } catch (error) { next(error); }
});

router.patch('/webhooks/:id', async (req, res, next) => {
  try {
    const result = await service.updateWebhook(idSchema.parse(req.params.id), (req as AuthRequest).userId!, WebhookUpdate.parse(req.body));
    if (!result) return res.status(404).json({ success: false, error: 'Webhook endpoint not found' });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

router.delete('/webhooks/:id', async (req, res, next) => {
  try {
    const deleted = await service.deleteWebhook(idSchema.parse(req.params.id), (req as AuthRequest).userId!);
    if (!deleted) return res.status(404).json({ success: false, error: 'Webhook endpoint not found' });
    res.json({ success: true, message: 'Webhook endpoint deleted' });
  } catch (error) { next(error); }
});

router.post('/webhooks/:id/test', async (req, res, next) => {
  try {
    const result = await service.testWebhook(idSchema.parse(req.params.id), (req as AuthRequest).userId!);
    if (!result) return res.status(404).json({ success: false, error: 'Active webhook endpoint not found' });
    res.status(202).json({ success: true, data: result, message: 'Test event queued' });
  } catch (error) { next(error); }
});

router.get('/deliveries', async (req, res, next) => {
  try { res.json({ success: true, data: await service.listDeliveries((req as AuthRequest).userId!, filters.parse(req.query)) }); }
  catch (error) { next(error); }
});

router.get('/deliveries/:id', async (req, res, next) => {
  try {
    const delivery = await service.getDelivery(idSchema.parse(req.params.id), (req as AuthRequest).userId!);
    if (!delivery) return res.status(404).json({ success: false, error: 'Delivery not found' });
    res.json({ success: true, data: delivery });
  } catch (error) { next(error); }
});

router.get('/metrics', async (req, res, next) => {
  try { res.json({ success: true, data: await service.getMetrics((req as AuthRequest).userId!) }); }
  catch (error) { next(error); }
});

export { router as notificationsRouter };
