import { describe, expect, it } from 'vitest';
import { computeShares, expenseDeltas, splitByPercentage, splitEqually, splitExactly } from '@/lib/balance';
import type { ExpenseInput } from '@/lib/balance';

describe('splitEqually', () => {
  it('splits ₱1,000 across 4 people as ₱250 each', () => {
    const shares = splitEqually(100_000, ['a', 'b', 'c', 'd']);
    expect(shares).toEqual({ a: 25_000, b: 25_000, c: 25_000, d: 25_000 });
  });

  it('never loses a centavo to rounding', () => {
    const shares = splitEqually(100_000, ['a', 'b', 'c']);
    const total = Object.values(shares).reduce((x, y) => x + y, 0);
    expect(total).toBe(100_000);
    expect(shares).toEqual({ a: 33_334, b: 33_333, c: 33_333 });
  });

  it('is deterministic regardless of participant ordering', () => {
    const one = splitEqually(100_001, ['zoe', 'adam', 'mia']);
    const two = splitEqually(100_001, ['mia', 'zoe', 'adam']);
    expect(one).toEqual(two);
  });

  it('conserves the total for many awkward amounts', () => {
    for (let amount = 1; amount <= 500; amount += 1) {
      for (let n = 1; n <= 7; n += 1) {
        const people = Array.from({ length: n }, (_, i) => `p${i}`);
        const shares = splitEqually(amount, people);
        const sum = Object.values(shares).reduce((x, y) => x + y, 0);
        expect(sum).toBe(amount);
      }
    }
  });

  it('deduplicates participants', () => {
    expect(splitEqually(10_000, ['a', 'a', 'b'])).toEqual({ a: 5_000, b: 5_000 });
  });

  it('rejects nonsense', () => {
    expect(() => splitEqually(0, ['a'])).toThrow();
    expect(() => splitEqually(-100, ['a'])).toThrow();
    expect(() => splitEqually(100.5, ['a'])).toThrow();
    expect(() => splitEqually(100, [])).toThrow();
  });
});

describe('splitExactly', () => {
  it('accepts amounts that add up', () => {
    expect(splitExactly(100_000, ['a', 'b'], { a: 70_000, b: 30_000 })).toEqual({
      a: 70_000,
      b: 30_000,
    });
  });

  it('rejects amounts that do not add up', () => {
    expect(() => splitExactly(100_000, ['a', 'b'], { a: 70_000, b: 20_000 })).toThrow(/add up/);
  });

  it('rejects a participant with no amount', () => {
    expect(() => splitExactly(100_000, ['a', 'b'], { a: 100_000 })).toThrow(/Missing/);
  });

  it('rejects an amount for a non-participant', () => {
    expect(() => splitExactly(100_000, ['a'], { a: 100_000, ghost: 0 })).toThrow(/not a participant/);
  });
});

describe('splitByPercentage', () => {
  it('splits ₱1,000 by exact thirds without losing a centavo', () => {
    const shares = splitByPercentage(100_000, ['a', 'b', 'c'], { a: 3333, b: 3333, c: 3334 });
    const total = Object.values(shares).reduce((x, y) => x + y, 0);
    expect(total).toBe(100_000);
    expect(shares).toEqual({ a: 33_330, b: 33_330, c: 33_340 });
  });

  it('gives the whole amount to a single 100% participant', () => {
    expect(splitByPercentage(50_000, ['a'], { a: 10_000 })).toEqual({ a: 50_000 });
  });

  it('conserves the total for many awkward amounts and splits', () => {
    for (let amount = 1; amount <= 300; amount += 7) {
      const shares = splitByPercentage(amount, ['a', 'b', 'c'], { a: 5000, b: 3000, c: 2000 });
      const sum = Object.values(shares).reduce((x, y) => x + y, 0);
      expect(sum).toBe(amount);
    }
  });

  it('rejects a sum under 100%', () => {
    expect(() => splitByPercentage(100_000, ['a', 'b'], { a: 4000, b: 4000 })).toThrow(/100/);
  });

  it('rejects a sum over 100%', () => {
    expect(() => splitByPercentage(100_000, ['a', 'b'], { a: 6000, b: 6000 })).toThrow(/100/);
  });

  it('rejects a participant with no percentage', () => {
    expect(() => splitByPercentage(100_000, ['a', 'b'], { a: 10_000 })).toThrow(/a|Missing/);
  });

  it('rejects a percentage for a non-participant', () => {
    expect(() => splitByPercentage(100_000, ['a'], { a: 10_000, ghost: 0 })).toThrow(/not a participant/);
  });

  it('rejects an undefined percentage map', () => {
    expect(() => splitByPercentage(100_000, ['a'], undefined)).toThrow();
  });
});

describe('expenseDeltas', () => {
  it('credits the payer and debits every participant', () => {
    const expense: ExpenseInput = {
      id: 'e1',
      payerId: 'clethers',
      amount: 100_000,
      participants: ['clethers', 'john'],
      splitMode: 'equal',
    };
    expect(expenseDeltas(expense)).toEqual({ clethers: 50_000, john: -50_000 });
  });

  it('handles a payer who is excluded from the expense (requirement 9)', () => {
    const expense: ExpenseInput = {
      id: 'e1',
      payerId: 'clethers',
      amount: 40_000,
      participants: ['john', 'mark', 'sarah', 'ana'],
      splitMode: 'equal',
    };
    const deltas = expenseDeltas(expense);
    expect(deltas.clethers).toBe(40_000);
    expect(deltas.john).toBe(-10_000);
    expect(Object.values(deltas).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('routes exact splits through the same entry point', () => {
    const expense: ExpenseInput = {
      id: 'e1',
      payerId: 'a',
      amount: 100_000,
      participants: ['a', 'b'],
      splitMode: 'exact',
      exactShares: { a: 20_000, b: 80_000 },
    };
    expect(computeShares(expense)).toEqual({ a: 20_000, b: 80_000 });
  });
});
