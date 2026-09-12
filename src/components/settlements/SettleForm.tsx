'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { createSettlement } from '@/lib/actions/settlements';
import type { ActionResult } from '@/lib/actions/shared';
import { formatMoney, toCentavos, toPesoInput } from '@/lib/money';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { PaymentMethodToggle } from './PaymentMethodToggle';
import { PaymentQrCode } from './PaymentQrCode';
import type { CurrencyCode } from '@/types/db';

/**
 * Requirement 19: the amount is pre-filled with exactly what is owed.
 * Less is fine, exactly is fine, more is blocked — here for a friendly
 * message, and again on the server where it actually counts.
 */
export function SettleForm({
  groupId,
  recipient,
  maxCentavos,
  currency,
}: {
  groupId: string;
  recipient: { id: string; name: string; avatarUrl: string | null; qrUrl: string | null };
  maxCentavos: number;
  currency: CurrencyCode;
}) {
  const router = useRouter();
  const [state, action] = useActionState<ActionResult | null, FormData>(createSettlement, null);
  const [amount, setAmount] = useState(toPesoInput(maxCentavos));
  const [method, setMethod] = useState<'cash' | 'qr_code'>('cash');

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  const entered = useMemo(() => {
    try {
      return toCentavos(amount || '0');
    } catch {
      return -1;
    }
  }, [amount]);

  const tooMuch = entered > maxCentavos;
  const invalid = entered <= 0;

  if (maxCentavos <= 0) {
    return (
      <Alert tone="info">
        You have nothing outstanding with {recipient.name} right now.
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="to_user_id" value={recipient.id} />

      <div className="card p-5">
        <div className="flex items-center gap-3">
          <Avatar name={recipient.name} src={recipient.avatarUrl} size={44} />
          <div>
            <p className="font-medium text-slate-900">You owe {recipient.name}</p>
            <p className="text-2xl font-semibold money-negative">{formatMoney(maxCentavos, currency)}</p>
          </div>
        </div>

        <div className="mt-5">
          <label className="label" htmlFor="amount">How much are you paying?</label>
          <input
            id="amount"
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input mt-1.5 text-lg"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Paying less than the full amount is fine. You cannot enter more than{' '}
            {formatMoney(maxCentavos, currency)}.
          </p>
          {tooMuch ? (
            <p className="mt-2 text-sm font-medium text-rose-700">
              That is more than you currently owe {recipient.name}.
            </p>
          ) : null}
        </div>

        <div className="mt-5">
          <label className="label">How did you pay?</label>
          <input type="hidden" name="method" value={method} />
          <div className="mt-1.5">
            <PaymentMethodToggle value={method} onChange={setMethod} />
          </div>
          {method === 'qr_code' ? (
            <div className="mt-3">
              <PaymentQrCode qrUrl={recipient.qrUrl} name={recipient.name} />
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="note">Note (optional)</label>
          <input id="note" name="note" className="input mt-1.5" placeholder="Dinner reimbursement" maxLength={200} />
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="proof">Payment proof (optional)</label>
          <input
            id="proof"
            name="proof"
            type="file"
            accept="image/*,application/pdf"
            className="mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          <p className="mt-1 text-xs text-slate-500">
            A GCash, Maya or bank screenshot. Only you and {recipient.name} can see it — nobody else
            in the group can.
          </p>
        </div>
      </div>

      <Alert tone="info">
        This is recorded as a request. Your balance changes once {recipient.name} confirms it.
      </Alert>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

      <SubmitButton size="lg" className="w-full" disabled={tooMuch || invalid} pendingLabel="Recording…">
        Record payment
      </SubmitButton>
    </form>
  );
}
