import Link from 'next/link';
import Image from 'next/image';
import { Bell, UserRound, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { getUnreadCount } from '@/lib/actions/notifications';
import { getIncomingFriendRequests } from '@/lib/data/friends';
import { getCurrentUser } from '@/lib/data/groups';

export async function AppNav() {
  // Fetched here (rather than passed down from the layout) so it runs in
  // parallel with the page's own data instead of blocking the whole tree —
  // the layout only awaits the lightweight auth check before rendering.
  const [me, unread, incomingRequests] = await Promise.all([
    getCurrentUser(),
    getUnreadCount(),
    getIncomingFriendRequests(),
  ]);
  if (!me) return null;
  const pendingRequests = incomingRequests.length;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="relative mx-auto flex h-16 max-w-4xl items-center px-4">
        <Link href="/groups" className="absolute left-4 top-2 z-30">
          <Image
            src="/logo.png"
            alt="Meerkash"
            width={139}
            height={100}
            className="h-[76px] w-auto drop-shadow-lg"
            priority
          />
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/groups"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <Users size={16} />
            <span className="hidden sm:inline">Groups</span>
          </Link>

          <Link
            href="/friends"
            className="relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            aria-label={pendingRequests > 0 ? `Friends, ${pendingRequests} pending request` : 'Friends'}
          >
            <UserRound size={16} />
            <span className="hidden sm:inline">Friends</span>
            {pendingRequests > 0 ? (
              <span className="absolute right-1.5 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {pendingRequests > 9 ? '9+' : pendingRequests}
              </span>
            ) : null}
          </Link>

          <Link
            href="/notifications"
            className="relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
          >
            <Bell size={16} />
            <span className="hidden sm:inline">Alerts</span>
            {unread > 0 ? (
              <span className="absolute right-1.5 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </Link>

          <Link href="/settings" className="ml-1 rounded-full" aria-label="Your account">
            <Avatar name={me.display_name} src={me.avatar_url} size={32} />
          </Link>
        </div>
      </nav>
    </header>
  );
}
