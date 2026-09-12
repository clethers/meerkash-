import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, type RecentActivityEntry } from '@/lib/data/groups';
import { describeActivity } from '@/lib/activity';
import type { Group, Profile } from '@/types/db';

const RESULT_LIMIT = 8;
// Activity has no free-text column to filter server-side (action is a fixed
// code, metadata is jsonb) — scan a bounded window of recent rows and match
// against the same human-readable text the activity feed already renders.
const ACTIVITY_SCAN_LIMIT = 200;

export interface ExpenseSearchResult {
  id: string;
  description: string;
  amount_centavos: number;
  created_at: string;
  group: Pick<Group, 'id' | 'name' | 'currency'>;
}

export interface SearchResults {
  groups: Group[];
  friends: Profile[];
  expenses: ExpenseSearchResult[];
  activity: RecentActivityEntry[];
}

const EMPTY: SearchResults = { groups: [], friends: [], expenses: [], activity: [] };

export async function globalSearch(query: string): Promise<SearchResults> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return EMPTY;

  const me = await getCurrentUser();
  if (!me) return EMPTY;

  const supabase = await createClient();
  const needle = trimmed.toLowerCase();
  const pattern = `%${trimmed}%`;

  const [groupRows, friendRows, expenseRows, activityRows] = await Promise.all([
    supabase
      .from('group_members')
      .select('group:groups(*)')
      .eq('user_id', me.id)
      .eq('status', 'active'),
    supabase
      .from('friendships')
      .select('user_a_id, user_b_id')
      .or(`user_a_id.eq.${me.id},user_b_id.eq.${me.id}`),
    supabase
      .from('expenses')
      .select('id, description, amount_centavos, created_at, group:groups(id, name, currency)')
      .ilike('description', pattern)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(RESULT_LIMIT),
    supabase
      .from('activity_log')
      .select('*, group:groups(id, name, avatar_url, avatar_seed, currency), actor:profiles(id, display_name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_SCAN_LIMIT),
  ]);

  const groups = ((groupRows.data ?? []) as unknown as Array<{ group: Group | null }>)
    .map((r) => r.group)
    .filter((g): g is Group => g !== null && !g.deleted_at && g.name.toLowerCase().includes(needle))
    .slice(0, RESULT_LIMIT);

  const friendIds = ((friendRows.data ?? []) as Array<{ user_a_id: string; user_b_id: string }>)
    .map((r) => (r.user_a_id === me.id ? r.user_b_id : r.user_a_id));

  let friends: Profile[] = [];
  if (friendIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', friendIds);
    friends = ((profiles ?? []) as Profile[])
      .filter((p) => p.display_name.toLowerCase().includes(needle) || (p.email ?? '').toLowerCase().includes(needle))
      .slice(0, RESULT_LIMIT);
  }

  const expenses = (expenseRows.data ?? []) as unknown as ExpenseSearchResult[];

  const activityEntries = (activityRows.data ?? []) as unknown as RecentActivityEntry[];
  const activity = activityEntries
    .filter((entry) => {
      const nameOf = (id: string) =>
        id === entry.actor_id ? (entry.actor?.display_name ?? 'Someone') : 'Someone';
      return describeActivity(entry, nameOf, entry.group.currency).toLowerCase().includes(needle);
    })
    .slice(0, RESULT_LIMIT);

  return { groups, friends, expenses, activity };
}
