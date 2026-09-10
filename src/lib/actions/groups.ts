'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getGroupBundle } from '@/lib/data/groups';
import { canLeaveGroup } from '@/lib/balance';
import { suggestGroupName } from '@/lib/utils';
import { uploadAvatar } from '@/lib/storage';
import { CURRENCY_CODES, SPLIT_MODES } from '@/lib/constants';
import type { CurrencyCode, SplitModeDb } from '@/types/db';
import { fail, logActivity, notify, ok, readableError, type ActionResult } from './shared';

export async function createGroup(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const { data: profile } = await supabase
    .from('profiles').select('display_name').eq('id', user.id).maybeSingle();

  const typed = String(formData.get('name') ?? '').trim();
  const name = typed || suggestGroupName([profile?.display_name ?? 'You']);

  const currencyRaw = String(formData.get('currency') ?? 'PHP').toUpperCase();
  if (!CURRENCY_CODES.includes(currencyRaw as CurrencyCode)) {
    return fail(`"${currencyRaw}" is not a supported currency.`);
  }
  const currency = currencyRaw as CurrencyCode;

  const { data: group, error } = await supabase
    .from('groups')
    .insert({ name, currency, owner_id: user.id, created_by: user.id })
    .select('id')
    .single();

  if (error || !group) return fail(readableError(error, 'Could not create the group.'));

  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: user.id, role: 'owner', status: 'active' });

  if (memberError) return fail(readableError(memberError, 'Group created but you were not added.'));

  await logActivity(supabase, {
    groupId: group.id, actorId: user.id,
    action: 'group.created', subjectType: 'group', subjectId: group.id,
    metadata: { name },
  });

  revalidatePath('/groups');
  return ok({ groupId: group.id }, `/groups/${group.id}`);
}

export async function updateGroup(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const groupId = String(formData.get('group_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  let avatarUrl = String(formData.get('avatar_url') ?? '').trim();

  if (!groupId) return fail('Missing group.');
  if (name.length < 1) return fail('A group needs a name.');

  const defaultSplitModeRaw = String(formData.get('default_split_mode') ?? 'equal');
  if (!SPLIT_MODES.some((m) => m.value === defaultSplitModeRaw)) {
    return fail(`"${defaultSplitModeRaw}" is not a supported split mode.`);
  }
  const defaultSplitMode = defaultSplitModeRaw as SplitModeDb;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const upload = await uploadAvatar(supabase, 'groups', groupId, formData.get('avatar') as File | null);
  if (upload && 'error' in upload) return fail(upload.error);
  if (upload) avatarUrl = upload.url;

  const { data: before } = await supabase
    .from('groups').select('name, avatar_url').eq('id', groupId).maybeSingle();

  const { error } = await supabase
    .from('groups')
    .update({ name, avatar_url: avatarUrl || null, default_split_mode: defaultSplitMode })
    .eq('id', groupId);

  // RLS: only the owner passes this update. A member's attempt affects 0 rows.
  if (error) return fail(readableError(error, 'Only the group owner can change these settings.'));

  if (before && before.name !== name) {
    await logActivity(supabase, {
      groupId, actorId: user.id, action: 'group.renamed',
      subjectType: 'group', subjectId: groupId,
      metadata: { from: before.name, to: name },
    });
  }

  revalidatePath(`/groups/${groupId}`);
  return ok({ message: 'Group updated.' });
}

/** Requirement 4: shareable invitation link (the QR is rendered from it). */
export async function createInvite(groupId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const { data: existing } = await supabase
    .from('group_invites')
    .select('token, expires_at')
    .eq('group_id', groupId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .is('max_uses', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return ok({ token: existing.token });

  const { data, error } = await supabase
    .from('group_invites')
    .insert({ group_id: groupId, created_by: user.id })
    .select('token')
    .single();

  if (error || !data) return fail(readableError(error, 'Could not create an invitation link.'));
  return ok({ token: data.token });
}

export async function revokeInvite(inviteId: string, groupId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('group_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId);
  if (error) return fail(readableError(error, 'Could not revoke that link.'));
  revalidatePath(`/groups/${groupId}/members`);
  return ok({ message: 'Invitation link revoked.' });
}

export async function acceptInvite(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('accept_invite', { invite_token: token });
  if (error) return fail(readableError(error, 'We could not add you to that group.'));
  revalidatePath('/groups');
  return ok({ groupId: data as string }, `/groups/${data as string}`);
}

/** Requirement 25 — checked here for a good message, enforced again in SQL. */
export async function leaveGroup(groupId: string): Promise<ActionResult> {
  const bundle = await getGroupBundle(groupId);
  if (!bundle) return fail('You are not a member of this group.');

  const check = canLeaveGroup(bundle.ledger, bundle.me.id);
  if (!check.allowed) return fail(check.reason ?? 'You cannot leave this group yet.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('leave_group', { gid: groupId });
  if (error) return fail(readableError(error, 'Could not leave the group.'));

  revalidatePath('/groups');
  return ok(undefined, '/groups');
}

export async function removeMember(groupId: string, userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_member', { gid: groupId, target: userId });
  if (error) return fail(readableError(error, 'Could not remove that member.'));
  revalidatePath(`/groups/${groupId}`);
  return ok({ message: 'Member removed.' });
}

/** Requirement 26. */
export async function transferOwnership(groupId: string, userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('transfer_ownership', { gid: groupId, new_owner: userId });
  if (error) return fail(readableError(error, 'Could not transfer ownership.'));
  revalidatePath(`/groups/${groupId}`);
  return ok({ message: 'Ownership transferred.' });
}

export async function nudgeMember(
  groupId: string, userId: string, amountLabel: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const { data: me } = await supabase
    .from('profiles').select('display_name').eq('id', user.id).maybeSingle();

  await notify(supabase, {
    recipients: [userId],
    groupId,
    type: 'balance.reminder',
    title: `${me?.display_name ?? 'Someone'} sent you a reminder`,
    body: `You still owe ${amountLabel}.`,
    link: `/groups/${groupId}`,
  });

  return ok({ message: 'Reminder sent.' });
}
