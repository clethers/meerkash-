'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getGroupBundle } from '@/lib/data/groups';
import { computeShares, type ExpenseInput } from '@/lib/balance';
import { formatMoney, toCentavos } from '@/lib/money';
import { RECEIPTS_BUCKET } from '@/lib/constants';
import type { ExpenseCategory, SplitModeDb } from '@/types/db';
import { fail, logActivity, notify, ok, readableError, type ActionResult } from './shared';

interface ParsedExpense {
  description: string;
  amount: number;
  payerId: string;
  participants: string[];
  splitMode: SplitModeDb;
  shares: Record<string, number>;
  percentages?: Record<string, number>;
  shareCounts?: Record<string, number>;
  category: ExpenseCategory;
  note: string | null;
}

function parseExpenseForm(formData: FormData): ParsedExpense | string {
  const description = String(formData.get('description') ?? '').trim();
  if (description.length < 1) return 'Give the expense a name.';
  if (description.length > 120) return 'That name is too long.';

  let amount: number;
  try {
    amount = toCentavos(String(formData.get('amount') ?? ''));
  } catch {
    return 'Enter a valid peso amount.';
  }
  if (amount <= 0) return 'The amount must be more than ₱0.';

  const payerId = String(formData.get('payer_id') ?? '');
  if (!payerId) return 'Choose who paid.';

  const participants = formData.getAll('participants').map(String).filter(Boolean);
  if (participants.length === 0) return 'Choose at least one person to split this with.';

  const splitMode = (String(formData.get('split_mode') ?? 'equal') as SplitModeDb);
  const category = (String(formData.get('category') ?? 'other') as ExpenseCategory);
  const note = String(formData.get('note') ?? '').trim() || null;

  const input: ExpenseInput = { id: 'draft', payerId, amount, participants, splitMode };

  if (splitMode === 'exact') {
    const exactShares: Record<string, number> = {};
    for (const id of participants) {
      const raw = String(formData.get(`share_${id}`) ?? '').trim();
      try {
        exactShares[id] = raw === '' ? 0 : toCentavos(raw);
      } catch {
        return 'One of the exact amounts is not a valid peso value.';
      }
    }
    input.exactShares = exactShares;
  } else if (splitMode === 'percentage') {
    const percentages: Record<string, number> = {};
    for (const id of participants) {
      const raw = String(formData.get(`percentage_${id}`) ?? '').trim();
      const value = raw === '' ? NaN : Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return 'One of the percentages is not a valid value between 0 and 100.';
      }
      percentages[id] = Math.round(value * 100);
    }
    input.percentages = percentages;
  } else if (splitMode === 'shares') {
    const shareCounts: Record<string, number> = {};
    for (const id of participants) {
      const raw = String(formData.get(`shares_${id}`) ?? '').trim();
      const value = raw === '' ? NaN : Number(raw);
      if (!Number.isInteger(value) || value < 1) {
        return 'One of the share counts is not a valid whole number of at least 1.';
      }
      shareCounts[id] = value;
    }
    input.shares = shareCounts;
  }

  try {
    const shares = computeShares(input);
    return {
      description, amount, payerId, participants, splitMode, shares,
      percentages: input.percentages, shareCounts: input.shares, category, note,
    };
  } catch (error) {
    return readableError(error, 'That split does not add up.');
  }
}

async function uploadReceipt(
  groupId: string, expenseId: string, file: File | null,
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const supabase = await createClient();
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().slice(0, 5);
  const path = `${groupId}/${expenseId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  return error ? null : path;
}

export async function createExpense(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const groupId = String(formData.get('group_id') ?? '');
  if (!groupId) return fail('Missing group.');

  const parsed = parseExpenseForm(formData);
  if (typeof parsed === 'string') return fail(parsed);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const { data: groupRow } = await supabase.from('groups').select('currency').eq('id', groupId).maybeSingle();
  const currency = groupRow?.currency ?? 'PHP';

  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      group_id: groupId,
      description: parsed.description,
      amount_centavos: parsed.amount,
      payer_id: parsed.payerId,
      category: parsed.category,
      note: parsed.note,
      split_mode: parsed.splitMode,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !expense) return fail(readableError(error, 'Could not save the expense.'));

  const { error: partError } = await supabase.from('expense_participants').insert(
    Object.entries(parsed.shares).map(([user_id, share_centavos]) => ({
      expense_id: expense.id, user_id, share_centavos,
      percentage_basis_points: parsed.percentages?.[user_id] ?? null,
      shares: parsed.shareCounts?.[user_id] ?? null,
    })),
  );
  if (partError) return fail(readableError(partError, 'Could not save the split.'));

  const receiptPath = await uploadReceipt(groupId, expense.id, formData.get('receipt') as File | null);
  if (receiptPath) {
    await supabase.from('expenses').update({ receipt_path: receiptPath }).eq('id', expense.id);
  }

  await logActivity(supabase, {
    groupId, actorId: user.id, action: 'expense.created',
    subjectType: 'expense', subjectId: expense.id,
    metadata: { description: parsed.description, amount_centavos: parsed.amount },
  });

  await notify(supabase, {
    recipients: [...parsed.participants, parsed.payerId],
    exclude: user.id,
    groupId,
    type: 'expense.created',
    title: `New expense: ${parsed.description}`,
    body: `${formatMoney(parsed.amount, currency)} — your balance changed.`,
    link: `/groups/${groupId}/expenses/${expense.id}`,
  });

  revalidatePath(`/groups/${groupId}`);
  return ok({ expenseId: expense.id }, `/groups/${groupId}`);
}

/** Requirement 13: edits keep the old values and tell the people affected. */
export async function updateExpense(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const groupId = String(formData.get('group_id') ?? '');
  const expenseId = String(formData.get('expense_id') ?? '');
  if (!groupId || !expenseId) return fail('Missing expense.');

  const parsed = parseExpenseForm(formData);
  if (typeof parsed === 'string') return fail(parsed);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const { data: before } = await supabase
    .from('expenses')
    .select('*, participants:expense_participants(*)')
    .eq('id', expenseId)
    .maybeSingle();

  if (!before) return fail('That expense no longer exists.');
  if (before.deleted_at) return fail('That expense was deleted.');

  const previousParticipants: string[] =
    (before.participants as Array<{ user_id: string }> | null)?.map((p) => p.user_id) ?? [];

  const beforeValue = {
    description: before.description,
    amount_centavos: before.amount_centavos,
    payer_id: before.payer_id,
    category: before.category,
    note: before.note,
    split_mode: before.split_mode,
    participants: [...previousParticipants].sort(),
  };
  const afterValue = {
    description: parsed.description,
    amount_centavos: parsed.amount,
    payer_id: parsed.payerId,
    category: parsed.category,
    note: parsed.note,
    split_mode: parsed.splitMode,
    participants: [...parsed.participants].sort(),
  };

  const changedFields = Object.keys(afterValue).filter(
    (key) =>
      JSON.stringify(afterValue[key as keyof typeof afterValue]) !==
      JSON.stringify(beforeValue[key as keyof typeof beforeValue]),
  );

  if (changedFields.length === 0) return ok({ message: 'Nothing changed.' });

  const { error } = await supabase
    .from('expenses')
    .update({
      description: parsed.description,
      amount_centavos: parsed.amount,
      payer_id: parsed.payerId,
      category: parsed.category,
      note: parsed.note,
      split_mode: parsed.splitMode,
      updated_by: user.id,
    })
    .eq('id', expenseId);

  if (error) return fail(readableError(error, 'Could not update the expense.'));

  await supabase.from('expense_participants').delete().eq('expense_id', expenseId);
  await supabase.from('expense_participants').insert(
    Object.entries(parsed.shares).map(([user_id, share_centavos]) => ({
      expense_id: expenseId, user_id, share_centavos,
      percentage_basis_points: parsed.percentages?.[user_id] ?? null,
      shares: parsed.shareCounts?.[user_id] ?? null,
    })),
  );

  await supabase.from('expense_revisions').insert({
    expense_id: expenseId,
    edited_by: user.id,
    changed_fields: changedFields,
    before_value: beforeValue,
    after_value: afterValue,
  });

  await logActivity(supabase, {
    groupId, actorId: user.id, action: 'expense.edited',
    subjectType: 'expense', subjectId: expenseId,
    metadata: { changed_fields: changedFields, description: parsed.description },
  });

  await notify(supabase, {
    recipients: [...previousParticipants, ...parsed.participants, before.payer_id, parsed.payerId],
    exclude: user.id,
    groupId,
    type: 'expense.edited',
    title: `"${parsed.description}" was edited`,
    body: 'Your balance may have changed.',
    link: `/groups/${groupId}/expenses/${expenseId}`,
  });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/expenses/${expenseId}`);
  return ok({ message: 'Expense updated.' }, `/groups/${groupId}/expenses/${expenseId}`);
}

/** Requirement 14: soft delete. The row and its history stay in Activity. */
export async function deleteExpense(groupId: string, expenseId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const { data: expense } = await supabase
    .from('expenses')
    .select('description, amount_centavos, payer_id, participants:expense_participants(user_id)')
    .eq('id', expenseId)
    .maybeSingle();

  const { error } = await supabase
    .from('expenses')
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq('id', expenseId);

  if (error) return fail(readableError(error, 'Could not delete the expense.'));

  const affected =
    (expense?.participants as Array<{ user_id: string }> | null)?.map((p) => p.user_id) ?? [];

  await logActivity(supabase, {
    groupId, actorId: user.id, action: 'expense.deleted',
    subjectType: 'expense', subjectId: expenseId,
    metadata: {
      description: expense?.description ?? 'Expense',
      amount_centavos: expense?.amount_centavos ?? 0,
    },
  });

  await notify(supabase, {
    recipients: [...affected, expense?.payer_id ?? ''],
    exclude: user.id,
    groupId,
    type: 'expense.deleted',
    title: `"${expense?.description ?? 'An expense'}" was deleted`,
    body: 'Your balance changed.',
    link: `/groups/${groupId}`,
  });

  revalidatePath(`/groups/${groupId}`);
  return ok({ message: 'Expense deleted.' }, `/groups/${groupId}`);
}

export async function addComment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const groupId = String(formData.get('group_id') ?? '');
  const expenseId = String(formData.get('expense_id') ?? '');
  const body = String(formData.get('body') ?? '').trim();

  if (!body) return fail('Write something first.');
  if (body.length > 1000) return fail('That comment is too long.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const { error } = await supabase
    .from('expense_comments')
    .insert({ expense_id: expenseId, user_id: user.id, body });

  if (error) return fail(readableError(error, 'Could not post your comment.'));

  revalidatePath(`/groups/${groupId}/expenses/${expenseId}`);
  return ok({ message: 'Comment posted.' });
}

/** Signed URL for a receipt. RLS decides whether Supabase hands one over. */
export async function getReceiptUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}

export async function addMemberToExpense(
  groupId: string, expenseId: string, userId: string,
): Promise<ActionResult> {
  const bundle = await getGroupBundle(groupId);
  if (!bundle) return fail('You are not a member of this group.');

  const expense = bundle.expenses.find((e) => e.id === expenseId);
  if (!expense) return fail('That expense no longer exists.');
  if (expense.deleted_at) return fail('That expense was deleted.');
  if (expense.participants.some((p) => p.user_id === userId)) {
    return fail('They are already in this expense.');
  }

  const participants = [...expense.participants.map((p) => p.user_id), userId];
  const shares = computeShares({
    id: expense.id,
    payerId: expense.payer_id,
    amount: expense.amount_centavos,
    participants,
    splitMode: 'equal',
  });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  await supabase.from('expense_participants').delete().eq('expense_id', expenseId);
  const { error } = await supabase.from('expense_participants').insert(
    Object.entries(shares).map(([user_id, share_centavos]) => ({
      expense_id: expenseId, user_id, share_centavos,
    })),
  );
  if (error) return fail(readableError(error, 'Could not update the split.'));

  await supabase.from('expenses').update({ split_mode: 'equal', updated_by: user.id }).eq('id', expenseId);

  await supabase.from('expense_revisions').insert({
    expense_id: expenseId,
    edited_by: user.id,
    changed_fields: ['participants'],
    before_value: { participants: expense.participants.map((p) => p.user_id).sort() },
    after_value: { participants: [...participants].sort() },
  });

  await logActivity(supabase, {
    groupId, actorId: user.id, action: 'expense.participant_added',
    subjectType: 'expense', subjectId: expenseId,
    metadata: { added: userId, description: expense.description },
  });

  await notify(supabase, {
    recipients: participants,
    exclude: user.id,
    groupId,
    type: 'expense.participant_added',
    title: `"${expense.description}" was recalculated`,
    body: 'Someone was added to this expense and your share changed.',
    link: `/groups/${groupId}/expenses/${expenseId}`,
  });

  revalidatePath(`/groups/${groupId}`);
  return ok({ message: 'Expense recalculated.' });
}
