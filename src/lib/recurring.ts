import type { Recurrence } from '@/types/db';

/**
 * Requirement 30: recurring entries are templates/reminders, so all we need is
 * "when is the next one due". Pure and UTC-based so it never drifts by a day
 * depending on who is looking.
 */
export function advance(dueOn: string, frequency: Recurrence): string {
  const date = new Date(`${dueOn}T00:00:00Z`);
  switch (frequency) {
    case 'daily':
      date.setUTCDate(date.getUTCDate() + 1);
      break;
    case 'weekly':
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case 'monthly':
      date.setUTCMonth(date.getUTCMonth() + 1);
      break;
    case 'yearly':
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      break;
  }
  return date.toISOString().slice(0, 10);
}

export function isDue(dueOn: string, today = new Date()): boolean {
  return dueOn <= today.toISOString().slice(0, 10);
}
