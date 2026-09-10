import Link from 'next/link';
import Image from 'next/image';
import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Link href="/" className="mb-6 flex items-center">
        <Image src="/logo.png" alt="Meerkash" width={139} height={100} className="h-32 w-auto" />
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">We couldn&apos;t find that</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-600">
        The page may have moved, or you might not be a member of that group any more.
      </p>
      <ButtonLink href="/groups" className="mt-6">Go to your groups</ButtonLink>
    </main>
  );
}
