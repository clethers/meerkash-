import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { AddFriendForm } from '@/components/friends/AddFriendForm';
import { FriendRequestsList } from '@/components/friends/FriendRequestsList';
import { getIncomingFriendRequests, getMyFriends } from '@/lib/data/friends';
import { formatPHP } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function FriendsPage() {
  const [friends, requests] = await Promise.all([getMyFriends(), getIncomingFriendRequests()]);

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Friends</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Balances here are separate from any group — just the two of you.
        </p>
      </div>

      {requests.length > 0 ? <FriendRequestsList requests={requests} /> : null}

      <AddFriendForm />

      {friends.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            title="No friends yet"
            description="Add someone by email to start tracking what you owe each other, outside of any group."
          />
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100 dark:divide-white/10 overflow-hidden">
          {friends.map(({ profile, netCentavos }) => (
            <li key={profile.id}>
              <Link
                href={`/friends/${profile.id}`}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <Avatar name={profile.display_name} src={profile.avatar_url} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-50">{profile.display_name}</p>
                </div>
                <div className="text-right">
                  {netCentavos === 0 ? (
                    <span className="text-sm text-slate-500 dark:text-slate-400">Settled up</span>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {netCentavos > 0 ? 'owes you' : 'you owe'}
                      </p>
                      <p className={`font-semibold ${netCentavos > 0 ? 'money-positive' : 'money-negative'}`}>
                        {formatPHP(Math.abs(netCentavos))}
                      </p>
                    </>
                  )}
                </div>
                <ChevronRight size={18} className="shrink-0 text-slate-300 dark:text-slate-600" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
