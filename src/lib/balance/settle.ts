import type { Centavos } from '@/lib/money';
import { computeNetPositions, netFor, totalSpent } from './balances';
import { owedBetween, simplifyDebts } from './simplify';
import { isActive } from './split';
import {
  BalanceError,
  type Ledger,
  type LedgerInput,
  type SettlementInput,
  type Transfer,
  type UserId,
} from './types';

/** One call: net positions + the simplified payment plan + group spend. */
export function buildLedger(input: LedgerInput): Ledger {
  const net = computeNetPositions(input);
  return { net, transfers: simplifyDebts(net), totalSpent: totalSpent(input) };
}

export interface PersonLine {
  userId: UserId;
  /** Positive: they owe you. Negative: you owe them. */
  amount: Centavos;
}

export interface UserSummary {
  net: Centavos;
  /** Sum of what others owe you. */
  totalOwedToYou: Centavos;
  /** Sum of what you owe others. */
  totalYouOwe: Centavos;
  owedToYou: PersonLine[];
  youOwe: PersonLine[];
  settledUp: boolean;
}

/**
 * The dashboard view for one member, phrased the way requirement 34 asks for:
 * "John owes you ₱500", never "net receivable: +₱500".
 */
export function summarizeForUser(ledger: Ledger, userId: UserId): UserSummary {
  const owedToYou: PersonLine[] = [];
  const youOwe: PersonLine[] = [];

  for (const transfer of ledger.transfers) {
    if (transfer.to === userId) owedToYou.push({ userId: transfer.from, amount: transfer.amount });
    else if (transfer.from === userId) youOwe.push({ userId: transfer.to, amount: transfer.amount });
  }

  const bySize = (a: PersonLine, b: PersonLine) => b.amount - a.amount || (a.userId < b.userId ? -1 : 1);
  owedToYou.sort(bySize);
  youOwe.sort(bySize);

  const totalOwedToYou = owedToYou.reduce((sum, l) => sum + l.amount, 0);
  const totalYouOwe = youOwe.reduce((sum, l) => sum + l.amount, 0);

  return {
    net: netFor(ledger.net, userId),
    totalOwedToYou,
    totalYouOwe,
    owedToYou,
    youOwe,
    settledUp: totalOwedToYou === 0 && totalYouOwe === 0,
  };
}

/**
 * The ceiling on a Settle Up entry (requirement 19).
 *
 *   less than owed  -> allowed
 *   exactly owed    -> allowed
 *   more than owed  -> blocked
 *
 * Pending settlements already in flight are subtracted so two people cannot
 * queue up two full payments for the same debt and over-settle it.
 */
export function maxSettlementAmount(
  ledger: Ledger,
  settlements: SettlementInput[],
  from: UserId,
  to: UserId,
): Centavos {
  const owed = owedBetween(ledger.transfers, from, to);
  const pending = settlements
    .filter(isActive)
    .filter((s) => s.status === 'pending' && s.fromId === from && s.toId === to)
    .reduce((sum, s) => sum + s.amount, 0);
  return Math.max(0, owed - pending);
}

export interface SettlementCheck {
  ok: boolean;
  max: Centavos;
  reason?: string;
}

export function validateSettlement(
  ledger: Ledger,
  settlements: SettlementInput[],
  from: UserId,
  to: UserId,
  amount: Centavos,
): SettlementCheck {
  const max = maxSettlementAmount(ledger, settlements, from, to);
  if (from === to) return { ok: false, max, reason: 'You cannot settle up with yourself.' };
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, max, reason: 'Enter an amount greater than zero.' };
  }
  if (max === 0) return { ok: false, max, reason: 'You have nothing outstanding with this person.' };
  if (amount > max) {
    return { ok: false, max, reason: 'You cannot settle more than you currently owe.' };
  }
  return { ok: true, max };
}

/**
 * Requirement 25: a member cannot leave while they still have an outstanding
 * balance in either direction.
 */
export function canLeaveGroup(ledger: Ledger, userId: UserId): { allowed: boolean; reason?: string } {
  const net = netFor(ledger.net, userId);
  if (net === 0) return { allowed: true };
  return {
    allowed: false,
    reason:
      net < 0
        ? 'Settle your outstanding balance before leaving this group.'
        : 'You are still owed money in this group. Settle up before leaving.',
  };
}

export function assertPositive(amount: Centavos, label = 'Amount'): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new BalanceError(`${label} must be a positive number of centavos`);
  }
}

export type { Transfer };
