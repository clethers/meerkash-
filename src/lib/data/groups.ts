import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { buildLedger } from '@/lib/balance';
import type { ExpenseInput, Ledger, SettlementInput } from '@/lib/balance';
import type {
  ActivityEntry, Expense, ExpenseParticipant, Group, GroupMember,
  Profile, Settlement,
} from '@/types/db';

export interface MemberWithProfile extends GroupMember {
  profile: Profile;
}

export interface ExpenseWithDetail extends Expense {
  participants: ExpenseParticipant[];
}

export interface GroupBundle {
  group: Group;
  me: Profile;
  myRole: 'owner' | 'member';
  members: MemberWithProfile[];
  activeMembers: MemberWithProfile[];
  expenses: ExpenseWithDetail[];
  settlements: Settlement[];
  ledger: Ledger;
  nameOf: (userId: string) => string;
}

/**
 * Just the auth check (one round-trip) — for callers that only need to know
 * *whether* a session exists, like the app layout's redirect-to-login gate.
 * Deliberately re-verifies against the Auth server (not a cookie-only read)
 * so a tampered session cookie can't be trusted; that's the one round-trip
 * that can't be skipped. React-cached so every other call in the same
 * request (including inside getCurrentUser below) reuses this result
 * instead of re-asking.
 */
export const getAuthUser = cache(async () => {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentUser = cache(async (): Promise<Profile | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});

export const requireUser = cache(async (): Promise<Profile> => {
  const profile = await getCurrentUser();
  if (!profile) throw new Error('Not signed in');
  return profile;
});

/**
 * Everything one group page needs, in one place, with the ledger already
 * computed by the verified engine in src/lib/balance.
 * Returns null when the viewer is not an active member — RLS would return
 * empty rows anyway, this just makes the 404 explicit.
 */
export const getGroupBundle = cache(async (groupId: string): Promise<GroupBundle | null> => {
  const supabase = await createClient();

  // None of these five reads depend on each other's results — only on
  // groupId/the session, both already known — so they go over the wire
  // together instead of as five sequential round-trips to Supabase.
  const [me, groupResult, memberResult, expenseResult, settlementResult] = await Promise.all([
    getCurrentUser(),
    supabase.from('groups').select('*').eq('id', groupId).is('deleted_at', null).maybeSingle(),
    supabase
      .from('group_members')
      .select('*, profile:profiles!group_members_user_id_fkey(*)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true }),
    supabase
      .from('expenses')
      .select('*, participants:expense_participants(*)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
    supabase
      .from('settlements')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
  ]);

  if (!me) return null;
  const group = groupResult.data;
  if (!group) return null;

  const members = (memberResult.data ?? []) as unknown as MemberWithProfile[];
  const mine = members.find((m) => m.user_id === me.id && m.status === 'active');
  if (!mine) return null;

  const expenses = (expenseResult.data ?? []) as unknown as ExpenseWithDetail[];
  const settlements = (settlementResult.data ?? []) as Settlement[];
  const activeMembers = members.filter((m) => m.status === 'active');

  const ledger = buildLedger({
    members: activeMembers.map((m) => m.user_id),
    expenses: expenses.map(toExpenseInput),
    settlements: settlements.map(toSettlementInput),
  });

  const names = new Map(members.map((m) => [m.user_id, m.profile?.display_name ?? 'Member']));

  return {
    group: group as Group,
    me,
    myRole: mine.role,
    members,
    activeMembers,
    expenses,
    settlements,
    ledger,
    nameOf: (userId: string) => names.get(userId) ?? 'Former member',
  };
});

export function toExpenseInput(expense: ExpenseWithDetail): ExpenseInput {
  return {
    id: expense.id,
    payerId: expense.payer_id,
    amount: expense.amount_centavos,
    participants: expense.participants.map((p) => p.user_id),
    splitMode: 'exact',
    exactShares: Object.fromEntries(expense.participants.map((p) => [p.user_id, p.share_centavos])),
    deletedAt: expense.deleted_at,
  };
}

export function toSettlementInput(settlement: Settlement): SettlementInput {
  return {
    id: settlement.id,
    fromId: settlement.from_user_id,
    toId: settlement.to_user_id,
    amount: settlement.amount_centavos,
    status: settlement.status,
    deletedAt: settlement.deleted_at,
  };
}

export async function getMyGroups() {
  const supabase = await createClient();
  const me = await getCurrentUser();
  if (!me) return [];

  const { data } = await supabase
    .from('group_members')
    .select('role, group:groups(*)')
    .eq('user_id', me.id)
    .eq('status', 'active');

  const rows = (data ?? []) as unknown as Array<{ role: 'owner' | 'member'; group: Group | null }>;
  const groups = rows.map((r) => r.group).filter((g): g is Group => Boolean(g) && !g!.deleted_at);

  const summaries = await Promise.all(
    groups.map(async (group) => {
      const [{ data: balance }, { count }] = await Promise.all([
        supabase.rpc('my_group_balance', { gid: group.id }),
        supabase
          .from('group_members')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .eq('status', 'active'),
      ]);
      return { group, balance: Number(balance ?? 0), memberCount: count ?? 0 };
    }),
  );

  return summaries.sort((a, b) =>
    new Date(b.group.updated_at).getTime() - new Date(a.group.updated_at).getTime(),
  );
}

export async function getActivity(groupId: string, limit = 50): Promise<ActivityEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('activity_log')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as ActivityEntry[];
}

export interface RecentActivityEntry extends ActivityEntry {
  group: Pick<Group, 'id' | 'name' | 'avatar_url' | 'avatar_seed' | 'currency'>;
  actor: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null;
}

/**
 * Across every group the caller belongs to, not just one. No group_id
 * filter needed — activity_log's own RLS policy already scopes reads to
 * is_group_member(group_id), so this can't leak another group's rows.
 */
export async function getRecentActivity(limit = 8): Promise<RecentActivityEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('activity_log')
    .select('*, group:groups(id, name, avatar_url, avatar_seed, currency), actor:profiles(id, display_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as RecentActivityEntry[];
}
