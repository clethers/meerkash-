import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Plus, Wallet } from 'lucide-react';
import { GroupHeader } from '@/components/groups/GroupHeader';
import { BalanceSummary } from '@/components/groups/BalanceSummary';
import { ExpenseFilters } from '@/components/expenses/ExpenseFilters';
import { ButtonLink } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { getGroupBundle } from '@/lib/data/groups';
import { summarizeForUser } from '@/lib/balance';
import { formatMoney } from '@/lib/money';
import { relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const bundle = await getGroupBundle(groupId);
  if (!bundle) notFound();

  const summary = summarizeForUser(bundle.ledger, bundle.me.id);
  const avatarOf = (id: string) =>
    bundle.members.find((m) => m.user_id === id)?.profile?.avatar_url ?? null;

  const pendingForMe = bundle.settlements.filter(
    (s) => s.status === 'pending' && s.to_user_id === bundle.me.id && !s.deleted_at,
  );
  const recentSettlements = bundle.settlements.filter((s) => !s.deleted_at).slice(0, 4);

  return (
    <div className="space-y-6">
      <GroupHeader group={bundle.group} memberCount={bundle.activeMembers.length} />

      {pendingForMe.length > 0 ? (
        <Link
          href={`/groups/${groupId}/settle`}
          className="card flex items-center gap-3 border-amber-300 bg-amber-50 p-4 hover:border-amber-400"
        >
          <Wallet size={18} className="text-amber-700" />
          <span className="flex-1 text-sm text-amber-900">
            {pendingForMe.length === 1
              ? `${bundle.nameOf(pendingForMe[0].from_user_id)} says they paid you ${formatMoney(pendingForMe[0].amount_centavos, bundle.group.currency)}.`
              : `${pendingForMe.length} payments are waiting for you to confirm.`}
          </span>
          <ArrowRight size={16} className="text-amber-700" />
        </Link>
      ) : null}

      <BalanceSummary
        summary={summary}
        groupId={groupId}
        nameOf={bundle.nameOf}
        avatarOf={avatarOf}
        currency={bundle.group.currency}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total group spending" value={formatMoney(bundle.ledger.totalSpent, bundle.group.currency)} />
        <Stat
          label="Expenses recorded"
          value={String(bundle.expenses.filter((e) => !e.deleted_at).length)}
        />
        <Stat
          label="Payments settled"
          value={String(bundle.settlements.filter((s) => s.status === 'confirmed').length)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/groups/${groupId}/expenses/new`}>
          <Plus size={16} /> Add expense
        </ButtonLink>
        <ButtonLink href={`/groups/${groupId}/settle`} variant="secondary">
          <Wallet size={16} /> Settle up
        </ButtonLink>
      </div>

      <section className="space-y-3">
        <SectionLabel>Expenses</SectionLabel>
        <ExpenseFilters
          expenses={bundle.expenses}
          groupId={groupId}
          viewerId={bundle.me.id}
          members={bundle.members.map((m) => ({
            id: m.user_id,
            name: m.profile?.display_name ?? 'Member',
          }))}
          currency={bundle.group.currency}
        />
      </section>

      {recentSettlements.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel>Recent settlements</SectionLabel>
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {recentSettlements.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1 text-slate-700">
                  <strong className="font-medium text-slate-900">
                    {s.from_user_id === bundle.me.id ? 'You' : bundle.nameOf(s.from_user_id)}
                  </strong>{' '}
                  paid{' '}
                  <strong className="font-medium text-slate-900">
                    {s.to_user_id === bundle.me.id ? 'you' : bundle.nameOf(s.to_user_id)}
                  </strong>{' '}
                  {formatMoney(s.amount_centavos, bundle.group.currency)}
                </span>
                <StatusPill status={s.status} />
                <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">
                  {relativeTime(s.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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

function StatusPill({ status }: { status: 'pending' | 'confirmed' | 'rejected' }) {
  const styles = {
    pending: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-brand-100 text-brand-800',
    rejected: 'bg-slate-200 text-slate-600',
  } as const;
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}
