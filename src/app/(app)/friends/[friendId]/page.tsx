import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Plus, Wallet } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { RemoveFriendButton } from '@/components/friends/RemoveFriendButton';
import { DirectSettlementResponse } from '@/components/friends/DirectSettlementResponse';
import { getFriendBundle } from '@/lib/data/friends';
import { summarizeForUser } from '@/lib/balance';
import { formatPHP } from '@/lib/money';
import { relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function FriendPage({ params }: { params: Promise<{ friendId: string }> }) {
  const { friendId } = await params;
  const bundle = await getFriendBundle(friendId);
  if (!bundle) notFound();

  const summary = summarizeForUser(bundle.ledger, bundle.me.id);
  const awaitingMe = bundle.settlements.filter(
    (s) => !s.deleted_at && s.status === 'pending' && s.to_user_id === bundle.me.id,
  );

  const timeline = [
    ...bundle.expenses
      .filter((e) => !e.deleted_at)
      .map((e) => ({
        kind: 'expense' as const,
        id: e.id,
        createdAt: e.created_at,
        description: e.description,
        amount: e.amount_centavos,
        paidByMe: e.payer_id === bundle.me.id,
      })),
    ...bundle.settlements
      .filter((s) => !s.deleted_at)
      .map((s) => ({
        kind: 'settlement' as const,
        id: s.id,
        createdAt: s.created_at,
        status: s.status,
        amount: s.amount_centavos,
        paidByMe: s.from_user_id === bundle.me.id,
      })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <Link
        href="/friends"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Friends
      </Link>

      <div className="flex items-center gap-3">
        <Avatar name={bundle.friend.display_name} src={bundle.friend.avatar_url} size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">
            {bundle.friend.display_name}
          </h1>
          <p className="text-sm text-slate-500">Direct balance — separate from any group</p>
        </div>
        <RemoveFriendButton friendId={friendId} friendName={bundle.friend.display_name} />
      </div>

      <div className="card overflow-hidden">
        {summary.settledUp ? (
          <div className="p-5">
            <p className="text-lg font-semibold text-slate-900">You are all settled up</p>
            <p className="mt-1 text-sm text-slate-600">
              Neither of you owes the other anything right now.
            </p>
          </div>
        ) : (
          <div className={`px-5 py-4 ${summary.net > 0 ? 'bg-brand-50' : 'bg-rose-50'}`}>
            <p className="text-sm text-slate-600">
              {summary.net > 0 ? `${bundle.friend.display_name} owes you` : `You owe ${bundle.friend.display_name}`}
            </p>
            <p className={`text-3xl font-semibold tracking-tight ${summary.net > 0 ? 'money-positive' : 'money-negative'}`}>
              {formatPHP(Math.abs(summary.net))}
            </p>
          </div>
        )}
      </div>

      {awaitingMe.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel>Waiting for you</SectionLabel>
          <ul className="space-y-2">
            {awaitingMe.map((s) => (
              <li key={s.id} className="card space-y-3 p-4">
                <p className="text-sm text-slate-800">
                  <strong className="font-medium">{bundle.friend.display_name}</strong> says they
                  paid you {formatPHP(s.amount_centavos)}
                </p>
                <DirectSettlementResponse settlementId={s.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/friends/${friendId}/expenses/new`}>
          <Plus size={16} /> Add expense
        </ButtonLink>
        <ButtonLink href={`/friends/${friendId}/settle`} variant="secondary">
          <Wallet size={16} /> Settle up
        </ButtonLink>
      </div>

      <section className="space-y-3">
        <SectionLabel>History</SectionLabel>
        {timeline.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            description={`Add an expense you shared with ${bundle.friend.display_name} to get started.`}
          />
        ) : (
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {timeline.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1 text-slate-700">
                  {item.kind === 'expense' ? (
                    <>
                      <strong className="font-medium text-slate-900">
                        {item.paidByMe ? 'You' : bundle.friend.display_name}
                      </strong>{' '}
                      paid for <strong className="font-medium text-slate-900">{item.description}</strong>
                    </>
                  ) : (
                    <>
                      <strong className="font-medium text-slate-900">
                        {item.paidByMe ? 'You' : bundle.friend.display_name}
                      </strong>{' '}
                      paid{' '}
                      <strong className="font-medium text-slate-900">
                        {item.paidByMe ? bundle.friend.display_name : 'you'}
                      </strong>
                    </>
                  )}
                </span>
                <span className="font-semibold text-slate-900">{formatPHP(item.amount)}</span>
                {item.kind === 'settlement' ? (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : item.status === 'confirmed'
                          ? 'bg-brand-100 text-brand-800'
                          : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {item.status}
                  </span>
                ) : null}
                <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">
                  {relativeTime(item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
