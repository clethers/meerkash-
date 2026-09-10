import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { getGroupBundle } from '@/lib/data/groups';
import { listTemplates } from '@/lib/actions/recurring';
import { toPesoInput } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function NewExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { groupId } = await params;
  const { template: templateId } = await searchParams;
  const bundle = await getGroupBundle(groupId);
  if (!bundle) notFound();

  // Coming from a recurring reminder: prefill it, but let the person correct
  // every field — the whole point is that the real amount may differ.
  const templates = templateId ? await listTemplates(groupId) : [];
  const template = templates.find((t) => t.id === templateId) ?? null;

  const members = bundle.activeMembers.map((m) => ({
    id: m.user_id,
    name: m.profile?.display_name ?? 'Member',
    avatarUrl: m.profile?.avatar_url ?? null,
  }));

  return (
    <div className="space-y-5">
      <Link
        href={`/groups/${groupId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> {bundle.group.name}
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Add an expense</h1>
        {template ? (
          <p className="mt-1 text-sm text-slate-600">
            Prefilled from your &ldquo;{template.name}&rdquo; reminder. Correct anything that was
            different this time.
          </p>
        ) : null}
      </div>

      <ExpenseForm
        groupId={groupId}
        members={members}
        mode="create"
        currency={bundle.group.currency}
        initial={{
          description: template?.name ?? '',
          amount: template?.amount_centavos ? toPesoInput(template.amount_centavos) : '',
          payerId: template?.default_payer_id ?? bundle.me.id,
          participants:
            template && template.default_participants.length > 0
              ? template.default_participants.filter((id) => members.some((m) => m.id === id))
              : members.map((m) => m.id),
          splitMode: bundle.group.default_split_mode,
          exactShares: {},
          percentages: {},
          shareCounts: {},
          category: template?.category ?? 'other',
          note: '',
        }}
      />
    </div>
  );
}
