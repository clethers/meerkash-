'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ScanText } from 'lucide-react';
import { createExpense, updateExpense } from '@/lib/actions/expenses';
import { scanReceipt } from '@/lib/actions/receipts';
import type { ActionResult } from '@/lib/actions/shared';
import type { ReceiptLineItem } from '@/lib/receipt';
import { computeShares } from '@/lib/balance';
import { currencySymbol, formatMoney, toCentavos, toPesoInput } from '@/lib/money';
import { CATEGORIES } from '@/lib/constants';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Select } from '@/components/ui/Select';
import { SubmitButton } from '@/components/ui/SubmitButton';
import type { CurrencyCode, ExpenseCategory, SplitModeDb } from '@/types/db';

export interface MemberOption {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ExpenseFormValues {
  id?: string;
  description: string;
  amount: string;
  payerId: string;
  participants: string[];
  splitMode: SplitModeDb;
  exactShares: Record<string, string>;
  /** Display percentages, e.g. "33.33" for 33.33%. */
  percentages: Record<string, string>;
  /** Integer share counts as strings, e.g. "2". */
  shareCounts: Record<string, string>;
  category: ExpenseCategory;
  note: string;
}

export function ExpenseForm({
  groupId,
  members,
  initial,
  mode,
  currency,
}: {
  groupId: string;
  members: MemberOption[];
  initial: ExpenseFormValues;
  mode: 'create' | 'edit';
  currency: CurrencyCode;
}) {
  const router = useRouter();
  const [state, action] = useActionState<ActionResult | null, FormData>(
    mode === 'create' ? createExpense : updateExpense,
    null,
  );

  const [amount, setAmount] = useState(initial.amount);
  const [payerId, setPayerId] = useState(initial.payerId);
  const [participants, setParticipants] = useState<string[]>(initial.participants);
  const [splitMode, setSplitMode] = useState<SplitModeDb>(initial.splitMode);
  const [exact, setExact] = useState<Record<string, string>>(initial.exactShares);
  const [percentages, setPercentages] = useState<Record<string, string>>(initial.percentages);
  const [shareCounts, setShareCounts] = useState<Record<string, string>>(() =>
    initial.splitMode === 'shares' && Object.keys(initial.shareCounts).length === 0
      ? Object.fromEntries(initial.participants.map((id) => [id, '1']))
      : initial.shareCounts,
  );
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState<ExpenseCategory>(initial.category);
  const [scanning, startScan] = useTransition();
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedItems, setScannedItems] = useState<ReceiptLineItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>({});
  const receiptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  const amountCentavos = useMemo(() => {
    try {
      return toCentavos(amount || '0');
    } catch {
      return 0;
    }
  }, [amount]);

  /** Live preview using the very same engine the server will use. */
  const preview = useMemo(() => {
    if (amountCentavos <= 0 || participants.length === 0) return null;
    try {
      if (splitMode === 'exact') {
        const exactShares: Record<string, number> = {};
        for (const id of participants) {
          exactShares[id] = exact[id] ? toCentavos(exact[id]) : 0;
        }
        return { shares: computeShares({ id: 'draft', payerId, amount: amountCentavos, participants, splitMode: 'exact', exactShares }), error: null };
      }
      if (splitMode === 'percentage') {
        const basisPoints: Record<string, number> = {};
        for (const id of participants) {
          basisPoints[id] = percentages[id] ? Math.round(parseFloat(percentages[id]) * 100) : 0;
        }
        return {
          shares: computeShares({ id: 'draft', payerId, amount: amountCentavos, participants, splitMode: 'percentage', percentages: basisPoints }),
          error: null,
        };
      }
      if (splitMode === 'shares') {
        const shareCountValues: Record<string, number> = {};
        for (const id of participants) {
          shareCountValues[id] = shareCounts[id] ? parseInt(shareCounts[id], 10) : 0;
        }
        return {
          shares: computeShares({ id: 'draft', payerId, amount: amountCentavos, participants, splitMode: 'shares', shares: shareCountValues }),
          error: null,
        };
      }
      return {
        shares: computeShares({ id: 'draft', payerId, amount: amountCentavos, participants, splitMode: 'equal' }),
        error: null,
      };
    } catch (error) {
      return { shares: null, error: error instanceof Error ? error.message : 'That split does not add up.' };
    }
  }, [amountCentavos, participants, splitMode, exact, percentages, shareCounts, payerId]);

  function toggleParticipant(id: string) {
    setParticipants((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    );
  }

  function splitEvenlyIntoExact() {
    if (!preview?.shares) return;
    setExact(
      Object.fromEntries(Object.entries(preview.shares).map(([id, cents]) => [id, toPesoInput(cents)])),
    );
  }

  /**
   * Distributes 10000 basis points the same deterministic way splitEqually
   * distributes centavos, so the toggle never lands on a "doesn't add up to
   * 100%" error the person didn't cause.
   */
  function splitEvenlyIntoPercentage() {
    if (participants.length === 0) return;
    const base = Math.floor(10000 / participants.length);
    let remainder = 10000 - base * participants.length;
    const bp: Record<string, number> = {};
    for (const id of participants) bp[id] = base;
    for (const id of [...participants].sort()) {
      if (remainder <= 0) break;
      bp[id] += 1;
      remainder -= 1;
    }
    setPercentages(Object.fromEntries(Object.entries(bp).map(([id, v]) => [id, (v / 100).toFixed(2)])));
  }

  /** Fills in a default of 1 share for anyone who doesn't already have a count set. */
  function defaultSharesForParticipants() {
    setShareCounts((current) => {
      const next = { ...current };
      for (const id of participants) {
        if (!next[id]) next[id] = '1';
      }
      return next;
    });
  }

  function handleScanReceipt() {
    const file = receiptInputRef.current?.files?.[0];
    if (!file) {
      setScanError('Choose a receipt photo first, then scan it.');
      return;
    }
    setScanError(null);
    startScan(async () => {
      const formData = new FormData();
      formData.set('receipt', file);
      const result = await scanReceipt(null, formData);
      if (!result.ok) {
        setScanError(result.error ?? 'Could not read that receipt.');
        return;
      }
      const rawItems = result.data?.items;
      const items: ReceiptLineItem[] = Array.isArray(rawItems) ? (rawItems as ReceiptLineItem[]) : [];
      setScannedItems(items);
      if (items.length > 0) {
        setSelectedItems(Object.fromEntries(items.map((_, i) => [i, true])));
        setAmount(toPesoInput(items.reduce((sum, item) => sum + item.amountCentavos, 0)));
      } else {
        const suggestedAmount = result.data?.suggestedAmountCentavos;
        if (typeof suggestedAmount === 'number') setAmount(toPesoInput(suggestedAmount));
      }
      const suggestedDescription = result.data?.suggestedDescription;
      if (typeof suggestedDescription === 'string' && suggestedDescription) {
        setDescription(suggestedDescription);
      }
    });
  }

  /** Re-sums only the checked items into the amount field — unchecked items are kept visible but excluded. */
  function toggleScannedItem(index: number) {
    const next = { ...selectedItems, [index]: !selectedItems[index] };
    setSelectedItems(next);
    const sum = scannedItems.reduce((total, item, i) => (next[i] ? total + item.amountCentavos : total), 0);
    setAmount(toPesoInput(sum));
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="group_id" value={groupId} />
      {initial.id ? <input type="hidden" name="expense_id" value={initial.id} /> : null}
      <input type="hidden" name="split_mode" value={splitMode} />

      <div className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="description">What was it for?</label>
          <input
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            maxLength={120}
            className="input mt-1.5"
            placeholder="Dinner at Mang Inasal"
            autoFocus
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="amount">Amount ({currencySymbol(currency)})</label>
            <input
              id="amount"
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="input mt-1.5"
              placeholder="1000.00"
            />
          </div>
          <div>
            <label className="label" htmlFor="payer_id">Who paid?</label>
            <input type="hidden" name="payer_id" value={payerId} />
            <Select
              id="payer_id"
              value={payerId}
              onChange={setPayerId}
              className="mt-1.5"
              options={members.map((m) => ({
                value: m.id,
                label: m.name,
                icon: <Avatar name={m.name} src={m.avatarUrl} size={20} />,
              }))}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="category">Category</label>
          <input type="hidden" name="category" value={category} />
          <Select
            id="category"
            value={category}
            onChange={(v) => setCategory(v as ExpenseCategory)}
            className="mt-1.5"
            options={CATEGORIES.map((c) => ({ value: c.value, label: `${c.emoji} ${c.label}` }))}
          />
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium text-slate-900">Split between</p>
            <p className="text-sm text-slate-600">
              Untick anyone who wasn&apos;t there — they won&apos;t be charged.
            </p>
          </div>
          <div className="flex rounded-lg border border-slate-300 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setSplitMode('equal')}
              className={`rounded-md px-3 py-1.5 font-medium ${splitMode === 'equal' ? 'bg-brand-600 text-white' : 'text-slate-600'}`}
            >
              Equally
            </button>
            <button
              type="button"
              onClick={() => { setSplitMode('exact'); splitEvenlyIntoExact(); }}
              className={`rounded-md px-3 py-1.5 font-medium ${splitMode === 'exact' ? 'bg-brand-600 text-white' : 'text-slate-600'}`}
            >
              Exact amounts
            </button>
            <button
              type="button"
              onClick={() => { setSplitMode('percentage'); splitEvenlyIntoPercentage(); }}
              className={`rounded-md px-3 py-1.5 font-medium ${splitMode === 'percentage' ? 'bg-brand-600 text-white' : 'text-slate-600'}`}
            >
              Percentage
            </button>
            <button
              type="button"
              onClick={() => { setSplitMode('shares'); defaultSharesForParticipants(); }}
              className={`rounded-md px-3 py-1.5 font-medium ${splitMode === 'shares' ? 'bg-brand-600 text-white' : 'text-slate-600'}`}
            >
              Shares
            </button>
          </div>
        </div>

        <ul className="divide-y divide-slate-100">
          {members.map((member) => {
            const checked = participants.includes(member.id);
            return (
              <li key={member.id} className="flex items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  id={`p-${member.id}`}
                  checked={checked}
                  onChange={() => toggleParticipant(member.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                {checked ? <input type="hidden" name="participants" value={member.id} /> : null}
                <Avatar name={member.name} src={member.avatarUrl} size={32} />
                <label htmlFor={`p-${member.id}`} className="min-w-0 flex-1 truncate text-sm text-slate-800">
                  {member.name}
                </label>

                {checked && splitMode === 'exact' ? (
                  <input
                    name={`share_${member.id}`}
                    inputMode="decimal"
                    value={exact[member.id] ?? ''}
                    onChange={(e) => setExact((c) => ({ ...c, [member.id]: e.target.value }))}
                    className="input w-28 py-1.5 text-right"
                    placeholder="0.00"
                    aria-label={`Exact amount for ${member.name}`}
                  />
                ) : checked && splitMode === 'percentage' ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      name={`percentage_${member.id}`}
                      inputMode="decimal"
                      value={percentages[member.id] ?? ''}
                      onChange={(e) => setPercentages((c) => ({ ...c, [member.id]: e.target.value }))}
                      className="input w-20 py-1.5 text-right"
                      placeholder="0.00"
                      aria-label={`Percentage for ${member.name}`}
                    />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                ) : checked && splitMode === 'shares' ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      name={`shares_${member.id}`}
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={shareCounts[member.id] ?? ''}
                      onChange={(e) => setShareCounts((c) => ({ ...c, [member.id]: e.target.value }))}
                      className="input w-16 py-1.5 text-right"
                      placeholder="1"
                      aria-label={`Share count for ${member.name}`}
                    />
                    {preview?.shares ? (
                      <span className="text-sm text-slate-500">
                        {formatMoney(preview.shares[member.id] ?? 0, currency)}
                      </span>
                    ) : null}
                  </div>
                ) : checked && preview?.shares ? (
                  <span className="text-sm font-medium text-slate-700">
                    {formatMoney(preview.shares[member.id] ?? 0, currency)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>

        {preview?.error ? <Alert tone="error">{preview.error}</Alert> : null}
        {participants.length === 0 ? (
          <Alert tone="warning">Pick at least one person to split this with.</Alert>
        ) : null}
      </div>

      <div className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="note">Note (optional)</label>
          <textarea id="note" name="note" defaultValue={initial.note} rows={2} className="input mt-1.5" placeholder="Paid the whole bill, we'll settle later" />
        </div>
        <div>
          <label className="label" htmlFor="receipt">Receipt or proof (optional)</label>
          <input
            id="receipt"
            name="receipt"
            type="file"
            accept="image/*,application/pdf"
            ref={receiptInputRef}
            className="mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          <p className="mt-1 text-xs text-slate-500">
            Everyone in the group can see receipts. Up to 10 MB.
          </p>
          <button
            type="button"
            onClick={handleScanReceipt}
            disabled={scanning}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <ScanText size={15} /> {scanning ? 'Reading receipt…' : 'Scan receipt to fill amount'}
          </button>
          {scanError ? <p className="mt-1.5 text-sm text-rose-700">{scanError}</p> : null}
          {scannedItems.length > 0 ? (
            <div className="mt-2">
              <p className="text-xs text-slate-500">
                Found {scannedItems.length} item{scannedItems.length === 1 ? '' : 's'} — untick any that don&apos;t belong.
              </p>
              <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {scannedItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedItems[i] ?? true}
                      onChange={() => toggleScannedItem(i)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      aria-label={`Include ${item.description}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-700">{item.description}</span>
                    <span className="text-slate-500">{formatMoney(item.amountCentavos, currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="flex gap-2">
        <SubmitButton
          size="lg"
          className="flex-1"
          pendingLabel="Saving…"
          disabled={participants.length === 0 || amountCentavos <= 0}
        >
          {mode === 'create' ? 'Add expense' : 'Save changes'}
        </SubmitButton>
      </div>
    </form>
  );
}
