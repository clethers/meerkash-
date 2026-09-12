'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { Check, PartyPopper, UserPlus, X } from 'lucide-react';
import { inviteFriendToGroup } from '@/lib/actions/groups';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { InvitePanel } from '@/components/groups/InvitePanel';
import type { Profile } from '@/types/db';

export function InviteFriendsModal({
  groupId,
  groupName,
  friends,
  inviteUrl,
  qrSvg,
  inviteId,
}: {
  groupId: string;
  groupName: string;
  friends: Profile[];
  inviteUrl: string;
  qrSvg: string;
  inviteId: string;
}) {
  const router = useRouter();
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function close() {
    router.replace(`/groups/${groupId}`);
  }

  function invite(friendId: string) {
    setPendingId(friendId);
    startTransition(async () => {
      const result = await inviteFriendToGroup(groupId, friendId);
      setPendingId(null);
      if (result.ok) setInvited((prev) => new Set(prev).add(friendId));
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-friends-title"
        className="card max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="invite-friends-title" className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-50">
              <PartyPopper size={18} className="text-brand-600 dark:text-brand-400" /> {groupName} is ready
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Bring people in now, or skip and do it later.</p>
          </div>
          <button onClick={close} className="rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {friends.length > 0 ? (
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-white/10 rounded-xl border border-slate-200 dark:border-white/10">
            {friends.map((friend) => {
              const isInvited = invited.has(friend.id);
              return (
                <li key={friend.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={friend.display_name} src={friend.avatar_url} size={34} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-slate-50">
                    {friend.display_name}
                  </span>
                  <Button
                    variant={isInvited ? 'ghost' : 'secondary'}
                    size="sm"
                    disabled={isInvited || pendingId === friend.id}
                    onClick={() => invite(friend.id)}
                  >
                    {isInvited ? (
                      <>
                        <Check size={14} /> Invited
                      </>
                    ) : (
                      <>
                        <UserPlus size={14} /> {pendingId === friend.id ? 'Inviting…' : 'Invite'}
                      </>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 dark:border-white/15 px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
            You don&apos;t have any friends added yet — share the link below instead.
          </p>
        )}

        <div className="mt-4">
          <InvitePanel url={inviteUrl} qrSvg={qrSvg} inviteId={inviteId} groupId={groupId} />
        </div>

        <Button variant="ghost" className="mt-4 w-full" onClick={close}>
          Done
        </Button>
      </div>
    </div>,
    document.body,
  );
}
