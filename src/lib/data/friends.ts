import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, toExpenseInput, toSettlementInput, type ExpenseWithDetail } from '@/lib/data/groups';
import { buildLedger, type Ledger } from '@/lib/balance';
import type { FriendRequest, Profile, Settlement } from '@/types/db';

export interface FriendBundle {
  friend: Profile;
  me: Profile;
  expenses: ExpenseWithDetail[];
  settlements: Settlement[];
  ledger: Ledger;
}

export async function getMyFriends(): Promise<Array<{ profile: Profile; netCentavos: number }>> {
  const supabase = await createClient();
  const me = await getCurrentUser();
  if (!me) return [];

  const { data: rows } = await supabase
    .from('friendships')
    .select('user_a_id, user_b_id')
    .or(`user_a_id.eq.${me.id},user_b_id.eq.${me.id}`);

  const friendIds = (rows ?? []).map((r) => (r.user_a_id === me.id ? r.user_b_id : r.user_a_id));
  if (friendIds.length === 0) return [];

  const { data: profiles } = await supabase.from('profiles').select('*').in('id', friendIds);

  const results = await Promise.all(
    (profiles ?? []).map(async (profile) => {
      const { data: net } = await supabase.rpc('direct_net_position', { other_user_id: profile.id });
      return { profile: profile as Profile, netCentavos: Number(net ?? 0) };
    }),
  );
  return results;
}

export async function getIncomingFriendRequests(): Promise<Array<FriendRequest & { fromProfile: Profile }>> {
  const supabase = await createClient();
  const me = await getCurrentUser();
  if (!me) return [];

  const { data: requests } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('to_user_id', me.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const rows = (requests ?? []) as FriendRequest[];
  if (rows.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles').select('*').in('id', rows.map((r) => r.from_user_id));
  const byId = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));

  return rows.map((r) => ({ ...r, fromProfile: byId.get(r.from_user_id)! })).filter((r) => r.fromProfile);
}

/**
 * Everything one friend pair needs, ledger already computed by the same
 * verified engine group pages use. The expenses/settlements selects rely on
 * RLS (0009_friends.sql) to restrict rows to ones the caller can see at
 * all — the .filter() calls below narrow that further to just this one
 * friend pair, the same "RLS is the real boundary, app code shapes the
 * display" split getGroupBundle already uses.
 */
export const getFriendBundle = cache(async (friendUserId: string): Promise<FriendBundle | null> => {
  const supabase = await createClient();
  const me = await getCurrentUser();
  if (!me) return null;

  const { data: friendship } = await supabase
    .from('friendships')
    .select('user_a_id')
    .or(
      `and(user_a_id.eq.${me.id},user_b_id.eq.${friendUserId}),and(user_a_id.eq.${friendUserId},user_b_id.eq.${me.id})`,
    )
    .maybeSingle();
  if (!friendship) return null;

  const { data: friendProfile } = await supabase.from('profiles').select('*').eq('id', friendUserId).maybeSingle();
  if (!friendProfile) return null;

  const { data: expenseRows } = await supabase
    .from('expenses')
    .select('*, participants:expense_participants(*)')
    .is('group_id', null)
    .order('created_at', { ascending: false });

  const { data: settlementRows } = await supabase
    .from('settlements')
    .select('*')
    .is('group_id', null)
    .order('created_at', { ascending: false });

  const involvesBoth = (participantUserIds: string[]) =>
    participantUserIds.includes(me.id) && participantUserIds.includes(friendUserId);

  const expenses = ((expenseRows ?? []) as unknown as ExpenseWithDetail[]).filter((e) =>
    involvesBoth(e.participants.map((p) => p.user_id)),
  );
  const settlements = ((settlementRows ?? []) as Settlement[]).filter(
    (s) =>
      (s.from_user_id === me.id && s.to_user_id === friendUserId) ||
      (s.from_user_id === friendUserId && s.to_user_id === me.id),
  );

  const ledger = buildLedger({
    members: [me.id, friendUserId],
    expenses: expenses.map(toExpenseInput),
    settlements: settlements.map(toSettlementInput),
  });

  return { friend: friendProfile as Profile, me, expenses, settlements, ledger };
});
