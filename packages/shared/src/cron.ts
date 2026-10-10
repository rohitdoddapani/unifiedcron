import { CronExpressionParser } from 'cron-parser';

export function intervalSeconds(schedule: string): number | null {
  const match = /^([1-9]\d*)\s+seconds?$/i.exec(schedule.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return value >= 1 && value <= 59 ? value : null;
}

export function isValidCronExpression(schedule: string): boolean {
  if (intervalSeconds(schedule) !== null) return true;
  const expression = schedule.trim();
  if (!expression.startsWith('@') && expression.split(/\s+/).length !== 5) return false;
  try { CronExpressionParser.parse(expression); return true; } catch { return false; }
}

export function parseCronExpression(schedule: string): string {
  if (!isValidCronExpression(schedule)) return 'Invalid cron expression';
  const seconds = intervalSeconds(schedule);
  if (seconds !== null) return `Every ${seconds} second${seconds === 1 ? '' : 's'}`;
  if (schedule.trim() === '* * * * *') return 'Every minute';
  // Avoid invented interpretations of ranges, lists and combined day constraints.
  return `Cron schedule: ${schedule.trim()}`;
}

export function getNextRunTime(schedule: string, options: { currentDate?: Date; timezone?: string } = {}): Date {
  if (!isValidCronExpression(schedule)) throw new Error('Invalid cron expression');
  const currentDate = options.currentDate ?? new Date();
  const seconds = intervalSeconds(schedule);
  if (seconds !== null) return new Date(currentDate.getTime() + seconds * 1000);
  return CronExpressionParser.parse(schedule.trim(), { currentDate, tz: options.timezone ?? 'UTC' }).next().toDate();
}
