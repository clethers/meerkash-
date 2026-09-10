import { isCentavos, type Centavos } from '@/lib/money';
import { BalanceError, type ExpenseInput, type UserId } from './types';

/**
 * Split `amount` equally across `participants`, in centavos, with the
 * indivisible remainder handed out one centavo at a time in a DETERMINISTIC
 * order (participant ids sorted lexicographically).
 *
 * ₱1,000.00 / 3  ->  ₱333.34, ₱333.33, ₱333.33   (sums exactly to ₱1,000.00)
 *
 * Determinism matters: the same expense must produce the same shares on every
 * machine, every render, forever — otherwise balances drift by centavos.
 */
export function splitEqually(amount: Centavos, participants: UserId[]): Record<UserId, Centavos> {
  if (!isCentavos(amount)) throw new BalanceError('Amount must be an integer number of centavos');
  if (amount <= 0) throw new BalanceError('Amount must be greater than zero');
  const unique = dedupe(participants);
  if (unique.length === 0) throw new BalanceError('An expense needs at least one participant');

  const base = Math.floor(amount / unique.length);
  let remainder = amount - base * unique.length;

  const order = [...unique].sort();
  const shares: Record<UserId, Centavos> = {};
  for (const id of unique) shares[id] = base;
  for (const id of order) {
    if (remainder <= 0) break;
    shares[id] += 1;
    remainder -= 1;
  }
  return shares;
}

/** Validate a caller-supplied exact split and return it normalised. */
export function splitExactly(
  amount: Centavos,
  participants: UserId[],
  exactShares: Record<UserId, Centavos> | undefined,
): Record<UserId, Centavos> {
  if (!exactShares) throw new BalanceError('Exact split requires per-person amounts');
  const unique = dedupe(participants);
  if (unique.length === 0) throw new BalanceError('An expense needs at least one participant');

  const shares: Record<UserId, Centavos> = {};
  let sum = 0;
  for (const id of unique) {
    const share = exactShares[id];
    if (!isCentavos(share)) throw new BalanceError(`Missing exact amount for ${id}`);
    if (share < 0) throw new BalanceError('Exact amounts cannot be negative');
    shares[id] = share;
    sum += share;
  }
  for (const id of Object.keys(exactShares)) {
    if (!unique.includes(id)) throw new BalanceError(`${id} has an amount but is not a participant`);
  }
  if (sum !== amount) {
    throw new BalanceError(
      `Exact amounts add up to ${sum} centavos but the expense is ${amount} centavos`,
    );
  }
  return shares;
}

/**
 * Split `amount` by percentage across `participants`. Percentages are integer
 * basis points (0-10000 = 0.00%-100.00%) and must sum to exactly 10000 — no
 * tolerance, matching splitExactly's exact-sum requirement. The rounding
 * remainder is handed out one centavo at a time in the same deterministic
 * sorted-id order splitEqually uses, so shares always sum exactly to the
 * total on every machine.
 */
export function splitByPercentage(
  amount: Centavos,
  participants: UserId[],
  basisPoints: Record<UserId, number> | undefined,
): Record<UserId, Centavos> {
  if (!isCentavos(amount)) throw new BalanceError('Amount must be an integer number of centavos');
  if (amount <= 0) throw new BalanceError('Amount must be greater than zero');
  if (!basisPoints) throw new BalanceError('Percentage split requires a percentage per person');

  const unique = dedupe(participants);
  if (unique.length === 0) throw new BalanceError('An expense needs at least one participant');

  let sum = 0;
  for (const id of unique) {
    const bp = basisPoints[id];
    if (!Number.isInteger(bp) || bp < 0 || bp > 10000) {
      throw new BalanceError(`Missing or invalid percentage for ${id}`);
    }
    sum += bp;
  }
  for (const id of Object.keys(basisPoints)) {
    if (!unique.includes(id)) throw new BalanceError(`${id} has a percentage but is not a participant`);
  }
  if (sum !== 10000) {
    throw new BalanceError(
      `Percentages add up to ${(sum / 100).toFixed(2)}% but an expense must add up to 100%`,
    );
  }

  const shares: Record<UserId, Centavos> = {};
  let remainder = amount;
  for (const id of unique) {
    shares[id] = Math.floor((amount * basisPoints[id]) / 10000);
    remainder -= shares[id];
  }

  const order = [...unique].sort();
  for (const id of order) {
    if (remainder <= 0) break;
    shares[id] += 1;
    remainder -= 1;
  }
  return shares;
}

/**
 * Split `amount` by integer share count across `participants` (e.g. Alice=2,
 * Bob=1 -> Alice gets 2/3). Normalises shares to basis points and reuses
 * splitByPercentage's validated, deterministic remainder distribution — the
 * math is identical, only the input unit differs.
 */
export function splitByShares(
  amount: Centavos,
  participants: UserId[],
  shareCounts: Record<UserId, number> | undefined,
): Record<UserId, Centavos> {
  if (!shareCounts) throw new BalanceError('Shares split requires a share count per person');

  const unique = dedupe(participants);
  if (unique.length === 0) throw new BalanceError('An expense needs at least one participant');

  let totalShares = 0;
  for (const id of unique) {
    const s = shareCounts[id];
    if (!Number.isInteger(s) || s < 1) {
      throw new BalanceError(`Missing or invalid share count for ${id}`);
    }
    totalShares += s;
  }
  for (const id of Object.keys(shareCounts)) {
    if (!unique.includes(id)) throw new BalanceError(`${id} has shares but is not a participant`);
  }

  const basisPoints: Record<UserId, number> = {};
  let sum = 0;
  const order = [...unique].sort();
  for (const id of order) {
    basisPoints[id] = Math.floor((shareCounts[id] * 10000) / totalShares);
    sum += basisPoints[id];
  }
  let remainder = 10000 - sum;
  for (const id of order) {
    if (remainder <= 0) break;
    basisPoints[id] += 1;
    remainder -= 1;
  }

  return splitByPercentage(amount, unique, basisPoints);
}

/** The one entry point the rest of the app should use. */
export function computeShares(expense: ExpenseInput): Record<UserId, Centavos> {
  if (expense.splitMode === 'exact') {
    return splitExactly(expense.amount, expense.participants, expense.exactShares);
  }
  if (expense.splitMode === 'percentage') {
    return splitByPercentage(expense.amount, expense.participants, expense.percentages);
  }
  if (expense.splitMode === 'shares') {
    return splitByShares(expense.amount, expense.participants, expense.shares);
  }
  return splitEqually(expense.amount, expense.participants);
}

/** How much this one expense moves each person's net position. */
export function expenseDeltas(expense: ExpenseInput): Record<UserId, Centavos> {
  const deltas: Record<UserId, Centavos> = {};
  const shares = computeShares(expense);
  for (const [id, share] of Object.entries(shares)) {
    deltas[id] = (deltas[id] ?? 0) - share;
  }
  deltas[expense.payerId] = (deltas[expense.payerId] ?? 0) + expense.amount;
  return deltas;
}

export function isActive(row: { deletedAt?: string | null }): boolean {
  return row.deletedAt === null || row.deletedAt === undefined;
}

function dedupe(ids: UserId[]): UserId[] {
  return Array.from(new Set(ids));
}
