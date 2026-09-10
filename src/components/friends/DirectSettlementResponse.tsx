'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { respondToDirectSettlement } from '@/lib/actions/friends';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

export function DirectSettlementResponse({ settlementId }: { settlementId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function respond(status: 'confirmed' | 'rejected') {
    start(async () => {
      const formData = new FormData();
      formData.set('settlement_id', settlementId);
      formData.set('status', status);
      const result = await respondToDirectSettlement(null, formData);
      if (result.ok) router.refresh();
      else setError(result.error ?? 'Could not update that settlement.');
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => respond('confirmed')}>
          <Check size={15} /> Confirm
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => respond('rejected')}>
          <X size={15} /> Reject
        </Button>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
