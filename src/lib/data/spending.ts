import 'server-only';
import { getGroupBundle, type ExpenseWithDetail } from '@/lib/data/groups';
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

export interface SpendingSummary {
  currency: string;
  totalAllTime: number;
  totalThisMonth: number;
  byCategory: CategorySpend[];
  byMonth: MonthSpend[];
}

/**
 * Reuses getGroupBundle (React-cached per request) instead of issuing a
 * second expenses query — the bundle already holds the full RLS-scoped
 * expense history that buildLedger needs anyway.
 */
export async function getSpendingSummary(
  groupId: string,
  now = new Date(),
): Promise<SpendingSummary | null> {
  const bundle = await getGroupBundle(groupId);
  if (!bundle) return null;

  return summarize(bundle.expenses, bundle.group.currency, now);
}

export function summarize(
  expenses: ExpenseWithDetail[],
  currency: string,
  now = new Date(),
): SpendingSummary {
  const active = expenses.filter((e) => !e.deleted_at);

  const totalAllTime = active.reduce((sum, e) => sum + e.amount_centavos, 0);

  const currentMonthKey = monthKey(now);
  const totalThisMonth = active
    .filter((e) => monthKey(new Date(e.created_at)) === currentMonthKey)
    .reduce((sum, e) => sum + e.amount_centavos, 0);

  const categoryTotals = new Map<ExpenseCategory, number>();
  for (const e of active) {
    categoryTotals.set(e.category, (categoryTotals.get(e.category) ?? 0) + e.amount_centavos);
  }
  const byCategory = [...categoryTotals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const monthKeys = lastSixMonthKeys(now);
  const monthTotals = new Map<string, number>();
  for (const e of active) {
    const key = monthKey(new Date(e.created_at));
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + e.amount_centavos);
  }
  const byMonth = monthKeys.map((key) => ({
    key,
    label: monthLabel(key),
    total: monthTotals.get(key) ?? 0,
  }));

  return { currency, totalAllTime, totalThisMonth, byCategory, byMonth };
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
