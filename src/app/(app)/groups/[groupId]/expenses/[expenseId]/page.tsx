import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Paperclip, Pencil } from 'lucide-react';
import { AddParticipant, CommentForm, DeleteExpenseButton } from '@/components/expenses/ExpenseActions';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { getGroupBundle } from '@/lib/data/groups';
import { getReceiptUrl } from '@/lib/actions/expenses';
import { createClient } from '@/lib/supabase/server';
import { CATEGORY_EMOJI, CATEGORY_LABEL } from '@/lib/constants';
import { formatMoney } from '@/lib/money';
import { formatDateTime, relativeTime } from '@/lib/utils';
import type { CurrencyCode, ExpenseComment, ExpenseRevision } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ groupId: string; expenseId: string }>;
}) {
  const { groupId, expenseId } = await params;
  const bundle = await getGroupBundle(groupId);
  if (!bundle) notFound();

  const expense = bundle.expenses.find((e) => e.id === expenseId);
  if (!expense) notFound();

  const supabase = await createClient();
  const [{ data: commentRows }, { data: revisionRows }] = await Promise.all([
    supabase
      .from('expense_comments')
      .select('*')
      .eq('expense_id', expenseId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('expense_revisions')
      .select('*')
      .eq('expense_id', expenseId)
      .order('edited_at', { ascending: false }),
  ]);

  const comments = (commentRows ?? []) as ExpenseComment[];
  const revisions = (revisionRows ?? []) as ExpenseRevision[];
  const receiptUrl = expense.receipt_path ? await getReceiptUrl(expense.receipt_path) : null;
  const deleted = Boolean(expense.deleted_at);

  const participantIds = new Set(expense.participants.map((p) => p.user_id));
  const candidates = bundle.activeMembers
    .filter((m) => !participantIds.has(m.user_id))
    .map((m) => ({ id: m.user_id, name: m.profile?.display_name ?? 'Member' }));

  return (
    <div className="space-y-5">
      <Link
        href={`/groups/${groupId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> {bundle.group.name}
      </Link>

      {deleted ? (
        <Alert tone="warning">
          This expense was deleted {relativeTime(expense.deleted_at!)} by{' '}
          {bundle.nameOf(expense.deleted_by ?? '')}. It no longer affects anyone&apos;s balance, but
          the record is kept.
        </Alert>
      ) : null}

      <div className="card p-5">
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden>{CATEGORY_EMOJI[expense.category]}</span>
          <div className="min-w-0 flex-1">
            <h1 className={`text-xl font-semibold text-slate-900 ${deleted ? 'line-through' : ''}`}>
              {expense.description}
            </h1>
            <p className="text-sm text-slate-500">
              {CATEGORY_LABEL[expense.category]} · added {formatDateTime(expense.created_at)}
            </p>
          </div>
          <p className="shrink-0 text-2xl font-semibold text-slate-900">
            {formatMoney(expense.amount_centavos, bundle.group.currency)}
          </p>
        </div>

        <p className="mt-4 text-sm text-slate-700">
          <strong className="font-medium">
            {expense.payer_id === bundle.me.id ? 'You' : bundle.nameOf(expense.payer_id)}
          </strong>{' '}
          paid the whole amount.
        </p>

        {expense.note ? (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {expense.note}
          </p>
        ) : null}

        <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
          {expense.participants.map((participant) => (
            <li key={participant.user_id} className="flex items-center gap-3 py-2.5">
              <Avatar
                name={bundle.nameOf(participant.user_id)}
                src={bundle.members.find((m) => m.user_id === participant.user_id)?.profile?.avatar_url}
                size={32}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                {participant.user_id === bundle.me.id ? 'You' : bundle.nameOf(participant.user_id)}
              </span>
              <span className="text-sm font-medium text-slate-700">
                {formatMoney(participant.share_centavos, bundle.group.currency)}
              </span>
            </li>
          ))}
        </ul>

        {receiptUrl ? (
          <a
            href={receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
          >
            <Paperclip size={15} /> View receipt
          </a>
        ) : null}

        {!deleted ? (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <ButtonLink href={`/groups/${groupId}/expenses/${expenseId}/edit`} variant="secondary" size="sm">
              <Pencil size={15} /> Edit
            </ButtonLink>
            <DeleteExpenseButton groupId={groupId} expenseId={expenseId} />
          </div>
        ) : null}
      </div>

      {!deleted ? (
        <AddParticipant groupId={groupId} expenseId={expenseId} candidates={candidates} />
      ) : null}

      {revisions.length > 0 ? (
        <section className="space-y-2">
          <SectionLabel>Edit history</SectionLabel>
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {revisions.map((revision) => (
              <li key={revision.id} className="px-4 py-3 text-sm">
                <p className="text-slate-800">
                  <strong className="font-medium">{bundle.nameOf(revision.edited_by)}</strong> edited{' '}
                  {revision.changed_fields.join(', ')}
                </p>
                <p className="text-xs text-slate-500">{formatDateTime(revision.edited_at)}</p>
                <div className="scroll-x mt-2">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="pr-4 font-medium">Field</th>
                        <th className="pr-4 font-medium">Was</th>
                        <th className="font-medium">Now</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      {revision.changed_fields.map((field) => (
                        <tr key={field}>
                          <td className="pr-4 py-0.5 align-top">{field}</td>
                          <td className="pr-4 py-0.5 align-top font-mono">
                            {renderValue(field, revision.before_value[field], bundle.nameOf, bundle.group.currency)}
                          </td>
                          <td className="py-0.5 align-top font-mono">
                            {renderValue(field, revision.after_value[field], bundle.nameOf, bundle.group.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionLabel>Comments {comments.length > 0 ? `(${comments.length})` : ''}</SectionLabel>

        {comments.length > 0 ? (
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {comments.map((comment) => (
              <li key={comment.id} className="flex gap-3 px-4 py-3">
                <Avatar
                  name={bundle.nameOf(comment.user_id)}
                  src={bundle.members.find((m) => m.user_id === comment.user_id)?.profile?.avatar_url}
                  size={30}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <strong className="font-medium text-slate-900">
                      {bundle.nameOf(comment.user_id)}
                    </strong>{' '}
                    <span className="text-xs text-slate-400">{relativeTime(comment.created_at)}</span>
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            No comments yet. Comments are for questions and explanations — they don&apos;t change
            the maths.
          </p>
        )}

        <CommentForm groupId={groupId} expenseId={expenseId} />
      </section>
    </div>
  );
}

function renderValue(
  field: string,
  value: unknown,
  nameOf: (id: string) => string,
  currency: CurrencyCode,
): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'amount_centavos' && typeof value === 'number') return formatMoney(value, currency);
  if (field === 'payer_id' && typeof value === 'string') return nameOf(value);
  if (field === 'participants' && Array.isArray(value)) {
    return value.map((id) => nameOf(String(id))).join(', ');
  }
  return String(value);
}
