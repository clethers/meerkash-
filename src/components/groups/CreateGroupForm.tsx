'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { createGroup } from '@/lib/actions/groups';
import type { ActionResult } from '@/lib/actions/shared';
import { CURRENCIES } from '@/lib/constants';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { SubmitButton } from '@/components/ui/SubmitButton';

export function CreateGroupForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionResult | null, FormData>(createGroup, null);

  useEffect(() => {
    if (state?.ok && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> New group
      </Button>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-title"
        className="card w-full max-w-md rounded-2xl p-5"
      >
        <div className="flex items-start justify-between">
          <div>
            <p id="create-group-title" className="font-medium text-slate-900">Create a group</p>
            <p className="mt-1 text-sm text-slate-600">
              Name it now, or leave it blank and rename it once people join.
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Cancel"
          >
            <X size={18} />
          </button>
        </div>

        <form action={action} className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="group-name">Group name</label>
            <input
              id="group-name"
              name="name"
              className="input mt-1.5"
              placeholder="Palawan trip"
              maxLength={80}
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="group-currency">Currency</label>
            <select id="group-currency" name="currency" className="input mt-1.5" defaultValue="PHP">
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>{c.value} — {c.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Fixed once the group is created.</p>
          </div>
          {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
          <SubmitButton className="w-full" pendingLabel="Creating…">Create group</SubmitButton>
        </form>
      </div>
    </div>,
    document.body,
  );
}
