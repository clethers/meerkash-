import Link from 'next/link';
import Image from 'next/image';

export function AppNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="relative mx-auto flex h-16 max-w-4xl items-center justify-center px-4">
        <Link href="/groups" className="absolute left-4 top-2 z-30">
          <Image
            src="/logo.png"
            alt="Meerkash"
            width={139}
            height={100}
            className="h-[76px] w-auto drop-shadow-lg"
            priority
          />
        </Link>
      </nav>
    </header>
  );
}
