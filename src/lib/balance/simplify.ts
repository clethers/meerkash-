import { BalanceError, type NetPositions, type Transfer, type UserId } from './types';

/**
 * Turn net positions into the shortest practical list of payments.
 *
 * Greedy max-debtor / max-creditor matching. For groups of the size this app
 * targets (~20 members) it produces at most n-1 transfers, which is the best
 * any algorithm can guarantee without solving an NP-hard partition problem.
 *
 *   Clethers +1000, John -500, Mark -300, Sarah -200
 *   ->  John → Clethers ₱500, Mark → Clethers ₱300, Sarah → Clethers ₱200
 *
 * Ties are broken by user id so the output is byte-for-byte reproducible.
 */
export function simplifyDebts(net: NetPositions): Transfer[] {
  const creditors: Array<{ id: UserId; amount: number }> = [];
  const debtors: Array<{ id: UserId; amount: number }> = [];

  for (const id of Object.keys(net).sort()) {
    const value = net[id];
    if (value > 0) creditors.push({ id, amount: value });
    else if (value < 0) debtors.push({ id, amount: -value });
  }

  const sum = creditors.reduce((a, c) => a + c.amount, 0) - debtors.reduce((a, d) => a + d.amount, 0);
  if (sum !== 0) throw new BalanceError('Cannot simplify: credits and debts are unbalanced');

  const byAmountThenId = (a: { id: UserId; amount: number }, b: { id: UserId; amount: number }) =>
    b.amount - a.amount || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  creditors.sort(byAmountThenId);
  debtors.sort(byAmountThenId);

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount > 0) transfers.push({ from: debtor.id, to: creditor.id, amount });

    creditor.amount -= amount;
    debtor.amount -= amount;
    if (creditor.amount === 0) ci += 1;
    if (debtor.amount === 0) di += 1;
  }

  return transfers;
}

/** What `userId` still owes `otherId` under the simplified plan (0 if nothing). */
export function owedBetween(transfers: Transfer[], from: UserId, to: UserId): number {
  return transfers
    .filter((t) => t.from === from && t.to === to)
    .reduce((sum, t) => sum + t.amount, 0);
}
