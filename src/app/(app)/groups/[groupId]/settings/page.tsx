import { notFound } from 'next/navigation';
import { GroupHeader } from '@/components/groups/GroupHeader';
import { GroupSettingsForm } from '@/components/groups/GroupSettingsForm';
import { Alert } from '@/components/ui/Alert';
import { getGroupCore } from '@/lib/data/groups';
import { CURRENCY_LABEL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const core = await getGroupCore(groupId);
  if (!core) notFound();

  return (
    <div className="space-y-6">
      <GroupHeader
        group={core.group}
        memberCount={core.activeMembers.length}
        current="/settings"
      />

      <GroupSettingsForm
        groupId={groupId}
        name={core.group.name}
        avatarUrl={core.group.avatar_url}
        defaultSplitMode={core.group.default_split_mode}
        canEdit={core.myRole === 'owner'}
      />

      <Alert tone="info">
        This group tracks amounts in {CURRENCY_LABEL[core.group.currency]}. One currency per
        group.
      </Alert>
    </div>
  );
}
