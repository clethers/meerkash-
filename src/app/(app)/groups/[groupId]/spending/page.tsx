import { notFound } from 'next/navigation';
import { GroupHeader } from '@/components/groups/GroupHeader';
import { CategoryBarChart, MonthBarChart } from '@/components/groups/SpendingCharts';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { getGroupBundle } from '@/lib/data/groups';
import { getSpendingSummary } from '@/lib/data/spending';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function SpendingPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const bundle = await getGroupBundle(groupId);
  if (!bundle) notFound();

  const summary = await getSpendingSummary(groupId);
  if (!summary) notFound();

  const hasSpending = summary.totalAllTime > 0;

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <GroupHeader
        group={bundle.group}
        memberCount={bundle.activeMembers.length}
        current="/spending"
      />

      {!hasSpending ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            title="No spending yet"
            description="Add an expense to see totals and trends for this group."
          />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Total spent (all time)" value={formatMoney(summary.totalAllTime, summary.currency)} />
            <Stat label="Spent this month" value={formatMoney(summary.totalThisMonth, summary.currency)} />
          </div>

          <section className="card space-y-4 p-4">
            <SectionLabel>Spend by category</SectionLabel>
            <CategoryBarChart data={summary.byCategory} currency={summary.currency} />
          </section>

          <section className="card space-y-4 p-4">
            <SectionLabel>Spend by month</SectionLabel>
            <MonthBarChart data={summary.byMonth} currency={summary.currency} />
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
