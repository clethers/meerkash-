'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Crown, LogOut, UserMinus } from 'lucide-react';
import { leaveGroup, removeMember, transferOwnership } from '@/lib/actions/groups';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

export function OwnerMemberActions({
  groupId,
  userId,
  name,
  settled,
}: {
  groupId: string;
  userId: string;
  name: string;
  settled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'remove' | 'transfer' | null>(null);
  const [pending, start] = useTransition();

  if (confirm === 'remove') {
    return (
      <div className="w-full space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
        <p className="text-sm text-rose-900">
          Remove {name} from this group? Their name stays on past expenses and settlements.
        </p>
        {error ? <p className="text-sm font-medium text-rose-800">{error}</p> : null}
        <div className="flex gap-2">
          <Button
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await removeMember(groupId, userId);
                if (result.ok) { setConfirm(null); router.refresh(); }
                else setError(result.error ?? 'Could not remove that member.');
              })
            }
          >
            {pending ? 'Removing…' : 'Remove'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setConfirm(null)}>Cancel</Button>
        </div>
      </div>
    );
  }

  if (confirm === 'transfer') {
    return (
      <div className="w-full space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm text-amber-900">
          Make {name} the owner? They get to rename the group, change its photo, remove members and
          transfer ownership. You become a normal member.
        </p>
        {error ? <p className="text-sm font-medium text-rose-800">{error}</p> : null}
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await transferOwnership(groupId, userId);
                if (result.ok) { setConfirm(null); router.refresh(); }
                else setError(result.error ?? 'Could not transfer ownership.');
              })
            }
          >
            {pending ? 'Transferring…' : 'Transfer ownership'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setConfirm(null)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size="sm" onClick={() => setConfirm('transfer')} title="Make owner">
        <Crown size={15} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirm('remove')}
        disabled={!settled}
        title={settled ? 'Remove from group' : 'They still have an outstanding balance'}
      >
        <UserMinus size={15} />
      </Button>
    </div>
  );
}

/** Requirement 25: the button is disabled and says exactly why. */
export function LeaveGroupButton({
  groupId,
  blockedReason,
}: {
  groupId: string;
  blockedReason: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (blockedReason) {
    return (
      <div className="space-y-2">
        <Button variant="secondary" disabled title={blockedReason}>
          <LogOut size={15} /> Leave group
        </Button>
        <Alert tone="warning">{blockedReason}</Alert>
      </div>
    );
  }

  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        <LogOut size={15} /> Leave group
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm text-slate-700">
        Leave this group? You lose access to it, but your name stays on the expenses and settlements
        you were part of.
      </p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex gap-2">
        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await leaveGroup(groupId);
              if (result.ok) router.push(result.redirectTo ?? '/groups');
              else setError(result.error ?? 'Could not leave the group.');
            })
          }
        >
          {pending ? 'Leaving…' : 'Yes, leave'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>Stay</Button>
      </div>
    </div>
  );
}
