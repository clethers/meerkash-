import { describe, expect, it } from 'vitest';
import { summarizeAmounts } from '@/lib/spendingSummary';
import type { SpendItem } from '@/lib/spendingSummary';

const item = (over: Partial<SpendItem> & Pick<SpendItem, 'amount' | 'category' | 'createdAt'>): SpendItem => over;

describe('summarizeAmounts', () => {
  it('returns zeroed totals and a full 6-month axis for no items', () => {
    const now = new Date('2026-03-15');
    const summary = summarizeAmounts([], now);

    expect(summary.totalAllTime).toBe(0);
    expect(summary.totalThisMonth).toBe(0);
    expect(summary.byCategory).toEqual([]);
    expect(summary.byMonth).toHaveLength(6);
    expect(summary.byMonth.map((m) => m.key)).toEqual([
      '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
    ]);
    expect(summary.byMonth.every((m) => m.total === 0)).toBe(true);
  });

  it('sums all items regardless of date for totalAllTime', () => {
    const now = new Date('2026-03-15');
    const items: SpendItem[] = [
      item({ amount: 1000, category: 'food_dining', createdAt: new Date('2025-01-01') }),
      item({ amount: 2500, category: 'transportation', createdAt: new Date('2026-03-01') }),
    ];

    expect(summarizeAmounts(items, now).totalAllTime).toBe(3500);
  });

  it('only counts items from the current calendar month toward totalThisMonth', () => {
    const now = new Date('2026-03-15');
    const items: SpendItem[] = [
      item({ amount: 1000, category: 'food_dining', createdAt: new Date('2026-03-01') }),
      item({ amount: 500, category: 'food_dining', createdAt: new Date('2026-02-28') }),
    ];

    expect(summarizeAmounts(items, now).totalThisMonth).toBe(1000);
  });

  it('groups by category and sorts descending by total', () => {
    const now = new Date('2026-03-15');
    const items: SpendItem[] = [
      item({ amount: 100, category: 'groceries', createdAt: now }),
      item({ amount: 500, category: 'travel', createdAt: now }),
      item({ amount: 200, category: 'groceries', createdAt: now }),
    ];

    expect(summarizeAmounts(items, now).byCategory).toEqual([
      { category: 'travel', total: 500 },
      { category: 'groceries', total: 300 },
    ]);
  });

  it('buckets items into their month within a trailing 6-month window', () => {
    const now = new Date('2026-03-15');
    const items: SpendItem[] = [
      item({ amount: 100, category: 'other', createdAt: new Date('2026-01-10') }),
      item({ amount: 50, category: 'other', createdAt: new Date('2026-01-20') }),
      item({ amount: 900, category: 'other', createdAt: new Date('2025-06-01') }), // outside the window
    ];

    const byMonth = summarizeAmounts(items, now).byMonth;
    expect(byMonth.find((m) => m.key === '2026-01')?.total).toBe(150);
    expect(byMonth.reduce((sum, m) => sum + m.total, 0)).toBe(150);
  });
});
