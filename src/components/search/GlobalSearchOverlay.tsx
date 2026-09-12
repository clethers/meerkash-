'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Receipt, Search, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { searchEverything } from '@/lib/actions/search';
import type { SearchResults } from '@/lib/data/search';
import { describeActivity } from '@/lib/activity';
import { debounce } from '@/lib/signup/debounce';
import { formatMoney } from '@/lib/money';
import { cn, relativeTime } from '@/lib/utils';

type FilterKey = 'all' | 'groups' | 'friends' | 'expenses' | 'activity';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'groups', label: 'Groups' },
  { key: 'friends', label: 'Friends' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'activity', label: 'Activity' },
];

const EMPTY: SearchResults = { groups: [], friends: [], expenses: [], activity: [] };

export function GlobalSearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [pending, startTransition] = useTransition();
  const latestQuery = useRef('');

  const debouncedSearch = useRef(
    debounce((q: string) => {
      startTransition(() => {
        searchEverything(q).then((r) => {
          if (latestQuery.current === q) setResults(r);
        });
      });
    }, 300),
  ).current;

  useEffect(() => {
    latestQuery.current = query;
    if (query.trim().length < 2) {
      setResults(EMPTY);
      return;
    }
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  const hasQuery = query.trim().length >= 2;
  const totalCount =
    results.groups.length + results.friends.length + results.expenses.length + results.activity.length;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="border-b border-slate-200 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search groups, friends, expenses, activity…"
              className="input pl-9"
            />
          </div>
          <button
            onClick={onClose}
            aria-label="Close search"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                filter === key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!hasQuery ? (
          <p className="mt-8 text-center text-sm text-slate-500">
            Search across your groups, friends, expenses and activity.
          </p>
        ) : pending && totalCount === 0 ? (
          <p className="mt-8 text-center text-sm text-slate-500">Searching…</p>
        ) : totalCount === 0 ? (
          <p className="mt-8 text-center text-sm text-slate-500">No results for &quot;{query}&quot;.</p>
        ) : (
          <div className="space-y-6">
            {(filter === 'all' || filter === 'groups') && results.groups.length > 0 ? (
              <ResultSection title="Groups">
                {results.groups.map((group) => (
                  <ResultRow key={group.id} href={`/groups/${group.id}`} onNavigate={onClose}>
                    <Avatar name={group.name} src={group.avatar_url} seed={group.avatar_seed} size={36} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                      {group.name}
                    </span>
                  </ResultRow>
                ))}
              </ResultSection>
            ) : null}

            {(filter === 'all' || filter === 'friends') && results.friends.length > 0 ? (
              <ResultSection title="Friends">
                {results.friends.map((friend) => (
                  <ResultRow key={friend.id} href={`/friends/${friend.id}`} onNavigate={onClose}>
                    <Avatar name={friend.display_name} src={friend.avatar_url} size={36} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                      {friend.display_name}
                    </span>
                  </ResultRow>
                ))}
              </ResultSection>
            ) : null}

            {(filter === 'all' || filter === 'expenses') && results.expenses.length > 0 ? (
              <ResultSection title="Expenses">
                {results.expenses.map((expense) => (
                  <ResultRow
                    key={expense.id}
                    href={`/groups/${expense.group.id}/expenses/${expense.id}`}
                    onNavigate={onClose}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                      <Receipt size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{expense.description}</p>
                      <p className="text-xs text-slate-500">
                        {expense.group.name} · {formatMoney(expense.amount_centavos, expense.group.currency)}
                      </p>
                    </div>
                  </ResultRow>
                ))}
              </ResultSection>
            ) : null}

            {(filter === 'all' || filter === 'activity') && results.activity.length > 0 ? (
              <ResultSection title="Activity">
                {results.activity.map((entry) => {
                  const nameOf = (id: string) =>
                    id === entry.actor_id ? (entry.actor?.display_name ?? 'Someone') : 'Someone';
                  return (
                    <ResultRow key={entry.id} href={`/groups/${entry.group.id}/activity`} onNavigate={onClose}>
                      <Avatar name={entry.actor?.display_name ?? 'Someone'} src={entry.actor?.avatar_url} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-800">
                          {describeActivity(entry, nameOf, entry.group.currency)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {entry.group.name} · {relativeTime(entry.created_at)}
                        </p>
                      </div>
                    </ResultRow>
                  );
                })}
              </ResultSection>
            ) : null}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function ResultSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="card divide-y divide-slate-100 overflow-hidden">{children}</ul>
    </div>
  );
}

function ResultRow({ href, onNavigate, children }: { href: string; onNavigate: () => void; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50"
      >
        {children}
      </Link>
    </li>
  );
}
