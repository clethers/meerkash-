import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types/db';

export function BalanceRing({
  friends,
}: {
  friends: Array<{ profile: Profile; netCentavos: number }>;
}) {
  if (friends.length === 0) return null;

  return (
    <div className="scroll-x flex gap-4 px-0.5 pb-1">
      {friends.map(({ profile, netCentavos }) => (
        <Link
          key={profile.id}
          href={`/friends/${profile.id}`}
          className="flex w-14 shrink-0 flex-col items-center gap-1.5"
        >
          <span
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full p-0.5',
              netCentavos < 0 && 'bg-gradient-to-tr from-rose-300 to-rose-600',
              netCentavos > 0 && 'bg-gradient-to-tr from-brand-300 to-brand-600',
              netCentavos === 0 && 'bg-slate-300',
            )}
          >
            <Avatar
              name={profile.display_name}
              src={profile.avatar_url}
              size={52}
              className="border-2 border-paper"
            />
          </span>
          <span className="w-full truncate text-center text-[11px] text-slate-600">
            {profile.display_name}
          </span>
        </Link>
      ))}
    </div>
  );
}
