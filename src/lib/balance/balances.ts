import type { Centavos } from '@/lib/money';
import { expenseDeltas, isActive } from './split';
import { BalanceError, type LedgerInput, type NetPositions, type UserId } from './types';

/**
 * Amount Paid − Fair Share = Net Position, for every member of the group.
 *
 * Confirmed settlements move real money and therefore move net positions:
 * when A hands B ₱200, A has effectively "paid" ₱200 more than their share,
 * so A's net rises and B's falls. Pending and rejected settlements are
 * deliberately ignored — an unconfirmed claim must never move the ledger.
 *
 * Soft-deleted expenses and settlements are ignored too, but their rows
 * survive for the audit trail.
 */
export function computeNetPositions(input: LedgerInput): NetPositions {
  const net: NetPositions = {};
  for (const id of input.members) net[id] = 0;

  for (const expense of input.expenses) {
    if (!isActive(expense)) continue;
    for (const [id, delta] of Object.entries(expenseDeltas(expense))) {
      net[id] = (net[id] ?? 0) + delta;
    }
  }

  for (const settlement of input.settlements) {
    if (!isActive(settlement)) continue;
    if (settlement.status !== 'confirmed') continue;
    if (settlement.amount <= 0) throw new BalanceError('Settlement amount must be positive');
    net[settlement.fromId] = (net[settlement.fromId] ?? 0) + settlement.amount;
    net[settlement.toId] = (net[settlement.toId] ?? 0) - settlement.amount;
  }

  // Invariant: money is conserved. If this ever fires, something upstream is wrong.
  const sum = Object.values(net).reduce((a, b) => a + b, 0);
  if (sum !== 0) throw new BalanceError(`Net positions do not sum to zero (off by ${sum})`);

  return net;
}

/** Total value of active expenses in the group. */
export function totalSpent(input: Pick<LedgerInput, 'expenses'>): Centavos {
  return input.expenses.filter(isActive).reduce((sum, e) => sum + e.amount, 0);
}

export function netFor(net: NetPositions, userId: UserId): Centavos {
  return net[userId] ?? 0;
}
