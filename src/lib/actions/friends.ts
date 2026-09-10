'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getFriendBundle } from '@/lib/data/friends';
import { toSettlementInput } from '@/lib/data/groups';
import { computeShares, validateSettlement, type ExpenseInput } from '@/lib/balance';
import { formatPHP, toCentavos } from '@/lib/money';
import { fail, notify, ok, readableError, type ActionResult } from './shared';

export async function sendFriendRequest(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return fail('Enter an email address.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const { data: searchData, error: searchError } = await supabase
    .rpc('search_user_by_email', { target_email: email });
  if (searchError) return fail(readableError(searchError, 'Could not search for that person.'));
  const found = (Array.isArray(searchData) ? searchData[0] : searchData) as { id: string } | undefined;
  if (!found) return fail('No Meerkash account uses that email.');

  const { error } = await supabase.rpc('send_friend_request', { target_user_id: found.id });
  if (error) return fail(readableError(error, 'Could not send the friend request.'));

  revalidatePath('/friends');
  return ok({ message: 'Friend request sent.' });
}

export async function respondToFriendRequest(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const requestId = String(formData.get('request_id') ?? '');
  const action = String(formData.get('action') ?? '');
  if (!requestId || (action !== 'accept' && action !== 'decline')) return fail('Missing request details.');

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    action === 'accept' ? 'accept_friend_request' : 'decline_friend_request',
    { request_id: requestId },
  );
  if (error) return fail(readableError(error, 'Could not respond to that request.'));

  revalidatePath('/friends');
  return ok({ message: action === 'accept' ? 'Friend request accepted.' : 'Friend request declined.' });
}

export async function removeFriend(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const friendId = String(formData.get('friend_id') ?? '');
  if (!friendId) return fail('Missing friend.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_friend', { friend_user_id: friendId });
  if (error) return fail(readableError(error, 'Could not remove that friend.'));

  revalidatePath('/friends');
  return ok({ message: 'Friend removed.' });
}

export async function createDirectExpense(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const friendId = String(formData.get('friend_id') ?? '');
  if (!friendId) return fail('Missing friend.');

  const description = String(formData.get('description') ?? '').trim();
  if (description.length < 1) return fail('Give the expense a name.');

  let amount: number;
  try {
    amount = toCentavos(String(formData.get('amount') ?? ''));
  } catch {
    return fail('Enter a valid peso amount.');
  }
  if (amount <= 0) return fail('The amount must be more than ₱0.');

  const payerId = String(formData.get('payer_id') ?? '');
  if (!payerId) return fail('Choose who paid.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const participants = [user.id, friendId];
  const input: ExpenseInput = { id: 'draft', payerId, amount, participants, splitMode: 'equal' };
  let shares: Record<string, number>;
  try {
    shares = computeShares(input);
  } catch (error) {
    return fail(readableError(error, 'That split does not add up.'));
  }

  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      group_id: null,
      description,
      amount_centavos: amount,
      payer_id: payerId,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error || !expense) return fail(readableError(error, 'Could not save the expense.'));

  const { error: partError } = await supabase.from('expense_participants').insert(
    Object.entries(shares).map(([user_id, share_centavos]) => ({
      expense_id: expense.id, user_id, share_centavos,
    })),
  );
  if (partError) return fail(readableError(partError, 'Could not save the split.'));

  await notify(supabase, {
    recipients: [friendId],
    exclude: user.id,
    groupId: null,
    type: 'expense.created',
    title: `New expense: ${description}`,
    body: `${formatPHP(amount)} — your balance changed.`,
    link: `/friends/${user.id === payerId ? friendId : payerId}`,
  });

  revalidatePath(`/friends/${friendId}`);
  return ok({ expenseId: expense.id }, `/friends/${friendId}`);
}

export async function createDirectSettlement(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const friendId = String(formData.get('friend_id') ?? '');
  if (!friendId) return fail('Missing friend.');

  let amount: number;
  try {
    amount = toCentavos(String(formData.get('amount') ?? ''));
  } catch {
    return fail('Enter a valid peso amount.');
  }

  const bundle = await getFriendBundle(friendId);
  if (!bundle) return fail('You are not friends with this person.');

  const check = validateSettlement(
    bundle.ledger, bundle.settlements.map(toSettlementInput), bundle.me.id, friendId, amount,
  );
  if (!check.ok) return fail(check.reason ?? 'That settlement is not allowed.');

  const supabase = await createClient();
  const { error } = await supabase.from('settlements').insert({
    group_id: null,
    from_user_id: bundle.me.id,
    to_user_id: friendId,
    amount_centavos: amount,
    status: 'pending',
  });
  if (error) return fail(readableError(error, 'Could not record that payment.'));

  await notify(supabase, {
    recipients: [friendId],
    groupId: null,
    type: 'settlement.created',
    title: `${bundle.me.display_name} says they paid you ${formatPHP(amount)}`,
    body: 'Confirm or reject it to update your balance.',
    link: `/friends/${bundle.me.id}`,
  });

  revalidatePath(`/friends/${friendId}`);
  return ok({ message: 'Payment recorded — waiting for confirmation.' }, `/friends/${friendId}`);
}

export async function respondToDirectSettlement(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const settlementId = String(formData.get('settlement_id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!settlementId || (status !== 'confirmed' && status !== 'rejected')) return fail('Missing details.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const { data: settlement } = await supabase
    .from('settlements').select('*').eq('id', settlementId).is('group_id', null).maybeSingle();
  if (!settlement) return fail('That settlement no longer exists.');
  if (settlement.to_user_id !== user.id) return fail('Only the person receiving the money can respond to this.');
  if (settlement.status !== 'pending') return fail('That settlement was already answered.');

  const { error } = await supabase
    .from('settlements')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', settlementId);
  if (error) return fail(readableError(error, 'Could not update that settlement.'));

  await notify(supabase, {
    recipients: [settlement.from_user_id],
    groupId: null,
    type: status === 'confirmed' ? 'settlement.confirmed' : 'settlement.rejected',
    title:
      status === 'confirmed'
        ? `Your ${formatPHP(settlement.amount_centavos)} payment was confirmed`
        : `Your ${formatPHP(settlement.amount_centavos)} payment was rejected`,
    body: status === 'confirmed' ? 'Your balance has been updated.' : 'Your balance is unchanged.',
    link: `/friends/${settlement.from_user_id}`,
  });

  revalidatePath(`/friends/${user.id}`);
  return ok({ message: status === 'confirmed' ? 'Settlement confirmed.' : 'Settlement rejected.' });
}
