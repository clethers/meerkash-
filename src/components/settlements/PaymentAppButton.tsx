'use client';

import { Wallet } from 'lucide-react';
import { PAYMENT_APP_LINKS, PAYMENT_METHOD_LABEL } from '@/lib/constants';
import type { PaymentMethod } from '@/types/db';

/**
 * Neither GCash nor Maya lets a third-party app pre-fill a specific
 * recipient/amount without a merchant partnership, so this opens the app
 * itself (falling back to its store listing if it isn't installed) — the
 * person finishes the actual payment inside GCash/Maya, then comes back
 * here to record it with the settle-up form below.
 */
export function PaymentAppButton({ method }: { method: PaymentMethod }) {
  const link = PAYMENT_APP_LINKS[method];
  if (!link) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const start = Date.now();
        window.location.href = link.scheme;
        setTimeout(() => {
          if (Date.now() - start < 2000) window.location.href = link.storeUrl;
        }, 1500);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      <Wallet size={15} /> Open {PAYMENT_METHOD_LABEL[method]}
    </button>
  );
}
