import { notFound } from 'next/navigation';
import { GroupHeader } from '@/components/groups/GroupHeader';
import { GroupSettingsForm } from '@/components/groups/GroupSettingsForm';
import { Alert } from '@/components/ui/Alert';
import { getGroupBundle } from '@/lib/data/groups';
import { CURRENCY_LABEL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const bundle = await getGroupBundle(groupId);
  if (!bundle) notFound();

  return (
    <div className="space-y-6">
      <GroupHeader
        group={bundle.group}
        memberCount={bundle.activeMembers.length}
        current="/settings"
      />

      <GroupSettingsForm
        groupId={groupId}
        name={bundle.group.name}
        avatarUrl={bundle.group.avatar_url}
        defaultSplitMode={bundle.group.default_split_mode}
        canEdit={bundle.myRole === 'owner'}
      />

      <Alert tone="info">
        This group tracks amounts in {CURRENCY_LABEL[bundle.group.currency]}. One currency per
        group.
      </Alert>
    </div>
  );
}
