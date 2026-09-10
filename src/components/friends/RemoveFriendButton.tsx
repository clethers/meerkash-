'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { UserMinus } from 'lucide-react';
import { removeFriend } from '@/lib/actions/friends';

export function RemoveFriendButton({ friendId, friendName }: { friendId: string; friendName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Remove ${friendName} as a friend?`)) return;
          start(async () => {
            const formData = new FormData();
            formData.set('friend_id', friendId);
            const result = await removeFriend(null, formData);
            if (result.ok) {
              router.push('/friends');
              router.refresh();
            } else {
              setError(result.error ?? 'Could not remove that friend.');
            }
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-rose-700 disabled:opacity-60"
      >
        <UserMinus size={15} /> Remove friend
      </button>
      {error ? <p className="mt-1 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
