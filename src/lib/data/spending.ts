import 'server-only';
import { getCurrentUser } from '@/lib/data/groups';
import { createClient } from '@/lib/supabase/server';
import { convertCentavos } from '@/lib/fx';
import { summarizeAmounts } from '@/lib/spendingSummary';
import type { AmountSummary, CategorySpend, MonthSpend } from '@/lib/spendingSummary';
import type { CurrencyCode, ExpenseCategory } from '@/types/db';

export type { CategorySpend, MonthSpend };

export interface SpendingSummary extends AmountSummary {
  currency: string;
}

/**
 * Direct, narrow expenses query — only the fields this needs
 * (amount/category/created_at), filtered to non-deleted server-side
 * (this consumer never wants deleted rows, unlike ExpenseFilters).
 * Takes currency from the caller (already has it from getGroupCore)
 * instead of fetching a group/bundle just for that one field.
 */
export async function getSpendingSummary(
  groupId: string,
  currency: CurrencyCode,
  now = new Date(),
): Promise<SpendingSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('expenses')
    .select('amount_centavos, category, created_at')
    .eq('group_id', groupId)
    .is('deleted_at', null);

  const items = (data ?? []).map((e) => ({
    amount: e.amount_centavos,
    category: e.category as ExpenseCategory,
    createdAt: new Date(e.created_at),
  }));

  return { currency, ...summarizeAmounts(items, now) };
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
