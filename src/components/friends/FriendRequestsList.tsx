'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { respondToFriendRequest } from '@/lib/actions/friends';
import { Avatar } from '@/components/ui/Avatar';
import { SectionLabel } from '@/components/ui/SectionLabel';
import type { FriendRequest, Profile } from '@/types/db';

export function FriendRequestsList({
  requests,
}: {
  requests: Array<FriendRequest & { fromProfile: Profile }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function respond(requestId: string, action: 'accept' | 'decline') {
    start(async () => {
      const formData = new FormData();
      formData.set('request_id', requestId);
      formData.set('action', action);
      await respondToFriendRequest(null, formData);
      router.refresh();
    });
  }

  return (
    <div className="card divide-y divide-slate-100 overflow-hidden">
      <div className="px-4 py-3">
        <SectionLabel as="h2">Friend requests</SectionLabel>
      </div>
      {requests.map((request) => (
        <div key={request.id} className="flex items-center gap-3 px-4 py-3">
          <Avatar name={request.fromProfile.display_name} src={request.fromProfile.avatar_url} size={36} />
          <p className="min-w-0 flex-1 truncate text-sm text-slate-800">
            <strong className="font-medium text-slate-900">{request.fromProfile.display_name}</strong>{' '}
            wants to be your friend
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => respond(request.id, 'accept')}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Check size={13} /> Accept
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => respond(request.id, 'decline')}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <X size={13} /> Decline
          </button>
        </div>
      ))}
    </div>
  );
}
