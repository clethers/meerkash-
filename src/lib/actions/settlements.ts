'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getGroupBundle, toExpenseInput, toSettlementInput } from '@/lib/data/groups';
import { buildLedger, validateSettlement } from '@/lib/balance';
import { formatMoney, toCentavos } from '@/lib/money';
import { PROOFS_BUCKET } from '@/lib/constants';
import type { PaymentMethod } from '@/types/db';
import { fail, logActivity, notify, ok, readableError, type ActionResult } from './shared';

/** Requirement 19 + 20: record a payment, capped at what you actually owe. */
export async function createSettlement(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const groupId = String(formData.get('group_id') ?? '');
  const toUserId = String(formData.get('to_user_id') ?? '');
  const method = (String(formData.get('method') ?? 'unspecified') as PaymentMethod);
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!groupId || !toUserId) return fail('Missing settlement details.');

  let amount: number;
  try {
    amount = toCentavos(String(formData.get('amount') ?? ''));
  } catch {
    return fail('Enter a valid peso amount.');
  }

  const bundle = await getGroupBundle(groupId);
  if (!bundle) return fail('You are not a member of this group.');

  // The cap is recomputed here from the ledger — the form's max attribute is
  // a convenience, this is the rule.
  const check = validateSettlement(
    bundle.ledger,
    bundle.settlements.map(toSettlementInput),
    bundle.me.id,
    toUserId,
    amount,
  );
  if (!check.ok) return fail(check.reason ?? 'That settlement is not allowed.');

  const supabase = await createClient();
  const { data: settlement, error } = await supabase
    .from('settlements')
    .insert({
      group_id: groupId,
      from_user_id: bundle.me.id,
      to_user_id: toUserId,
      amount_centavos: amount,
      method,
      note,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !settlement) return fail(readableError(error, 'Could not record that payment.'));

  const proof = formData.get('proof') as File | null;
  if (proof && proof.size > 0) {
    const ext = (proof.name.split('.').pop() ?? 'jpg').toLowerCase().slice(0, 5);
    const path = `${settlement.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(PROOFS_BUCKET)
      .upload(path, proof, { contentType: proof.type || undefined });
    if (!uploadError) {
      await supabase.from('settlements').update({ proof_path: path }).eq('id', settlement.id);
    }
  }

  await logActivity(supabase, {
    groupId, actorId: bundle.me.id, action: 'settlement.created',
    subjectType: 'settlement', subjectId: settlement.id,
    metadata: { to: toUserId, amount_centavos: amount, method },
  });

  await notify(supabase, {
    recipients: [toUserId],
    groupId,
    type: 'settlement.created',
    title: `${bundle.me.display_name} says they paid you ${formatMoney(amount, bundle.group.currency)}`,
    body: 'Confirm or reject it to update your balance.',
    link: `/groups/${groupId}/settle`,
  });

  revalidatePath(`/groups/${groupId}`);
  return ok({ message: 'Payment recorded — waiting for confirmation.' }, `/groups/${groupId}`);
}

async function respond(
  groupId: string,
  settlementId: string,
  status: 'confirmed' | 'rejected',
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const { data: settlement } = await supabase
    .from('settlements')
    .select('*')
    .eq('id', settlementId)
    .maybeSingle();

  if (!settlement) return fail('That settlement no longer exists.');
  if (settlement.to_user_id !== user.id) {
    return fail('Only the person receiving the money can respond to this.');
  }
  if (settlement.status !== 'pending') return fail('That settlement was already answered.');

  const { data: groupRow } = await supabase.from('groups').select('currency').eq('id', groupId).maybeSingle();
  const currency = groupRow?.currency ?? 'PHP';

  const { error } = await supabase
    .from('settlements')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', settlementId);

  if (error) return fail(readableError(error, 'Could not update that settlement.'));

  const { data: me } = await supabase
    .from('profiles').select('display_name').eq('id', user.id).maybeSingle();

  await logActivity(supabase, {
    groupId, actorId: user.id,
    action: status === 'confirmed' ? 'settlement.confirmed' : 'settlement.rejected',
    subjectType: 'settlement', subjectId: settlementId,
    metadata: { amount_centavos: settlement.amount_centavos, from: settlement.from_user_id },
  });

  await notify(supabase, {
    recipients: [settlement.from_user_id],
    groupId,
    type: status === 'confirmed' ? 'settlement.confirmed' : 'settlement.rejected',
    title:
      status === 'confirmed'
        ? `${me?.display_name ?? 'They'} confirmed your ${formatMoney(settlement.amount_centavos, currency)} payment`
        : `${me?.display_name ?? 'They'} rejected your ${formatMoney(settlement.amount_centavos, currency)} payment`,
    body:
      status === 'confirmed'
        ? 'Your balance has been updated.'
        : 'Your balance is unchanged. The record stays in the group history.',
    link: `/groups/${groupId}`,
  });

  revalidatePath(`/groups/${groupId}`);
  return ok({ message: status === 'confirmed' ? 'Settlement confirmed.' : 'Settlement rejected.' });
}

export async function confirmSettlement(groupId: string, settlementId: string) {
  return respond(groupId, settlementId, 'confirmed');
}

export async function rejectSettlement(groupId: string, settlementId: string) {
  return respond(groupId, settlementId, 'rejected');
}

/**
 * Requirement 23 privacy: a signed URL for a settlement proof is only issued
 * to the two people involved. Checked here AND in storage RLS.
 */
export async function getProofUrl(settlementId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: settlement } = await supabase
    .from('settlements')
    .select('proof_path, from_user_id, to_user_id')
    .eq('id', settlementId)
    .maybeSingle();

  if (!settlement?.proof_path) return null;
  if (![settlement.from_user_id, settlement.to_user_id].includes(user.id)) return null;

  const { data } = await supabase.storage
    .from(PROOFS_BUCKET)
    .createSignedUrl(settlement.proof_path, 60 * 10);
  return data?.signedUrl ?? null;
}

/** The pre-filled amount for the Settle Up form. */
export async function settlementCeiling(groupId: string, toUserId: string): Promise<number> {
  const bundle = await getGroupBundle(groupId);
  if (!bundle) return 0;
  const ledger = buildLedger({
    members: bundle.activeMembers.map((m) => m.user_id),
    expenses: bundle.expenses.map(toExpenseInput),
    settlements: bundle.settlements.map(toSettlementInput),
  });
  const check = validateSettlement(
    ledger, bundle.settlements.map(toSettlementInput), bundle.me.id, toUserId, 1,
  );
  return check.max;
}
