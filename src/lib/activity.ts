import { formatMoney } from '@/lib/money';
import type { ActivityEntry, CurrencyCode } from '@/types/db';

export function describeActivity(
  entry: ActivityEntry,
  nameOf: (id: string) => string,
  currency: CurrencyCode,
): string {
  const who = nameOf(entry.actor_id ?? '');
  const meta = entry.metadata ?? {};
  const description = String(meta.description ?? 'an expense');
  const amount =
    typeof meta.amount_centavos === 'number' ? formatMoney(meta.amount_centavos, currency) : null;

  switch (entry.action) {
    case 'group.created':
      return `${who} created the group "${String(meta.name ?? '')}"`;
    case 'group.renamed':
      return `${who} renamed the group from "${String(meta.from ?? '')}" to "${String(meta.to ?? '')}"`;
    case 'group.ownership_transferred':
      return `${who} transferred ownership to ${nameOf(String(meta.to ?? ''))}`;
    case 'member.joined':
      return `${who} joined the group`;
    case 'member.left':
      return `${who} left the group`;
    case 'member.removed':
      return `${who} removed ${nameOf(String(entry.subject_id ?? ''))} from the group`;
    case 'expense.created':
      return `${who} added "${description}"${amount ? ` for ${amount}` : ''}`;
    case 'expense.edited': {
      const fields = Array.isArray(meta.changed_fields) ? meta.changed_fields.join(', ') : 'details';
      return `${who} edited "${description}" — changed ${fields}`;
    }
    case 'expense.deleted':
      return `${who} deleted "${description}"${amount ? ` (${amount})` : ''}`;
    case 'expense.participant_added':
      return `${who} added ${nameOf(String(meta.added ?? ''))} to "${description}" and re-split it`;
    case 'settlement.created':
      return `${who} recorded a payment of ${amount ?? ''} to ${nameOf(String(meta.to ?? ''))}`;
    case 'settlement.confirmed':
      return `${who} confirmed a payment of ${amount ?? ''} from ${nameOf(String(meta.from ?? ''))}`;
    case 'settlement.rejected':
      return `${who} rejected a payment of ${amount ?? ''} from ${nameOf(String(meta.from ?? ''))}`;
    case 'recurring.created':
      return `${who} set up a ${String(meta.frequency ?? '')} reminder: "${String(meta.name ?? '')}"`;
    default:
      return `${who} — ${entry.action}`;
  }
}
