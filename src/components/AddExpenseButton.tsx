'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { quickAddExpense } from '@/lib/actions/expenses';
import type { Group } from '@/types/db';

export function AddExpenseButton({ groups }: { groups: Group[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openModal() {
    setGroupId(groups[0]?.id ?? '');
    setAmount('');
    setDescription('');
    setError(null);
    setOpen(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await quickAddExpense(groupId, description, amount);
      if (!result.ok) {
        setError(result.error ?? 'Could not add the expense.');
        return;
      }
      setOpen(false);
      if (result.redirectTo) router.push(result.redirectTo);
    });
  }

  return (
    <>
      <button
        onClick={openModal}
        aria-label="Add expense"
        className={[
          'flex h-11 w-11 items-center justify-center rounded-full text-slate-600',
          'transition-[background-color,transform] duration-200 ease-out',
          'hover:scale-110 hover:bg-slate-100 active:scale-95 motion-reduce:hover:scale-100',
        ].join(' ')}
      >
        <Plus size={20} />
      </button>

      {open ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-expense-title"
            className="card w-full max-w-md rounded-2xl p-5"
          >
            <div className="flex items-start justify-between">
              <p id="add-expense-title" className="font-medium text-slate-900">Add an expense</p>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Cancel"
              >
                <X size={18} />
              </button>
            </div>

            {groups.length === 0 ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-600">
                  You don&apos;t have any groups yet — create one first to add an expense.
                </p>
                <ButtonLink href="/groups" className="w-full" onClick={() => setOpen(false)}>
                  Go to groups
                </ButtonLink>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-4 space-y-3">
                <div>
                  <label className="label" htmlFor="quick-expense-group">Group</label>
                  <Select
                    id="quick-expense-group"
                    className="mt-1.5"
                    value={groupId}
                    onChange={setGroupId}
                    options={groups.map((group) => ({
                      value: group.id,
                      label: group.name,
                      icon: (
                        <Avatar name={group.name} src={group.avatar_url} seed={group.avatar_seed} size={22} />
                      ),
                    }))}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="quick-expense-amount">Amount</label>
                  <input
                    id="quick-expense-amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    autoFocus
                    className="input mt-1.5"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="quick-expense-description">For</label>
                  <input
                    id="quick-expense-description"
                    placeholder="Dinner"
                    maxLength={120}
                    className="input mt-1.5"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Splits equally among everyone in the group, with you as the payer.
                </p>
                {error ? <Alert tone="error">{error}</Alert> : null}
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? 'Adding…' : 'Add expense'}
                </Button>
              </form>
            )}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
