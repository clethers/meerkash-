import Link from 'next/link';
import Image from 'next/image';
import { AmbientBackdrop } from '@/components/ui/AmbientBackdrop';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <AmbientBackdrop />
      <Link href="/" className="mb-6 flex items-center">
        <Image src="/logo.png" alt="Meerkash" width={139} height={100} className="h-32 w-auto" priority />
      </Link>
      <div className="card w-full max-w-sm p-6">{children}</div>
    </main>
  );
}
