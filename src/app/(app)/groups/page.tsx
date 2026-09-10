import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { CreateGroupForm } from '@/components/groups/CreateGroupForm';
import { BalanceRing } from '@/components/home/BalanceRing';
import { RecentActivityCard } from '@/components/home/RecentActivityCard';
import { getCurrentUser, getMyGroups, getRecentActivity } from '@/lib/data/groups';
import { getMyFriends } from '@/lib/data/friends';
import { sortFriendsByBalance } from '@/lib/friends';
import { convertCentavos } from '@/lib/fx';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function GroupsPage() {
  const [groups, me, friends, recentActivity] = await Promise.all([
    getMyGroups(),
    getCurrentUser(),
    getMyFriends(),
    getRecentActivity(),
  ]);
  const rankedFriends = sortFriendsByBalance(friends);

  // Groups can each have their own currency (sub-project 2) — never sum
  // balances across currencies into one number. Break it out per currency
  // instead, one line each.
  const byCurrency = new Map<string, number>();
  for (const { group, balance } of groups) {
    byCurrency.set(group.currency, (byCurrency.get(group.currency) ?? 0) + balance);
  }
  const nonZero = Array.from(byCurrency.entries()).filter(([, amount]) => amount !== 0);

  // Display-only: an approximate combined total in the viewer's preferred
  // currency. Never touches stored amounts — those stay in each group's own
  // currency — and silently drops currencies the free FX source can't rate
  // rather than failing the page.
  let convertedTotal: number | null = null;
  let convertedPartial = false;
  if (me?.preferred_currency && nonZero.length > 0) {
    const converted = await Promise.all(
      nonZero.map(([currency, amount]) => convertCentavos(amount, currency, me.preferred_currency!)),
    );
    const usable = converted.filter((c): c is number => c !== null);
    if (usable.length > 0) {
      convertedTotal = usable.reduce((sum, c) => sum + c, 0);
      convertedPartial = usable.length < converted.length;
    }
  }

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <BalanceRing friends={rankedFriends} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Your groups</h1>
          {groups.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">
              Start a group for your next trip, dinner or shared bill.
            </p>
          ) : nonZero.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">You are all settled up across every group.</p>
          ) : (
            <p className="mt-1 space-x-3 text-sm text-slate-600">
              {nonZero.map(([currency, amount]) => (
                <span key={currency}>
                  {amount > 0 ? 'You are owed ' : 'You owe '}
                  <strong className="font-medium text-slate-900">
                    {formatMoney(Math.abs(amount), currency)}
                  </strong>
                </span>
              ))}
            </p>
          )}
          {convertedTotal !== null && me?.preferred_currency ? (
            <p className="mt-1 text-xs text-slate-500">
              ≈ {formatMoney(Math.abs(convertedTotal), me.preferred_currency)} net in{' '}
              {me.preferred_currency}{convertedPartial ? ' (some currencies not converted)' : ''} —
              approximate, based on today&apos;s exchange rates
            </p>
          ) : null}
        </div>
        <CreateGroupForm />
      </div>

      <RecentActivityCard entries={recentActivity} />

      {groups.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            title="No groups yet"
            description="A group can be two friends, a couple, a family, housemates or the whole barkada. Every expense lives in one."
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {groups.map(({ group, balance, memberCount }) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="card flex items-center gap-4 p-4 transition-colors hover:border-brand-300"
              >
                <Avatar
                  name={group.name}
                  src={group.avatar_url}
                  seed={group.avatar_seed}
                  size={44}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{group.name}</p>
                  <p className="text-sm text-slate-500">
                    {memberCount} {memberCount === 1 ? 'member' : 'members'}
                  </p>
                </div>
                <div className="text-right">
                  {balance === 0 ? (
                    <span className="text-sm text-slate-500">Settled up</span>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500">
                        {balance > 0 ? 'you are owed' : 'you owe'}
                      </p>
                      <p
                        className={`font-semibold ${balance > 0 ? 'money-positive' : 'money-negative'}`}
                      >
                        {formatMoney(Math.abs(balance), group.currency)}
                      </p>
                    </>
                  )}
                </div>
                <ChevronRight size={18} className="shrink-0 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
