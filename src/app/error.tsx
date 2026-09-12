'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Link href="/" className="mb-6 flex items-center">
        <Image src="/logo.png" alt="Meerkash" width={139} height={100} className="h-32 w-auto" />
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-600">
        We hit a snag loading this page. You can try again, or head back to your groups.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-slate-400">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/groups" variant="secondary">Go to your groups</ButtonLink>
      </div>
    </main>
  );
}
