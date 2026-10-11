import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';

const id = z.string().regex(/^[0-9]{1,19}$/).refine(value => BigInt(value) <= 9223372036854775807n);
const time = z.string().datetime({ offset: true }).nullable();
export const SupabasePushSchema = z.object({
  version: z.literal(1), projectRef: z.string().regex(/^[a-z0-9]{20}$/), sequence: id,
  lastRunId: id, minimumRunId: id.nullable(), backfill: z.boolean(),
  jobs: z.array(z.object({ jobid: id, name: z.string().max(512), schedule: z.string().max(512), active: z.boolean() }).strict()).max(1000),
  runs: z.array(z.object({ runid: id, jobid: id,
    status: z.enum(['starting','running','sending','connecting','failed','succeeded']),
    start_time: time, end_time: time,
  }).strict()).max(1000),
}).strict();
export type SupabasePush = z.infer<typeof SupabasePushSchema>;

export function verifyPushSignature(body: Buffer, timestamp: string, signature: string, key: string, now = Date.now()) {
  if (!/^[0-9]{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature) || !/^[a-f0-9]{64}$/.test(key)) return false;
  const age = now / 1000 - Number(timestamp);
  if (age > 300 || age < -30) return false;
  const expected = createHmac('sha256', Buffer.from(key, 'hex')).update(timestamp + '.').update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
