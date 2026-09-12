'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { createDirectSettlement } from '@/lib/actions/friends';
import type { ActionResult } from '@/lib/actions/shared';
import { formatPHP, toCentavos, toPesoInput } from '@/lib/money';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { PaymentMethodToggle } from '@/components/settlements/PaymentMethodToggle';
import { PaymentQrCode } from '@/components/settlements/PaymentQrCode';

export function DirectSettleForm({
  friendId,
  friendName,
  friendAvatarUrl,
  friendQrUrl,
  maxCentavos,
}: {
  friendId: string;
  friendName: string;
  friendAvatarUrl: string | null;
  friendQrUrl: string | null;
  maxCentavos: number;
}) {
  const router = useRouter();
  const [state, action] = useActionState<ActionResult | null, FormData>(createDirectSettlement, null);
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
    return <Alert tone="info">You have nothing outstanding with {friendName} right now.</Alert>;
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="friend_id" value={friendId} />

      <div className="card p-5">
        <div className="flex items-center gap-3">
          <Avatar name={friendName} src={friendAvatarUrl} size={44} />
          <div>
            <p className="font-medium text-slate-900">You owe {friendName}</p>
            <p className="text-2xl font-semibold money-negative">{formatPHP(maxCentavos)}</p>
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
            Paying less than the full amount is fine. You cannot enter more than {formatPHP(maxCentavos)}.
          </p>
          {tooMuch ? (
            <p className="mt-2 text-sm font-medium text-rose-700">
              That is more than you currently owe {friendName}.
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
              <PaymentQrCode qrUrl={friendQrUrl} name={friendName} />
            </div>
          ) : null}
        </div>
      </div>

      <Alert tone="info">
        This is recorded as a request. Your balance changes once {friendName} confirms it.
      </Alert>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

      <SubmitButton size="lg" className="w-full" disabled={tooMuch || invalid} pendingLabel="Recording…">
        Record payment
      </SubmitButton>
    </form>
  );
}
