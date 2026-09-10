import Link from 'next/link';
import { CATEGORY_EMOJI } from '@/lib/constants';
import { formatMoney } from '@/lib/money';
import { relativeTime } from '@/lib/utils';
import type { ExpenseWithDetail } from '@/lib/data/groups';
import type { CurrencyCode } from '@/types/db';

export function ExpenseRow({
  expense,
  groupId,
  viewerId,
  nameOf,
  currency,
}: {
  expense: ExpenseWithDetail;
  groupId: string;
  viewerId: string;
  nameOf: (id: string) => string;
  currency: CurrencyCode;
}) {
  const myShare = expense.participants.find((p) => p.user_id === viewerId)?.share_centavos ?? 0;
  const iPaid = expense.payer_id === viewerId;
  const deleted = Boolean(expense.deleted_at);

  // What this one expense did to the viewer's balance.
  const delta = (iPaid ? expense.amount_centavos : 0) - myShare;

  return (
    <Link
      href={`/groups/${groupId}/expenses/${expense.id}`}
      className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${
        deleted ? 'opacity-60' : ''
      }`}
    >
      <span className="text-xl" aria-hidden>
        {CATEGORY_EMOJI[expense.category]}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate font-medium text-slate-900 ${deleted ? 'line-through' : ''}`}
        >
          {expense.description}
        </p>
        <p className="truncate text-xs text-slate-500">
          {iPaid ? 'You' : nameOf(expense.payer_id)} paid {formatMoney(expense.amount_centavos, currency)} ·{' '}
          {relativeTime(expense.created_at)}
          {deleted ? ' · deleted' : ''}
        </p>
      </div>

      <div className="shrink-0 text-right">
        {deleted || delta === 0 ? (
          <span className="text-xs text-slate-400">no effect</span>
        ) : (
          <>
            <p className="text-[11px] text-slate-500">{delta > 0 ? 'you lent' : 'you borrowed'}</p>
            <p className={`text-sm font-semibold ${delta > 0 ? 'money-positive' : 'money-negative'}`}>
              {formatMoney(Math.abs(delta), currency)}
            </p>
          </>
        )}
      </div>
    </Link>
  );
}
