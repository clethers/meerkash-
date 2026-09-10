'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { acceptInvite } from '@/lib/actions/groups';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

export function JoinGroupButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <Button
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await acceptInvite(token);
            if (result.ok) {
              router.push(result.redirectTo ?? '/groups');
              router.refresh();
            } else setError(result.error ?? 'We could not add you to that group.');
          })
        }
      >
        {pending ? 'Joining…' : 'Accept and join'}
      </Button>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
