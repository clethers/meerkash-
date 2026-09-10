import { redirect } from 'next/navigation';
import { AppNav } from '@/components/AppNav';
import { getAuthUser } from '@/lib/data/groups';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Only the auth check gates rendering — the full profile (needed by
  // AppNav) is fetched independently below, in parallel with the page's
  // own data, instead of serializing in front of the whole tree.
  const authUser = await getAuthUser();
  if (!authUser) redirect('/login');

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-20 pt-12">
        {children}
      </main>
    </div>
  );
}
