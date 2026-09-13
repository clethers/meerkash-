import { notFound } from 'next/navigation';
import { GroupHeader } from '@/components/groups/GroupHeader';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { describeActivity } from '@/lib/activity';
import { getActivity, getGroupCore } from '@/lib/data/groups';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const core = await getGroupCore(groupId);
  if (!core) notFound();

  const entries = await getActivity(groupId, 200);

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <GroupHeader
        group={core.group}
        memberCount={core.activeMembers.length}
        current="/activity"
      />

      <div>
        <SectionLabel>Everything that happened</SectionLabel>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          A permanent record, including expenses that were edited or deleted.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState title="Nothing has happened yet" description="Add an expense to get started." />
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100 dark:divide-white/10 overflow-hidden">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-3 px-4 py-3">
              <Avatar
                name={core.nameOf(entry.actor_id ?? '')}
                src={core.members.find((m) => m.user_id === entry.actor_id)?.profile?.avatar_url}
                size={30}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800 dark:text-slate-100">{describeActivity(entry, core.nameOf, core.group.currency)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(entry.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
