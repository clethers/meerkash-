import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { splitEqually } from '@/lib/balance/split';

/**
 * Everything here talks to a REAL Supabase project — a dedicated one, never
 * the app's own dev/prod project (see tests/rls/README.md). There is no
 * mocking: RLS can only be proven by hitting real PostgREST / GoTrue /
 * Storage endpoints with real client sessions.
 *
 * Fixtures are never cleaned up — the schema is soft-delete-only, so hard
 * deletes here would need extra privileged surface area just for tests. Every
 * name/email carries a run-unique suffix via `unique()` instead, so tests
 * never depend on the project being empty.
 */

interface SupabaseTestConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

let cachedConfig: SupabaseTestConfig | null = null;

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Reads the dedicated test project's coordinates from `.env.test.local`
 * (gitignored, never committed). Deliberately its own file, not a fallback
 * onto `.env.local`'s app project — these tests create real throwaway users
 * and rows, and must never run against a project you actually use.
 */
export function getSupabaseTestConfig(): SupabaseTestConfig {
  if (cachedConfig) return cachedConfig;

  const env = parseEnvFile(resolve(process.cwd(), '.env.test.local'));
  const url = env.SUPABASE_TEST_URL;
  const anonKey = env.SUPABASE_TEST_ANON_KEY;
  const serviceRoleKey = env.SUPABASE_TEST_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_ROLE_KEY in .env.test.local — ' +
        'see tests/rls/README.md for how to set up a dedicated test project.',
    );
  }

  cachedConfig = { url, anonKey, serviceRoleKey };
  return cachedConfig;
}

let adminClient: SupabaseClient | null = null;

/** A memoized service-role client for privileged fixture seeding. Bypasses RLS entirely — this is setup, never the thing under test. */
export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;
  const { url, serviceRoleKey } = getSupabaseTestConfig();
  adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return adminClient;
}

/** A run-unique label, used in every fixture name/email so repeated runs never collide. */
export function unique(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/** Creates a real, pre-confirmed auth user via the GoTrue admin API. The `handle_new_user` trigger creates the matching `profiles` row. */
export async function createTestUser(namePrefix: string): Promise<TestUser> {
  const email = `${unique(namePrefix)}@abonoshare.test`;
  const password = 'Test-password-1!';
  const { data, error } = await getAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createTestUser(${namePrefix}) failed: ${error?.message}`);
  return { id: data.user.id, email, password };
}

/** Signs in as `user` with a fresh anon-key client — the exact session shape a browser gets. Every RLS assertion must go through the client this returns, never the admin client. */
export async function signInAs(user: TestUser): Promise<SupabaseClient> {
  const { url, anonKey } = getSupabaseTestConfig();
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`signInAs(${user.email}) failed: ${error.message}`);
  return client;
}

/** Seeds a group owned by `owner`. Group creation itself isn't under test here — it's privileged setup, like every other seed* helper. */
export async function seedGroupWithOwner(owner: TestUser, name: string): Promise<{ groupId: string }> {
  const admin = getAdminClient();
  const { data: group, error: groupError } = await admin
    .from('groups')
    .insert({ name, owner_id: owner.id, created_by: owner.id })
    .select('id')
    .single();
  if (groupError || !group) throw new Error(`seedGroupWithOwner failed: ${groupError?.message}`);

  const { error: memberError } = await admin
    .from('group_members')
    .insert({ group_id: group.id, user_id: owner.id, role: 'owner', status: 'active' });
  if (memberError) throw new Error(`seedGroupWithOwner (owner membership) failed: ${memberError.message}`);

  return { groupId: group.id as string };
}

/**
 * The RLS-exercising join path: the admin client seeds a synthetic invite
 * (someone has to originate the very first invite from outside the system
 * under test), then `inviteeClient`'s own signed-in session calls
 * `accept_invite()` via RPC — real RLS/RPC end-to-end for the join itself.
 */
export async function inviteAndJoin(
  groupId: string,
  inviteeClient: SupabaseClient,
  invitedByUserId: string,
): Promise<void> {
  const admin = getAdminClient();
  const { data: invite, error: inviteError } = await admin
    .from('group_invites')
    .insert({ group_id: groupId, created_by: invitedByUserId })
    .select('token')
    .single();
  if (inviteError || !invite) throw new Error(`inviteAndJoin (seed invite) failed: ${inviteError?.message}`);

  const { error: acceptError } = await inviteeClient.rpc('accept_invite', { invite_token: invite.token });
  if (acceptError) throw new Error(`inviteAndJoin (accept_invite) failed: ${acceptError.message}`);
}

/** Seeds an expense + its participant shares. Fixture data for read-access scenarios, not itself under test. */
export async function seedExpense(
  groupId: string,
  payerId: string,
  participants: string[],
  opts?: { amountCentavos?: number; description?: string },
): Promise<{ expenseId: string }> {
  const admin = getAdminClient();
  const amountCentavos = opts?.amountCentavos ?? 100000;
  const { data: expense, error: expenseError } = await admin
    .from('expenses')
    .insert({
      group_id: groupId,
      description: opts?.description ?? unique('expense'),
      amount_centavos: amountCentavos,
      payer_id: payerId,
      created_by: payerId,
    })
    .select('id')
    .single();
  if (expenseError || !expense) throw new Error(`seedExpense failed: ${expenseError?.message}`);

  const shares = splitEqually(amountCentavos, participants);
  const { error: participantsError } = await admin
    .from('expense_participants')
    .insert(
      Object.entries(shares).map(([userId, shareCentavos]) => ({
        expense_id: expense.id,
        user_id: userId,
        share_centavos: shareCentavos,
      })),
    );
  if (participantsError) throw new Error(`seedExpense (participants) failed: ${participantsError.message}`);

  return { expenseId: expense.id as string };
}

/** Seeds a settlement between two users in a group. */
export async function seedSettlement(
  groupId: string,
  fromUserId: string,
  toUserId: string,
  opts?: { amountCentavos?: number },
): Promise<{ settlementId: string }> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('settlements')
    .insert({
      group_id: groupId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount_centavos: opts?.amountCentavos ?? 50000,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`seedSettlement failed: ${error?.message}`);
  return { settlementId: data.id as string };
}

/**
 * Uploads a placeholder proof object at the conventional
 * `<settlementId>/<filename>` path. The settlement-proofs SELECT policy
 * (the one under test here) keys entirely off `settlements.from_user_id` /
 * `to_user_id`, not storage object ownership, so a service-role upload is a
 * faithful stand-in for a real payer upload as far as read access goes.
 */
export async function seedSettlementProof(settlementId: string): Promise<{ path: string }> {
  const admin = getAdminClient();
  const path = `${settlementId}/proof.png`;
  const placeholder = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
  const { error } = await admin.storage.from('settlement-proofs').upload(path, placeholder, {
    contentType: 'image/png',
  });
  if (error) throw new Error(`seedSettlementProof failed: ${error.message}`);
  return { path };
}
