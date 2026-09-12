import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { describeActivity } from '@/lib/activity';
import { relativeTime } from '@/lib/utils';
import type { RecentActivityEntry } from '@/lib/data/groups';

export function RecentActivityCard({ entries }: { entries: RecentActivityEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div>
      <SectionLabel className="mb-1.5">Recent activity</SectionLabel>
      <ul className="card divide-y divide-slate-100 dark:divide-white/10 overflow-hidden">
        {entries.map((entry) => {
          // Only the actor's name is loaded for this cross-group preview —
          // a second name (a settlement's other party, a removed member)
          // falls back to "Someone" here; the full picture is one tap away
          // on that group's own activity page.
          const nameOf = (id: string) =>
            id === entry.actor_id ? (entry.actor?.display_name ?? 'Someone') : 'Someone';

          return (
            <li key={entry.id}>
              <Link
                href={`/groups/${entry.group.id}/activity`}
                className="flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <Avatar name={entry.actor?.display_name ?? 'Someone'} src={entry.actor?.avatar_url} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 dark:text-slate-200">{describeActivity(entry, nameOf, entry.group.currency)}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="rounded-full bg-brand-50 dark:bg-brand-500/15 px-2 py-0.5 font-medium text-brand-700 dark:text-brand-300">
                      {entry.group.name}
                    </span>
                    <span>{relativeTime(entry.created_at)}</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
