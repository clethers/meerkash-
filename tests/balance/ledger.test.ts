import { describe, expect, it } from 'vitest';
import {
  buildLedger,
  canLeaveGroup,
  computeNetPositions,
  maxSettlementAmount,
  simplifyDebts,
  summarizeForUser,
  validateSettlement,
} from '@/lib/balance';
import type { ExpenseInput, LedgerInput, SettlementInput } from '@/lib/balance';

const expense = (over: Partial<ExpenseInput> & Pick<ExpenseInput, 'id' | 'payerId' | 'amount' | 'participants'>): ExpenseInput => ({
  splitMode: 'equal',
  deletedAt: null,
  ...over,
});

const settlement = (
  over: Partial<SettlementInput> & Pick<SettlementInput, 'id' | 'fromId' | 'toId' | 'amount'>,
): SettlementInput => ({ status: 'confirmed', deletedAt: null, ...over });

describe('the core example from the product spec', () => {
  // Clethers pays ₱1,000 for Clethers and John  -> John owes ₱500
  // John pays ₱600 for both                      -> Clethers owes ₱300
  // The app must show ONE line: John owes Clethers ₱200.
  const input: LedgerInput = {
    members: ['clethers', 'john'],
    expenses: [
      expense({ id: 'e1', payerId: 'clethers', amount: 100_000, participants: ['clethers', 'john'] }),
      expense({ id: 'e2', payerId: 'john', amount: 60_000, participants: ['clethers', 'john'] }),
    ],
    settlements: [],
  };

  it('offsets the two transactions into a single ₱200 debt', () => {
    const ledger = buildLedger(input);
    expect(ledger.net).toEqual({ clethers: 20_000, john: -20_000 });
    expect(ledger.transfers).toEqual([{ from: 'john', to: 'clethers', amount: 20_000 }]);
  });

  it('never shows the two raw debts separately', () => {
    const ledger = buildLedger(input);
    const amounts = ledger.transfers.map((t) => t.amount);
    expect(amounts).not.toContain(50_000);
    expect(amounts).not.toContain(30_000);
    expect(ledger.transfers).toHaveLength(1);
  });

  it('phrases it from each side correctly', () => {
    const ledger = buildLedger(input);
    const clethers = summarizeForUser(ledger, 'clethers');
    expect(clethers.totalOwedToYou).toBe(20_000);
    expect(clethers.totalYouOwe).toBe(0);
    expect(clethers.owedToYou).toEqual([{ userId: 'john', amount: 20_000 }]);

    const john = summarizeForUser(ledger, 'john');
    expect(john.totalYouOwe).toBe(20_000);
    expect(john.youOwe).toEqual([{ userId: 'clethers', amount: 20_000 }]);
  });
});

describe('computeNetPositions', () => {
  it('gives every member a zero balance in an empty group', () => {
    const net = computeNetPositions({ members: ['a', 'b', 'c'], expenses: [], settlements: [] });
    expect(net).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('starts a brand-new member at ₱0 and leaves past expenses alone (requirement 6)', () => {
    const net = computeNetPositions({
      members: ['a', 'b', 'newcomer'],
      expenses: [expense({ id: 'e1', payerId: 'a', amount: 100_000, participants: ['a', 'b'] })],
      settlements: [],
    });
    expect(net.newcomer).toBe(0);
    expect(net).toEqual({ a: 50_000, b: -50_000, newcomer: 0 });
  });

  it('recalculates when a member is added to an old expense', () => {
    const net = computeNetPositions({
      members: ['a', 'b', 'newcomer'],
      expenses: [
        expense({ id: 'e1', payerId: 'a', amount: 90_000, participants: ['a', 'b', 'newcomer'] }),
      ],
      settlements: [],
    });
    expect(net).toEqual({ a: 60_000, b: -30_000, newcomer: -30_000 });
  });

  it('ignores soft-deleted expenses but keeps the row (requirement 14)', () => {
    const net = computeNetPositions({
      members: ['a', 'b'],
      expenses: [
        expense({ id: 'e1', payerId: 'a', amount: 100_000, participants: ['a', 'b'] }),
        expense({
          id: 'e2',
          payerId: 'b',
          amount: 50_000,
          participants: ['a', 'b'],
          deletedAt: '2026-01-01T00:00:00Z',
        }),
      ],
      settlements: [],
    });
    expect(net).toEqual({ a: 50_000, b: -50_000 });
  });

  it('only lets CONFIRMED settlements move the balance (requirement 20)', () => {
    const base: LedgerInput = {
      members: ['a', 'b'],
      expenses: [expense({ id: 'e1', payerId: 'a', amount: 100_000, participants: ['a', 'b'] })],
      settlements: [],
    };
    const pending = computeNetPositions({
      ...base,
      settlements: [settlement({ id: 's1', fromId: 'b', toId: 'a', amount: 50_000, status: 'pending' })],
    });
    expect(pending).toEqual({ a: 50_000, b: -50_000 });

    const rejected = computeNetPositions({
      ...base,
      settlements: [settlement({ id: 's1', fromId: 'b', toId: 'a', amount: 50_000, status: 'rejected' })],
    });
    expect(rejected).toEqual({ a: 50_000, b: -50_000 });

    const confirmed = computeNetPositions({
      ...base,
      settlements: [settlement({ id: 's1', fromId: 'b', toId: 'a', amount: 50_000 })],
    });
    expect(confirmed).toEqual({ a: 0, b: 0 });
  });

  it('handles a partial settlement', () => {
    const net = computeNetPositions({
      members: ['a', 'b'],
      expenses: [expense({ id: 'e1', payerId: 'a', amount: 100_000, participants: ['a', 'b'] })],
      settlements: [settlement({ id: 's1', fromId: 'b', toId: 'a', amount: 20_000 })],
    });
    expect(net).toEqual({ a: 30_000, b: -30_000 });
  });

  it('always conserves money across a messy group', () => {
    const members = ['a', 'b', 'c', 'd', 'e'];
    const expenses = Array.from({ length: 40 }, (_, i) =>
      expense({
        id: `e${i}`,
        payerId: members[i % members.length],
        amount: 1_000 + i * 137,
        participants: members.slice(0, (i % 4) + 2),
      }),
    );
    const net = computeNetPositions({ members, expenses, settlements: [] });
    expect(Object.values(net).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('simplifyDebts', () => {
  it('produces the payment plan from requirement 17', () => {
    const transfers = simplifyDebts({
      clethers: 100_000,
      john: -50_000,
      mark: -30_000,
      sarah: -20_000,
    });
    expect(transfers).toEqual([
      { from: 'john', to: 'clethers', amount: 50_000 },
      { from: 'mark', to: 'clethers', amount: 30_000 },
      { from: 'sarah', to: 'clethers', amount: 20_000 },
    ]);
  });

  it('breaks a circular debt chain', () => {
    // a owes b, b owes c, c owes a — the naive view is 3 payments, the truth is 0.
    const transfers = simplifyDebts({ a: 0, b: 0, c: 0 });
    expect(transfers).toEqual([]);
  });

  it('needs at most n-1 transfers', () => {
    const net = { a: 70_000, b: 30_000, c: -25_000, d: -35_000, e: -40_000 };
    const transfers = simplifyDebts(net);
    expect(transfers.length).toBeLessThanOrEqual(Object.keys(net).length - 1);
  });

  it('produces transfers that exactly cancel the net positions', () => {
    const net = { a: 123_456, b: -23_456, c: -50_000, d: -50_000 };
    const applied: Record<string, number> = { ...net };
    for (const t of simplifyDebts(net)) {
      applied[t.from] += t.amount;
      applied[t.to] -= t.amount;
    }
    expect(Object.values(applied).every((v) => v === 0)).toBe(true);
  });

  it('is deterministic for tied amounts', () => {
    const net = { z: 20_000, y: -10_000, x: -10_000 };
    expect(simplifyDebts(net)).toEqual(simplifyDebts({ ...net }));
    expect(simplifyDebts(net)[0].from).toBe('x');
  });

  it('never invents a payment for a settled-up group', () => {
    expect(simplifyDebts({ a: 0, b: 0, c: 0 })).toEqual([]);
  });
});

describe('settle up rules (requirement 19)', () => {
  const input: LedgerInput = {
    members: ['clethers', 'john'],
    expenses: [expense({ id: 'e1', payerId: 'clethers', amount: 100_000, participants: ['clethers', 'john'] })],
    settlements: [],
  };

  it('pre-fills the exact amount owed', () => {
    const ledger = buildLedger(input);
    expect(maxSettlementAmount(ledger, [], 'john', 'clethers')).toBe(50_000);
  });

  it('allows less than owed', () => {
    const ledger = buildLedger(input);
    expect(validateSettlement(ledger, [], 'john', 'clethers', 30_000).ok).toBe(true);
  });

  it('allows exactly the amount owed', () => {
    const ledger = buildLedger(input);
    expect(validateSettlement(ledger, [], 'john', 'clethers', 50_000).ok).toBe(true);
  });

  it('blocks more than owed', () => {
    const ledger = buildLedger(input);
    const check = validateSettlement(ledger, [], 'john', 'clethers', 50_001);
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/more than you currently owe/);
  });

  it('blocks settling in the wrong direction', () => {
    const ledger = buildLedger(input);
    expect(validateSettlement(ledger, [], 'clethers', 'john', 100).ok).toBe(false);
  });

  it('blocks settling with yourself', () => {
    const ledger = buildLedger(input);
    expect(validateSettlement(ledger, [], 'john', 'john', 100).ok).toBe(false);
  });

  it('subtracts pending settlements so a debt cannot be double-paid', () => {
    const pending = [settlement({ id: 's1', fromId: 'john', toId: 'clethers', amount: 40_000, status: 'pending' })];
    const ledger = buildLedger({ ...input, settlements: pending });
    expect(maxSettlementAmount(ledger, pending, 'john', 'clethers')).toBe(10_000);
    expect(validateSettlement(ledger, pending, 'john', 'clethers', 20_000).ok).toBe(false);
  });

  it('rejects zero and negative amounts', () => {
    const ledger = buildLedger(input);
    expect(validateSettlement(ledger, [], 'john', 'clethers', 0).ok).toBe(false);
    expect(validateSettlement(ledger, [], 'john', 'clethers', -100).ok).toBe(false);
  });
});

describe('leaving a group (requirement 25)', () => {
  const ledger = buildLedger({
    members: ['a', 'b', 'c'],
    expenses: [expense({ id: 'e1', payerId: 'a', amount: 90_000, participants: ['a', 'b', 'c'] })],
    settlements: [],
  });

  it('blocks a member who owes money', () => {
    const check = canLeaveGroup(ledger, 'b');
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('Settle your outstanding balance before leaving this group.');
  });

  it('blocks a member who is owed money', () => {
    expect(canLeaveGroup(ledger, 'a').allowed).toBe(false);
  });

  it('lets a settled-up member leave', () => {
    const settled = buildLedger({
      members: ['a', 'b'],
      expenses: [expense({ id: 'e1', payerId: 'a', amount: 100_000, participants: ['a', 'b'] })],
      settlements: [settlement({ id: 's1', fromId: 'b', toId: 'a', amount: 50_000 })],
    });
    expect(canLeaveGroup(settled, 'b').allowed).toBe(true);
  });
});

describe('summarizeForUser', () => {
  const ledger = buildLedger({
    members: ['you', 'john', 'sarah', 'mark'],
    expenses: [
      expense({ id: 'e1', payerId: 'you', amount: 80_000, participants: ['john', 'sarah'] }),
      expense({ id: 'e2', payerId: 'mark', amount: 50_000, participants: ['you'] }),
    ],
    settlements: [],
  });

  it('nets a member out to one side only — never owing and owed at once', () => {
    const summary = summarizeForUser(ledger, 'you');
    expect(summary.net).toBe(30_000);
    expect(summary.totalOwedToYou).toBe(30_000);
    expect(summary.totalYouOwe).toBe(0);
    expect(summary.settledUp).toBe(false);
  });

  it('holds that invariant for every member of the group', () => {
    for (const member of ['you', 'john', 'sarah', 'mark']) {
      const summary = summarizeForUser(ledger, member);
      expect(summary.totalOwedToYou === 0 || summary.totalYouOwe === 0).toBe(true);
      expect(summary.totalOwedToYou - summary.totalYouOwe).toBe(summary.net);
    }
  });

  it('lists people largest amount first', () => {
    const big = buildLedger({
      members: ['you', 'john', 'sarah'],
      expenses: [expense({ id: 'e1', payerId: 'you', amount: 90_000, participants: ['john', 'sarah'], splitMode: 'exact', exactShares: { john: 60_000, sarah: 30_000 } })],
      settlements: [],
    });
    const summary = summarizeForUser(big, 'you');
    expect(summary.owedToYou.map((l) => l.userId)).toEqual(['john', 'sarah']);
    expect(summary.owedToYou[0].amount).toBe(60_000);
  });

  it('reports a settled-up member as settled', () => {
    const empty = buildLedger({ members: ['a', 'b'], expenses: [], settlements: [] });
    expect(summarizeForUser(empty, 'a').settledUp).toBe(true);
  });
});
