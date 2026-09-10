'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { createDirectExpense } from '@/lib/actions/friends';
import type { ActionResult } from '@/lib/actions/shared';
import { formatPHP, toCentavos } from '@/lib/money';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';

export function DirectExpenseForm({
  friendId,
  friendName,
  meId,
  meName,
}: {
  friendId: string;
  friendName: string;
  meId: string;
  meName: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState<ActionResult | null, FormData>(createDirectExpense, null);
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState(meId);

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  const amountCentavos = useMemo(() => {
    try {
      return toCentavos(amount || '0');
    } catch {
      return 0;
    }
  }, [amount]);

  const half = Math.floor(amountCentavos / 2);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="friend_id" value={friendId} />
      <input type="hidden" name="payer_id" value={payerId} />

      <div className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="description">What was it for?</label>
          <input
            id="description"
            name="description"
            required
            maxLength={120}
            className="input mt-1.5"
            placeholder="Lunch"
            autoFocus
          />
        </div>

        <div>
          <label className="label" htmlFor="amount">Amount (₱)</label>
          <input
            id="amount"
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="input mt-1.5"
            placeholder="500.00"
          />
        </div>

        <div>
          <p className="label">Who paid?</p>
          <div className="mt-1.5 flex rounded-lg border border-slate-300 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setPayerId(meId)}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium ${payerId === meId ? 'bg-brand-600 text-white' : 'text-slate-600'}`}
            >
              {meName}
            </button>
            <button
              type="button"
              onClick={() => setPayerId(friendId)}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium ${payerId === friendId ? 'bg-brand-600 text-white' : 'text-slate-600'}`}
            >
              {friendName}
            </button>
          </div>
        </div>

        {amountCentavos > 0 ? (
          <p className="text-sm text-slate-600">
            Split evenly — each of you owes <strong className="font-medium text-slate-900">{formatPHP(half)}</strong>.
          </p>
        ) : null}
      </div>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

      <SubmitButton size="lg" className="w-full" pendingLabel="Saving…" disabled={amountCentavos <= 0}>
        Add expense
      </SubmitButton>
    </form>
  );
}
