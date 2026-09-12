import 'server-only';
import { getCurrentUser, getGroupBundle } from '@/lib/data/groups';
import { createClient } from '@/lib/supabase/server';
import { convertCentavos } from '@/lib/fx';
import { summarizeAmounts } from '@/lib/spendingSummary';
import type { AmountSummary, CategorySpend, MonthSpend } from '@/lib/spendingSummary';
import type { ExpenseCategory } from '@/types/db';

export type { CategorySpend, MonthSpend };

export interface SpendingSummary extends AmountSummary {
  currency: string;
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

  const active = bundle.expenses.filter((e) => !e.deleted_at);
  const items = active.map((e) => ({
    amount: e.amount_centavos,
    category: e.category,
    createdAt: new Date(e.created_at),
  }));

  return { currency: bundle.group.currency, ...summarizeAmounts(items, now) };
}

export interface PersonalSpendingByCurrency extends AmountSummary {
  currency: string;
}

export interface ConvertedTotal {
  amount: number;
  currency: string;
  partial: boolean;
}

export interface PersonalSpendingOverview {
  byCurrency: PersonalSpendingByCurrency[];
  /** Display-only combined total in the viewer's preferred currency, or null
   * when they haven't set one, have no spending, or no rate is available. */
  convertedTotalAllTime: ConvertedTotal | null;
}

interface ParticipantRow {
  share_centavos: number;
  expense: {
    category: ExpenseCategory;
    created_at: string;
    deleted_at: string | null;
    group: { currency: string } | null;
  } | null;
}

/**
 * The user's own share of every expense they're part of, across every
 * group — grouped by currency (never summed across currencies, same rule
 * the groups home page follows) plus an optional approximate combined
 * total. RLS on expense_participants already scopes this to groups the
 * caller is an active member of.
 */
export async function getMyPersonalSpending(now = new Date()): Promise<PersonalSpendingOverview | null> {
  const me = await getCurrentUser();
  if (!me) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('expense_participants')
    .select('share_centavos, expense:expenses(category, created_at, deleted_at, group:groups(currency))')
    .eq('user_id', me.id);

  const rows = (data ?? []) as unknown as ParticipantRow[];

  const itemsByCurrency = new Map<string, { amount: number; category: ExpenseCategory; createdAt: Date }[]>();
  for (const row of rows) {
    const expense = row.expense;
    if (!expense || expense.deleted_at) continue;

    // Direct friend-to-friend expenses have group_id = null (no groups row
    // to read a currency from) and are always created in PHP — see
    // createDirectExpense in lib/actions/friends.ts.
    const currency = expense.group?.currency ?? 'PHP';
    const list = itemsByCurrency.get(currency) ?? [];
    list.push({ amount: row.share_centavos, category: expense.category, createdAt: new Date(expense.created_at) });
    itemsByCurrency.set(currency, list);
  }

  const byCurrency = [...itemsByCurrency.entries()]
    .map(([currency, items]) => ({ currency, ...summarizeAmounts(items, now) }))
    .sort((a, b) => b.totalAllTime - a.totalAllTime);

  let convertedTotalAllTime: ConvertedTotal | null = null;
  if (me.preferred_currency && byCurrency.length > 0) {
    const converted = await Promise.all(
      byCurrency.map((c) => convertCentavos(c.totalAllTime, c.currency, me.preferred_currency!)),
    );
    const usable = converted.filter((c): c is number => c !== null);
    if (usable.length > 0) {
      convertedTotalAllTime = {
        amount: usable.reduce((sum, c) => sum + c, 0),
        currency: me.preferred_currency,
        partial: usable.length < converted.length,
      };
    }
  }

  return { byCurrency, convertedTotalAllTime };
}
