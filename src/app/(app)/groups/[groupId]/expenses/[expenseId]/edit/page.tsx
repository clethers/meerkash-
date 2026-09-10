import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { Alert } from '@/components/ui/Alert';
import { getGroupBundle } from '@/lib/data/groups';
import { toPesoInput } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ groupId: string; expenseId: string }>;
}) {
  const { groupId, expenseId } = await params;
  const bundle = await getGroupBundle(groupId);
  if (!bundle) notFound();

  const expense = bundle.expenses.find((e) => e.id === expenseId);
  if (!expense) notFound();

  const members = bundle.activeMembers.map((m) => ({
    id: m.user_id,
    name: m.profile?.display_name ?? 'Member',
    avatarUrl: m.profile?.avatar_url ?? null,
  }));

  if (expense.deleted_at) {
    return (
      <div className="space-y-4">
        <Link href={`/groups/${groupId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> {bundle.group.name}
        </Link>
        <Alert tone="warning">
          This expense was deleted, so it can no longer be edited. Its record stays in the group
          history.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/groups/${groupId}/expenses/${expenseId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Back to expense
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Edit expense</h1>
        <p className="mt-1 text-sm text-slate-600">
          Balances recalculate automatically, the previous values are kept, and everyone affected is
          notified.
        </p>
      </div>

      <ExpenseForm
        groupId={groupId}
        members={members}
        mode="edit"
        currency={bundle.group.currency}
        initial={{
          id: expense.id,
          description: expense.description,
          amount: toPesoInput(expense.amount_centavos),
          payerId: expense.payer_id,
          participants: expense.participants.map((p) => p.user_id),
          splitMode: expense.split_mode,
          exactShares: Object.fromEntries(
            expense.participants.map((p) => [p.user_id, toPesoInput(p.share_centavos)]),
          ),
          percentages: Object.fromEntries(
            expense.participants
              .filter((p) => p.percentage_basis_points !== null)
              .map((p) => [p.user_id, (p.percentage_basis_points! / 100).toFixed(2)]),
          ),
          shareCounts: Object.fromEntries(
            expense.participants
              .filter((p) => p.shares !== null)
              .map((p) => [p.user_id, String(p.shares)]),
          ),
          category: expense.category,
          note: expense.note ?? '',
        }}
      />
    </div>
  );
}
