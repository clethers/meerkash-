'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, Eye, X } from 'lucide-react';
import { confirmSettlement, getProofUrl, rejectSettlement } from '@/lib/actions/settlements';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

/** Requirement 20 + 23: the receiver decides, and only they see the proof. */
export function SettlementResponse({
  groupId,
  settlementId,
  hasProof,
}: {
  groupId: string;
  settlementId: string;
  hasProof: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function respond(kind: 'confirm' | 'reject') {
    start(async () => {
      const result =
        kind === 'confirm'
          ? await confirmSettlement(groupId, settlementId)
          : await rejectSettlement(groupId, settlementId);
      if (result.ok) router.refresh();
      else setError(result.error ?? 'Could not update that settlement.');
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {hasProof ? (
          proofUrl ? (
            <a
              href={proofUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Eye size={15} /> Open proof
            </a>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const url = await getProofUrl(settlementId);
                  if (url) setProofUrl(url);
                  else setError('That proof is no longer available.');
                })
              }
            >
              <Eye size={15} /> View proof
            </Button>
          )
        ) : null}

        <Button size="sm" disabled={pending} onClick={() => respond('confirm')}>
          <Check size={15} /> Confirm
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => respond('reject')}>
          <X size={15} /> Reject
        </Button>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
