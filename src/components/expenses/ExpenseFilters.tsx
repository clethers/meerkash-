'use client';

import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { CATEGORIES } from '@/lib/constants';
import { ExpenseRow } from './ExpenseRow';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ExpenseWithDetail } from '@/lib/data/groups';
import type { CurrencyCode } from '@/types/db';

/** Requirement 28: search and filter by name, member, category, payer, dates. */
export function ExpenseFilters({
  expenses,
  groupId,
  viewerId,
  members,
  currency,
}: {
  expenses: ExpenseWithDetail[];
  groupId: string;
  viewerId: string;
  members: Array<{ id: string; name: string }>;
  currency: CurrencyCode;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [payer, setPayer] = useState('');
  const [member, setMember] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const nameOf = useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m.name]));
    return (id: string) => map.get(id) ?? 'Former member';
  }, [members]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return expenses.filter((expense) => {
      if (!includeDeleted && expense.deleted_at) return false;
      if (needle && !expense.description.toLowerCase().includes(needle)) return false;
      if (category && expense.category !== category) return false;
      if (payer && expense.payer_id !== payer) return false;
      if (member && !expense.participants.some((p) => p.user_id === member)) return false;
      if (from && expense.created_at.slice(0, 10) < from) return false;
      if (to && expense.created_at.slice(0, 10) > to) return false;
      return true;
    });
  }, [expenses, query, category, payer, member, from, to, includeDeleted]);

  const activeFilterCount = [category, payer, member, from, to].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search expenses"
            className="input pl-9"
            aria-label="Search expenses"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <SlidersHorizontal size={16} />
          Filters
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {showFilters ? (
        <div className="card grid gap-3 p-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="f-category">Category</label>
            <select id="f-category" value={category} onChange={(e) => setCategory(e.target.value)} className="input mt-1.5">
              <option value="">Any category</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-payer">Paid by</label>
            <select id="f-payer" value={payer} onChange={(e) => setPayer(e.target.value)} className="input mt-1.5">
              <option value="">Anyone</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-member">Involves</label>
            <select id="f-member" value={member} onChange={(e) => setMember(e.target.value)} className="input mt-1.5">
              <option value="">Anyone</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="f-from">From</label>
              <input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input mt-1.5" />
            </div>
            <div>
              <label className="label" htmlFor="f-to">To</label>
              <input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input mt-1.5" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Show deleted expenses
          </label>
          {activeFilterCount > 0 || query ? (
            <button
              onClick={() => {
                setQuery(''); setCategory(''); setPayer(''); setMember(''); setFrom(''); setTo('');
              }}
              className="justify-self-start text-sm font-medium text-brand-700 hover:underline sm:col-span-2"
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title={expenses.length === 0 ? 'No expenses yet' : 'Nothing matches those filters'}
          description={
            expenses.length === 0
              ? 'Add the first one — whoever paid, and who was actually there.'
              : 'Try a different search or clear the filters.'
          }
        />
      ) : (
        <ul className="card divide-y divide-slate-100 overflow-hidden">
          {filtered.map((expense) => (
            <li key={expense.id}>
              <ExpenseRow
                expense={expense}
                groupId={groupId}
                viewerId={viewerId}
                nameOf={nameOf}
                currency={currency}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
