'use client';

import { useActionState, useEffect, useRef } from 'react';
import { UserPlus } from 'lucide-react';
import { sendFriendRequest } from '@/lib/actions/friends';
import type { ActionResult } from '@/lib/actions/shared';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';

export function AddFriendForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(sendFriendRequest, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card space-y-3 p-5">
      <div>
        <p className="font-medium text-slate-900 dark:text-slate-50">Add a friend</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          They need a Meerkash account already — enter the email they signed up with.
        </p>
      </div>
      <div className="flex gap-2">
        <input
          name="email"
          type="email"
          required
          className="input"
          placeholder="friend@example.com"
        />
        <SubmitButton pendingLabel="Sending…" className="shrink-0 whitespace-nowrap">
          <UserPlus size={16} /> Send request
        </SubmitButton>
      </div>
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">{String(state.data?.message ?? 'Request sent.')}</Alert> : null}
    </form>
  );
}
