'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { addComment, addMemberToExpense, deleteExpense } from '@/lib/actions/expenses';
import type { ActionResult } from '@/lib/actions/shared';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { SubmitButton } from '@/components/ui/SubmitButton';

export function DeleteExpenseButton({
  groupId,
  expenseId,
}: {
  groupId: string;
  expenseId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        <Trash2 size={15} /> Delete
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
      <p className="text-sm text-rose-900">
        Delete this expense? It stops affecting balances, but the record stays in the group&apos;s
        activity history.
      </p>
      {error ? <p className="text-sm font-medium text-rose-800">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await deleteExpense(groupId, expenseId);
              if (result.ok) router.push(result.redirectTo ?? `/groups/${groupId}`);
              else setError(result.error ?? 'Could not delete that expense.');
            })
          }
        >
          {pending ? 'Deleting…' : 'Yes, delete it'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
          Keep it
        </Button>
      </div>
    </div>
  );
}

export function CommentForm({ groupId, expenseId }: { groupId: string; expenseId: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(addComment, null);
  const [body, setBody] = useState('');

  useEffect(() => {
    if (state?.ok) setBody('');
  }, [state]);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="expense_id" value={expenseId} />
      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Ask a question or explain something about this expense"
        className="input"
        aria-label="Add a comment"
      />
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      <SubmitButton size="sm" disabled={body.trim().length === 0} pendingLabel="Posting…">
        Post comment
      </SubmitButton>
    </form>
  );
}

/** Requirement 6: pulling a member into an expense they were not part of. */
export function AddParticipant({
  groupId,
  expenseId,
  candidates,
}: {
  groupId: string;
  expenseId: string;
  candidates: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(candidates[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (candidates.length === 0) return null;

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <UserPlus size={15} /> Add someone to this expense
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm text-slate-700">
        Adding someone re-splits this expense equally and recalculates everyone&apos;s balance. The
        change is recorded and the people affected are notified.
      </p>
      <div className="flex flex-wrap gap-2">
        <Select
          value={selected}
          onChange={setSelected}
          className="max-w-56"
          aria-label="Member to add"
          options={candidates.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Button
          size="sm"
          disabled={pending || !selected}
          onClick={() =>
            start(async () => {
              const result = await addMemberToExpense(groupId, expenseId, selected);
              if (result.ok) {
                setOpen(false);
                router.refresh();
              } else setError(result.error ?? 'Could not update this expense.');
            })
          }
        >
          {pending ? 'Recalculating…' : 'Add and re-split'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
