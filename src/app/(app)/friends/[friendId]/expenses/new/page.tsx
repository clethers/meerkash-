import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DirectExpenseForm } from '@/components/friends/DirectExpenseForm';
import { getFriendBundle } from '@/lib/data/friends';

export const dynamic = 'force-dynamic';

export default async function NewDirectExpensePage({
  params,
}: {
  params: Promise<{ friendId: string }>;
}) {
  const { friendId } = await params;
  const bundle = await getFriendBundle(friendId);
  if (!bundle) notFound();

  return (
    <div className="space-y-5">
      <Link
        href={`/friends/${friendId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> {bundle.friend.display_name}
      </Link>

      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Add an expense</h1>

      <DirectExpenseForm
        friendId={friendId}
        friendName={bundle.friend.display_name}
        meId={bundle.me.id}
        meName={bundle.me.display_name}
      />
    </div>
  );
}
