import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CategoryBarChart, MonthBarChart } from '@/components/groups/SpendingCharts';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { getCurrentUser } from '@/lib/data/groups';
import { getMyPersonalSpending } from '@/lib/data/spending';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function PersonalSpendingPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const overview = await getMyPersonalSpending();
  if (!overview) redirect('/login');

  const hasSpending = overview.byCurrency.some((c) => c.totalAllTime > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-white/10"
          aria-label="Back to your account"
        >
          <ChevronLeft size={18} />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Your spending</h1>
      </div>

      {!hasSpending ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            title="No spending yet"
            description="Once you're added to an expense, your personal totals and trends will show up here."
          />
        </div>
      ) : (
        <>
          {overview.convertedTotalAllTime ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ≈{' '}
              <strong className="font-medium text-slate-900 dark:text-slate-50">
                {formatMoney(overview.convertedTotalAllTime.amount, overview.convertedTotalAllTime.currency)}
              </strong>{' '}
              total in {overview.convertedTotalAllTime.currency}
              {overview.convertedTotalAllTime.partial ? ' (some currencies not converted)' : ''} —
              approximate, based on today&apos;s exchange rates
            </p>
          ) : null}

          {overview.byCurrency.map((summary) => (
            <section key={summary.currency} className="space-y-4">
              {overview.byCurrency.length > 1 ? (
                <SectionLabel as="h2" className="text-base">{summary.currency}</SectionLabel>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <Stat label="Your total spent (all time)" value={formatMoney(summary.totalAllTime, summary.currency)} />
                <Stat label="Your spending this month" value={formatMoney(summary.totalThisMonth, summary.currency)} />
              </div>

              <section className="card space-y-4 p-4">
                <SectionLabel>Spend by category</SectionLabel>
                <CategoryBarChart data={summary.byCategory} currency={summary.currency} />
              </section>

              <section className="card space-y-4 p-4">
                <SectionLabel>Spend by month</SectionLabel>
                <MonthBarChart data={summary.byMonth} currency={summary.currency} />
              </section>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{value}</p>
    </div>
  );
}
