import type { ExpenseCategory } from '@/types/db';

export interface CategorySpend {
  category: ExpenseCategory;
  total: number;
}

export interface MonthSpend {
  key: string;
  label: string;
  total: number;
}

export interface AmountSummary {
  totalAllTime: number;
  totalThisMonth: number;
  byCategory: CategorySpend[];
  byMonth: MonthSpend[];
}

export interface SpendItem {
  amount: number;
  category: ExpenseCategory;
  createdAt: Date;
}

/**
 * Currency-agnostic aggregation over a flat list of amounts (full expense
 * totals for a group summary, or a user's own share for a personal one) —
 * callers attach whatever currency the amounts are denominated in.
 */
export function summarizeAmounts(items: SpendItem[], now = new Date()): AmountSummary {
  const totalAllTime = items.reduce((sum, i) => sum + i.amount, 0);

  const currentMonthKey = monthKey(now);
  const totalThisMonth = items
    .filter((i) => monthKey(i.createdAt) === currentMonthKey)
    .reduce((sum, i) => sum + i.amount, 0);

  const categoryTotals = new Map<ExpenseCategory, number>();
  for (const i of items) {
    categoryTotals.set(i.category, (categoryTotals.get(i.category) ?? 0) + i.amount);
  }
  const byCategory = [...categoryTotals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const monthKeys = lastSixMonthKeys(now);
  const monthTotals = new Map<string, number>();
  for (const i of items) {
    const key = monthKey(i.createdAt);
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + i.amount);
  }
  const byMonth = monthKeys.map((key) => ({
    key,
    label: monthLabel(key),
    total: monthTotals.get(key) ?? 0,
  }));

  return { totalAllTime, totalThisMonth, byCategory, byMonth };
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

function lastSixMonthKeys(now: Date): string[] {
  const out: string[] = [];
  for (let i = 5; i >= 0; i--) {
    out.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return out;
}
