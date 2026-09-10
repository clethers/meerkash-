import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { SettleForm } from '@/components/settlements/SettleForm';
import { getGroupBundle, toSettlementInput } from '@/lib/data/groups';
import { maxSettlementAmount } from '@/lib/balance';

export const dynamic = 'force-dynamic';

export default async function SettleWithPersonPage({
  params,
}: {
  params: Promise<{ groupId: string; userId: string }>;
}) {
  const { groupId, userId } = await params;
  const bundle = await getGroupBundle(groupId);
  if (!bundle) notFound();

  const member = bundle.members.find((m) => m.user_id === userId);
  if (!member) notFound();

  const max = maxSettlementAmount(
    bundle.ledger,
    bundle.settlements.map(toSettlementInput),
    bundle.me.id,
    userId,
  );

  return (
    <div className="space-y-5">
      <Link
        href={`/groups/${groupId}/settle`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Settle up
      </Link>

      <h1 className="text-xl font-semibold tracking-tight text-slate-900">
        Record a payment
      </h1>

      <SettleForm
        groupId={groupId}
        maxCentavos={max}
        recipient={{
          id: userId,
          name: member.profile?.display_name ?? 'Member',
          avatarUrl: member.profile?.avatar_url ?? null,
        }}
        currency={bundle.group.currency}
      />
    </div>
  );
}
