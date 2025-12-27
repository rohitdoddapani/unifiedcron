/**
 * Cron expression utilities
 */

/**
 * Validates a cron expression
 */
export function isValidCronExpression(cron: string): boolean {
  const cronRegex = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([012]?\d|3[01])) (\*|([0]?\d|1[0-2])) (\*|([0-6]))$/;
  return cronRegex.test(cron);
}

/**
 * Parses a cron expression into readable format
 */
export function parseCronExpression(cron: string): string {
  if (!isValidCronExpression(cron)) {
    return 'Invalid cron expression';
  }

  const parts = cron.split(' ');
  const [minute, hour, day, month, weekday] = parts;

  let description = '';

  // Handle minute
  if (minute === '*') {
    description += 'every minute';
  } else if (minute === '0') {
    description += 'at the start of the hour';
  } else {
    description += `at minute ${minute}`;
  }

  // Handle hour
  if (hour === '*') {
    if (minute === '*') {
      description = 'every minute';
    } else {
      description += ' of every hour';
    }
  } else {
    const hourNum = parseInt(hour);
    const timeStr = hourNum === 0 ? '12 AM' : 
                   hourNum < 12 ? `${hourNum} AM` : 
                   hourNum === 12 ? '12 PM' : `${hourNum - 12} PM`;
    
    if (minute === '0') {
      description = `at ${timeStr}`;
    } else {
      description += ` at ${timeStr}`;
    }
  }

  // Handle day of month
  if (day !== '*') {
    description += ` on day ${day}`;
  }

  // Handle month
  if (month !== '*') {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNum = parseInt(month) - 1;
    if (monthNum >= 0 && monthNum < 12) {
      description += ` in ${monthNames[monthNum]}`;
    }
  }

  // Handle weekday
  if (weekday !== '*') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNum = parseInt(weekday);
    if (dayNum >= 0 && dayNum < 7) {
      description += ` on ${dayNames[dayNum]}`;
    }
  }

  return description;
}

/**
 * Gets the next run time for a cron expression (simplified)
 */
export function getNextRunTime(cron: string): Date {
  const now = new Date();
  const next = new Date(now.getTime() + 60000); // Default to 1 minute from now
  
  // This is a simplified implementation
  // In production, you'd want to use a proper cron parser library
  return next;
}
