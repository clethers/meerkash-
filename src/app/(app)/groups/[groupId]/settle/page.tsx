import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { GroupHeader } from '@/components/groups/GroupHeader';
import { SettlementResponse } from '@/components/settlements/SettlementResponse';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { getGroupBundle } from '@/lib/data/groups';
import { summarizeForUser } from '@/lib/balance';
import { PAYMENT_METHOD_LABEL } from '@/lib/constants';
import { formatMoney } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function SettleUpPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const bundle = await getGroupBundle(groupId);
  if (!bundle) notFound();

  const summary = summarizeForUser(bundle.ledger, bundle.me.id);
  const mine = bundle.settlements.filter(
    (s) => !s.deleted_at && (s.from_user_id === bundle.me.id || s.to_user_id === bundle.me.id),
  );
  const awaitingMe = mine.filter((s) => s.status === 'pending' && s.to_user_id === bundle.me.id);
  const rest = mine.filter((s) => !awaitingMe.includes(s));

  return (
    <div className="space-y-6">
      <Link
        href={`/groups/${groupId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> {bundle.group.name}
      </Link>

      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Settle up</h1>

      {awaitingMe.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel>Waiting for you</SectionLabel>
          <ul className="space-y-2">
            {awaitingMe.map((s) => (
              <li key={s.id} className="card space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={bundle.nameOf(s.from_user_id)}
                    src={bundle.members.find((m) => m.user_id === s.from_user_id)?.profile?.avatar_url}
                    size={38}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">
                      <strong className="font-medium">{bundle.nameOf(s.from_user_id)}</strong> says
                      they paid you {formatMoney(s.amount_centavos, bundle.group.currency)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {PAYMENT_METHOD_LABEL[s.method]} · {formatDateTime(s.created_at)}
                      {s.note ? ` · "${s.note}"` : ''}
                    </p>
                  </div>
                </div>
                <SettlementResponse
                  groupId={groupId}
                  settlementId={s.id}
                  hasProof={Boolean(s.proof_path)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionLabel>What you owe</SectionLabel>
        {summary.youOwe.length === 0 ? (
          <EmptyState
            title="You don't owe anyone in this group"
            description={
              summary.totalOwedToYou > 0
                ? `You are owed ${formatMoney(summary.totalOwedToYou, bundle.group.currency)}. They'll settle with you.`
                : 'Everything is squared away.'
            }
          />
        ) : (
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {summary.youOwe.map((line) => (
              <li key={line.userId}>
                <Link
                  href={`/groups/${groupId}/settle/${line.userId}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <Avatar
                    name={bundle.nameOf(line.userId)}
                    src={bundle.members.find((m) => m.user_id === line.userId)?.profile?.avatar_url}
                    size={36}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                    {bundle.nameOf(line.userId)}
                  </span>
                  <span className="font-semibold money-negative">{formatMoney(line.amount, bundle.group.currency)}</span>
                  <ArrowRight size={16} className="text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.owedToYou.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel>Owed to you</SectionLabel>
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {summary.owedToYou.map((line) => (
              <li key={line.userId} className="flex items-center gap-3 px-4 py-3">
                <Avatar
                  name={bundle.nameOf(line.userId)}
                  src={bundle.members.find((m) => m.user_id === line.userId)?.profile?.avatar_url}
                  size={36}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                  {bundle.nameOf(line.userId)}
                </span>
                <span className="font-semibold money-positive">{formatMoney(line.amount, bundle.group.currency)}</span>
              </li>
            ))}
          </ul>
          <Alert tone="info">
            Only the person paying can record a settlement. When they do, it appears here for you to
            confirm.
          </Alert>
        </section>
      ) : null}

      {rest.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel>Your settlement history</SectionLabel>
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {rest.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 text-slate-700">
                  {s.from_user_id === bundle.me.id
                    ? `You paid ${bundle.nameOf(s.to_user_id)}`
                    : `${bundle.nameOf(s.from_user_id)} paid you`}{' '}
                  <strong className="font-medium text-slate-900">
                    {formatMoney(s.amount_centavos, bundle.group.currency)}
                  </strong>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.status === 'confirmed'
                      ? 'bg-brand-100 text-brand-800'
                      : s.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
