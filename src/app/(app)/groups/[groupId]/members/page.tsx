import { notFound } from 'next/navigation';
import { GroupHeader } from '@/components/groups/GroupHeader';
import { InvitePanel } from '@/components/groups/InvitePanel';
import { LeaveGroupButton, OwnerMemberActions } from '@/components/groups/MemberActions';
import { Avatar } from '@/components/ui/Avatar';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { getGroupCore, getGroupLedger } from '@/lib/data/groups';
import { getOrCreateInvite, inviteQrSvg, inviteUrl } from '@/lib/data/invites';
import { canLeaveGroup, netFor } from '@/lib/balance';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function MembersPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const [core, ledgerData] = await Promise.all([getGroupCore(groupId), getGroupLedger(groupId)]);
  if (!core) notFound();

  const invite = await getOrCreateInvite(groupId);
  const qrSvg = invite ? await inviteQrSvg(invite.token) : '';
  const isOwner = core.myRole === 'owner';
  const leaveCheck = canLeaveGroup(ledgerData.ledger, core.me.id);
  const former = core.members.filter((m) => m.status !== 'active');

  return (
    <div className="space-y-6">
      <GroupHeader
        group={core.group}
        memberCount={core.activeMembers.length}
        current="/members"
      />

      {invite ? (
        <InvitePanel
          url={inviteUrl(invite.token)}
          qrSvg={qrSvg}
          inviteId={invite.id}
          groupId={groupId}
        />
      ) : null}

      <section className="space-y-3">
        <SectionLabel>Members ({core.activeMembers.length})</SectionLabel>
        <ul className="card divide-y divide-slate-100 overflow-hidden">
          {core.activeMembers.map((member) => {
            const net = netFor(ledgerData.ledger.net, member.user_id);
            const isMe = member.user_id === core.me.id;
            return (
              <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar
                  name={member.profile?.display_name ?? 'Member'}
                  src={member.profile?.avatar_url}
                  size={38}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">
                    {member.profile?.display_name ?? 'Member'}
                    {isMe ? ' (you)' : ''}
                    {member.role === 'owner' ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        owner
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {net === 0
                      ? 'settled up'
                      : net > 0
                        ? `is owed ${formatMoney(net, core.group.currency)}`
                        : `owes ${formatMoney(Math.abs(net), core.group.currency)}`}
                  </p>
                </div>

                {isOwner && !isMe ? (
                  <OwnerMemberActions
                    groupId={groupId}
                    userId={member.user_id}
                    name={member.profile?.display_name ?? 'this member'}
                    settled={net === 0}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {former.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel>No longer in this group</SectionLabel>
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {former.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar
                  name={member.profile?.display_name ?? 'Member'}
                  src={member.profile?.avatar_url}
                  size={32}
                  className="opacity-60"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                  {member.profile?.display_name ?? 'Member'}
                </span>
                <span className="text-xs text-slate-400">
                  {member.status === 'removed' ? 'removed' : 'left'}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            Their name stays on the expenses and settlements they were part of.
          </p>
        </section>
      ) : null}

      <section className="space-y-3 border-t border-slate-200 pt-6">
        <LeaveGroupButton
          groupId={groupId}
          blockedReason={leaveCheck.allowed ? null : (leaveCheck.reason ?? null)}
        />
        {isOwner && core.activeMembers.length > 1 ? (
          <p className="text-xs text-slate-500">
            As the owner, transfer ownership to someone else before you leave.
          </p>
        ) : null}
      </section>
    </div>
  );
}
