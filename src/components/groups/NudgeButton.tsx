'use client';

import { useState, useTransition } from 'react';
import { Bell, Check } from 'lucide-react';
import { nudgeMember } from '@/lib/actions/groups';

/** A gentle reminder — it notifies them, it does not change any balance. */
export function NudgeButton({
  groupId,
  userId,
  amountLabel,
}: {
  groupId: string;
  userId: string;
  amountLabel: string;
}) {
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending || sent}
      onClick={() =>
        start(async () => {
          const result = await nudgeMember(groupId, userId, amountLabel);
          if (result.ok) setSent(true);
        })
      }
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      title={sent ? 'Reminder sent' : 'Send a reminder'}
    >
      {sent ? <Check size={13} /> : <Bell size={13} />}
      {sent ? 'Sent' : 'Remind'}
    </button>
  );
}
