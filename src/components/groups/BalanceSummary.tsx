import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { NudgeButton } from './NudgeButton';
import { formatMoney } from '@/lib/money';
import type { UserSummary } from '@/lib/balance';
import type { CurrencyCode } from '@/types/db';

/**
 * Requirement 18 + 34: the user should read this and immediately know where
 * they stand. No "net receivable", no accounting vocabulary — just
 * "John owes you ₱500".
 */
export function BalanceSummary({
  summary,
  groupId,
  nameOf,
  avatarOf,
  currency,
}: {
  summary: UserSummary;
  groupId: string;
  nameOf: (id: string) => string;
  avatarOf: (id: string) => string | null;
  currency: CurrencyCode;
}) {
  if (summary.settledUp) {
    return (
      <div className="card p-5">
        <p className="text-lg font-semibold text-slate-900">You are all settled up</p>
        <p className="mt-1 text-sm text-slate-600">
          Nobody owes you anything in this group, and you owe nothing.
        </p>
      </div>
    );
  }

  const owedMode = summary.net > 0;

  return (
    <div className="card overflow-hidden">
      <div className={`px-5 py-4 ${owedMode ? 'bg-brand-50' : 'bg-rose-50'}`}>
        <p className="text-sm text-slate-600">{owedMode ? 'You are owed' : 'You owe'}</p>
        <p
          className={`text-3xl font-semibold tracking-tight ${
            owedMode ? 'money-positive' : 'money-negative'
          }`}
        >
          {formatMoney(Math.abs(summary.net), currency)}
        </p>
      </div>

      <ul className="divide-y divide-slate-100">
        {summary.owedToYou.map((line) => (
          <li key={line.userId} className="flex items-center gap-3 px-5 py-3">
            <Avatar name={nameOf(line.userId)} src={avatarOf(line.userId)} size={34} />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
              <strong className="font-medium text-slate-900">{nameOf(line.userId)}</strong> owes you
            </span>
            <span className="font-semibold money-positive">{formatMoney(line.amount, currency)}</span>
            <NudgeButton
              groupId={groupId}
              userId={line.userId}
              amountLabel={formatMoney(line.amount, currency)}
            />
          </li>
        ))}

        {summary.youOwe.map((line) => (
          <li key={line.userId} className="flex items-center gap-3 px-5 py-3">
            <Avatar name={nameOf(line.userId)} src={avatarOf(line.userId)} size={34} />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
              You owe <strong className="font-medium text-slate-900">{nameOf(line.userId)}</strong>
            </span>
            <span className="font-semibold money-negative">{formatMoney(line.amount, currency)}</span>
            <Link
              href={`/groups/${groupId}/settle/${line.userId}`}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            >
              Settle <ArrowRight size={13} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
