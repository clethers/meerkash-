'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useState, useTransition } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import { createTemplate, deactivateTemplate, skipOccurrence } from '@/lib/actions/recurring';
import type { ActionResult } from '@/lib/actions/shared';
import { CATEGORIES, RECURRENCES } from '@/lib/constants';
import { currencySymbol } from '@/lib/money';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { SubmitButton } from '@/components/ui/SubmitButton';
import type { CurrencyCode } from '@/types/db';

export function NewTemplateForm({
  groupId,
  members,
  today,
  currency,
}: {
  groupId: string;
  members: Array<{ id: string; name: string }>;
  today: string;
  currency: CurrencyCode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionResult | null, FormData>(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await createTemplate(prev, formData);
      if (result.ok) { setOpen(false); router.refresh(); }
      return result;
    },
    null,
  );

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> New reminder
      </Button>
    );
  }

  return (
    <form action={action} className="card space-y-4 p-5">
      <input type="hidden" name="group_id" value={groupId} />

      <div>
        <label className="label" htmlFor="r-name">What repeats?</label>
        <input id="r-name" name="name" required maxLength={120} className="input mt-1.5" placeholder="Daily lunch" autoFocus />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="r-frequency">How often?</label>
          <select id="r-frequency" name="frequency" className="input mt-1.5" defaultValue="monthly">
            {RECURRENCES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="r-due">First due date</label>
          <input id="r-due" name="next_due_on" type="date" required defaultValue={today} className="input mt-1.5" />
        </div>
        <div>
          <label className="label" htmlFor="r-amount">Usual amount ({currencySymbol(currency)}, optional)</label>
          <input id="r-amount" name="amount" inputMode="decimal" className="input mt-1.5" placeholder="150.00" />
        </div>
        <div>
          <label className="label" htmlFor="r-category">Category</label>
          <select id="r-category" name="category" className="input mt-1.5" defaultValue="other">
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="r-payer">Usually paid by</label>
        <select id="r-payer" name="default_payer_id" className="input mt-1.5">
          <option value="">Not set</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="label">Usually split between</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {members.map((m) => (
            <label key={m.id} className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="participants"
                value={m.id}
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              {m.name}
            </label>
          ))}
        </div>
      </fieldset>

      <Alert tone="info">
        This only creates a reminder. Nothing is charged until someone records the real amount for
        the day it actually happened.
      </Alert>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…">Create reminder</SubmitButton>
        <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

export function OccurrenceActions({
  groupId,
  occurrenceId,
}: {
  groupId: string;
  occurrenceId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await skipOccurrence(groupId, occurrenceId);
            if (result.ok) router.refresh();
            else setError(result.error ?? 'Could not skip that.');
          })
        }
      >
        <CalendarClock size={15} /> Didn&apos;t happen — skip
      </Button>
      {error ? <span className="text-xs text-rose-700">{error}</span> : null}
    </div>
  );
}

export function RemoveTemplateButton({
  groupId,
  templateId,
}: {
  groupId: string;
  templateId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await deactivateTemplate(groupId, templateId);
          router.refresh();
        })
      }
    >
      Remove
    </Button>
  );
}
