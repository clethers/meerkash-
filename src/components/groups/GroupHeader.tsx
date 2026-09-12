import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { CURRENCY_LABEL } from '@/lib/constants';
import type { Group } from '@/types/db';

const TABS = [
  { href: '', label: 'Overview' },
  { href: '/activity', label: 'Activity' },
  { href: '/spending', label: 'Spending' },
  { href: '/members', label: 'Members' },
  { href: '/recurring', label: 'Recurring' },
  { href: '/settings', label: 'Settings' },
] as const;

export function GroupHeader({
  group,
  memberCount,
  current = '',
}: {
  group: Group;
  memberCount: number;
  current?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={group.name} src={group.avatar_url} seed={group.avatar_seed} size={48} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {group.name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {memberCount} {memberCount === 1 ? 'member' : 'members'} · {CURRENCY_LABEL[group.currency]}
          </p>
        </div>
      </div>

      <nav className="scroll-x -mx-1 flex gap-1 border-b border-slate-200 dark:border-white/10 pb-px">
        {TABS.map((tab) => {
          const active = current === tab.href;
          return (
            <Link
              key={tab.href}
              href={`/groups/${group.id}${tab.href}`}
              className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400'
                  : 'border-b-2 border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
