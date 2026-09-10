'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, Copy, QrCode, Share2, Trash2 } from 'lucide-react';
import { revokeInvite } from '@/lib/actions/groups';
import { Button } from '@/components/ui/Button';

export function InvitePanel({
  url,
  qrSvg,
  inviteId,
  groupId,
}: {
  url: string;
  qrSvg: string;
  inviteId: string;
  groupId: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [revoking, startRevoke] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: 'Join my Meerkash group', url });
        return;
      } catch {
        // The person dismissed the share sheet — fall through to copying.
      }
    }
    await copy();
  }

  return (
    <div className="card space-y-4 p-5">
      <div>
        <p className="font-medium text-slate-900">Invite people</p>
        <p className="mt-1 text-sm text-slate-600">
          Share this link or let them scan the code. They&apos;ll need to accept before they join.
        </p>
      </div>

      <div className="flex gap-2">
        <input readOnly value={url} className="input font-mono text-xs" aria-label="Invitation link" />
        <Button variant="secondary" onClick={copy} aria-label="Copy invitation link">
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={share}>
          <Share2 size={15} /> Share
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowQr((v) => !v)}>
          <QrCode size={15} /> {showQr ? 'Hide' : 'Show'} QR code
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={revoking}
          onClick={() =>
            startRevoke(async () => {
              await revokeInvite(inviteId, groupId);
              router.refresh();
            })
          }
          title="Stop this link working and generate a fresh one"
        >
          <Trash2 size={15} /> {revoking ? 'Revoking…' : 'Reset link'}
        </Button>
      </div>

      {showQr ? (
        <div
          className="flex justify-center rounded-xl border border-slate-200 bg-white p-4"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      ) : null}
    </div>
  );
}
