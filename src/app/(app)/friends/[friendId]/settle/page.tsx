import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DirectSettleForm } from '@/components/friends/DirectSettleForm';
import { getFriendBundle } from '@/lib/data/friends';
import { maxSettlementAmount } from '@/lib/balance';
import { toSettlementInput } from '@/lib/data/groups';

export const dynamic = 'force-dynamic';

export default async function SettleWithFriendPage({
  params,
}: {
  params: Promise<{ friendId: string }>;
}) {
  const { friendId } = await params;
  const bundle = await getFriendBundle(friendId);
  if (!bundle) notFound();

  const max = maxSettlementAmount(
    bundle.ledger, bundle.settlements.map(toSettlementInput), bundle.me.id, friendId,
  );

  return (
    <div className="space-y-5">
      <Link
        href={`/friends/${friendId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> {bundle.friend.display_name}
      </Link>

      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Record a payment</h1>

      <DirectSettleForm
        friendId={friendId}
        friendName={bundle.friend.display_name}
        friendAvatarUrl={bundle.friend.avatar_url}
        friendQrUrl={bundle.friend.payment_qr_url}
        maxCentavos={max}
      />
    </div>
  );
}
