import { notFound } from 'next/navigation';
import { Plus, Wallet, ArrowRight } from 'lucide-react';
import { getGroupBundle } from '@/lib/data/groups';
import { summarizeForUser } from '@/lib/balance';
import { formatMoney } from '@/lib/money';
import { relativeTime } from '@/lib/utils';
import styles from './glass.module.css';

export const dynamic = 'force-dynamic';

/**
 * THROWAWAY design spike — not linked from any nav, not meant to ship.
 * Re-renders the real group overview with a glassmorphism treatment, using
 * live data, so it can be judged against actual content before deciding
 * whether to pursue this direction anywhere for real.
 */
export default async function GlassPreviewPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const bundle = await getGroupBundle(groupId);
  if (!bundle) notFound();

  const summary = summarizeForUser(bundle.ledger, bundle.me.id);
  const recentSettlements = bundle.settlements.filter((s) => !s.deleted_at).slice(0, 4);
  const recentExpenses = bundle.expenses.filter((e) => !e.deleted_at).slice(0, 6);

  return (
    <div className={styles.stage}>
      <div className={styles.backdrop} aria-hidden="true" />

      <div className="space-y-6">
        <div className={`${styles.glass} ${styles.glassStrong} px-5 py-4`}>
          <p className="text-xs font-medium text-slate-600">
            Design spike, not shipped — glassmorphism preview
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {bundle.group.name}
          </h1>
          <p className="text-sm text-slate-700">
            {bundle.activeMembers.length} member{bundle.activeMembers.length === 1 ? '' : 's'} ·{' '}
            {bundle.group.currency}
          </p>
        </div>

        <div className={`${styles.glass} p-5`}>
          <p className="font-medium text-slate-900">
            {summary.settledUp ? 'You are all settled up' : 'You have an open balance'}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {summary.settledUp
              ? 'Nobody owes you anything in this group, and you owe nothing.'
              : summary.net > 0
                ? `You are owed ${formatMoney(summary.net, bundle.group.currency)}.`
                : `You owe ${formatMoney(Math.abs(summary.net), bundle.group.currency)}.`}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className={`${styles.glass} p-4`}>
            <p className="text-xs font-medium text-slate-600">Total group spending</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatMoney(bundle.ledger.totalSpent, bundle.group.currency)}
            </p>
          </div>
          <div className={`${styles.glass} p-4`}>
            <p className="text-xs font-medium text-slate-600">Expenses recorded</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {bundle.expenses.filter((e) => !e.deleted_at).length}
            </p>
          </div>
          <div className={`${styles.glass} p-4`}>
            <p className="text-xs font-medium text-slate-600">Payments settled</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {bundle.settlements.filter((s) => s.status === 'confirmed').length}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`${styles.pill} flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-900`}
          >
            <Plus size={16} /> Add expense
          </button>
          <button
            type="button"
            className={`${styles.pill} flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-900`}
          >
            <Wallet size={16} /> Settle up
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-800">Expenses</p>
          {recentExpenses.length === 0 ? (
            <div className={`${styles.glass} p-6 text-center text-sm text-slate-600`}>
              No expenses yet.
            </div>
          ) : (
            <div className={`${styles.glass} divide-y divide-white/40 overflow-hidden`}>
              {recentExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{expense.description}</p>
                    <p className="text-xs text-slate-600">
                      {bundle.nameOf(expense.payer_id)} paid · {relativeTime(expense.created_at)}
                    </p>
                  </div>
                  <p className="font-semibold text-slate-900">
                    {formatMoney(expense.amount_centavos, bundle.group.currency)}
                  </p>
                  <ArrowRight size={16} className="shrink-0 text-slate-400" />
                </div>
              ))}
            </div>
          )}
        </div>

        {recentSettlements.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">Recent settlements</p>
            <div className={`${styles.glass} divide-y divide-white/40 overflow-hidden`}>
              {recentSettlements.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="flex-1 text-slate-800">
                    {s.from_user_id === bundle.me.id ? 'You' : bundle.nameOf(s.from_user_id)} paid{' '}
                    {s.to_user_id === bundle.me.id ? 'you' : bundle.nameOf(s.to_user_id)}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(s.amount_centavos, bundle.group.currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
