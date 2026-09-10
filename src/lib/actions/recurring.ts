'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { toCentavos } from '@/lib/money';
import { advance } from '@/lib/recurring';
import type { ExpenseCategory, RecurringOccurrence, RecurringTemplate, Recurrence } from '@/types/db';
import { fail, logActivity, ok, readableError, type ActionResult } from './shared';

export async function listTemplates(groupId: string): Promise<RecurringTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .order('next_due_on', { ascending: true });
  return (data ?? []) as RecurringTemplate[];
}

export async function listDueOccurrences(groupId: string): Promise<RecurringOccurrence[]> {
  const supabase = await createClient();
  const templates = await listTemplates(groupId);
  if (templates.length === 0) return [];

  const { data } = await supabase
    .from('recurring_occurrences')
    .select('*')
    .in('template_id', templates.map((t) => t.id))
    .is('expense_id', null)
    .is('skipped_at', null)
    .order('due_on', { ascending: true });

  return (data ?? []) as RecurringOccurrence[];
}

export async function createTemplate(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const groupId = String(formData.get('group_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const frequency = String(formData.get('frequency') ?? 'monthly') as Recurrence;
  const category = String(formData.get('category') ?? 'other') as ExpenseCategory;
  const nextDueOn = String(formData.get('next_due_on') ?? '').slice(0, 10);
  const rawAmount = String(formData.get('amount') ?? '').trim();
  const payerId = String(formData.get('default_payer_id') ?? '') || null;
  const participants = formData.getAll('participants').map(String).filter(Boolean);

  if (!groupId) return fail('Missing group.');
  if (name.length < 1) return fail('Give the recurring expense a name.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueOn)) return fail('Choose the first due date.');

  let amount: number | null = null;
  if (rawAmount) {
    try {
      amount = toCentavos(rawAmount);
    } catch {
      return fail('Enter a valid peso amount, or leave it blank.');
    }
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const { data: template, error } = await supabase
    .from('recurring_templates')
    .insert({
      group_id: groupId,
      name,
      amount_centavos: amount,
      category,
      frequency,
      next_due_on: nextDueOn,
      default_payer_id: payerId,
      default_participants: participants,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !template) return fail(readableError(error, 'Could not save that reminder.'));

  await supabase
    .from('recurring_occurrences')
    .insert({ template_id: template.id, due_on: nextDueOn });

  await logActivity(supabase, {
    groupId, actorId: user.id, action: 'recurring.created',
    subjectType: 'recurring', subjectId: template.id, metadata: { name, frequency },
  });

  revalidatePath(`/groups/${groupId}/recurring`);
  return ok({ message: 'Reminder created.' });
}

export async function skipOccurrence(groupId: string, occurrenceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const { data: occurrence } = await supabase
    .from('recurring_occurrences')
    .select('*, template:recurring_templates(*)')
    .eq('id', occurrenceId)
    .maybeSingle();

  if (!occurrence) return fail('That reminder no longer exists.');

  const { error } = await supabase
    .from('recurring_occurrences')
    .update({ skipped_at: new Date().toISOString(), recorded_by: user.id })
    .eq('id', occurrenceId);

  if (error) return fail(readableError(error, 'Could not skip that occurrence.'));

  const template = occurrence.template as RecurringTemplate | null;
  if (template) {
    const next = advance(occurrence.due_on as string, template.frequency);
    await supabase.from('recurring_templates').update({ next_due_on: next }).eq('id', template.id);
    await supabase
      .from('recurring_occurrences')
      .upsert({ template_id: template.id, due_on: next }, { onConflict: 'template_id,due_on' });
  }

  revalidatePath(`/groups/${groupId}/recurring`);
  return ok({ message: 'Skipped.' });
}

export async function linkOccurrence(
  groupId: string, occurrenceId: string, expenseId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const { data: occurrence } = await supabase
    .from('recurring_occurrences')
    .select('*, template:recurring_templates(*)')
    .eq('id', occurrenceId)
    .maybeSingle();

  if (!occurrence) return fail('That reminder no longer exists.');

  await supabase
    .from('recurring_occurrences')
    .update({ expense_id: expenseId, recorded_by: user.id })
    .eq('id', occurrenceId);

  const template = occurrence.template as RecurringTemplate | null;
  if (template) {
    const next = advance(occurrence.due_on as string, template.frequency);
    await supabase.from('recurring_templates').update({ next_due_on: next }).eq('id', template.id);
    await supabase
      .from('recurring_occurrences')
      .upsert({ template_id: template.id, due_on: next }, { onConflict: 'template_id,due_on' });
  }

  revalidatePath(`/groups/${groupId}/recurring`);
  return ok({ message: 'Recorded.' });
}

export async function deactivateTemplate(groupId: string, templateId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('recurring_templates')
    .update({ active: false, deleted_at: new Date().toISOString() })
    .eq('id', templateId);
  if (error) return fail(readableError(error, 'Could not remove that reminder.'));
  revalidatePath(`/groups/${groupId}/recurring`);
  return ok({ message: 'Reminder removed.' });
}
