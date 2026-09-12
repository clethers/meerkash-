// One-off script: seeds dummy groups/expenses into the REMOTE Supabase
// project (whatever NEXT_PUBLIC_SUPABASE_URL in .env.local points to) so the
// "Your spending" personal dashboard (/settings/expenses) has real data to
// render. Uses the service-role key, which bypasses RLS entirely.
//
// Run: node scripts/seed-dashboard-dummy-data.mjs
// Undo: node scripts/cleanup-dashboard-dummy-data.mjs (reads the record this
// script writes to scripts/.dashboard-dummy-data.json)

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORD_PATH = path.join(__dirname, '.dashboard-dummy-data.json');

const TARGET_EMAIL = 'marxclethers@gmail.com';
const FRIEND_EMAIL = 'dashboard-test-friend@example.abonoshare.local';

function loadEnvLocal() {
  const text = readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function splitEqually(amount, participantIds) {
  const unique = [...new Set(participantIds)];
  const base = Math.floor(amount / unique.length);
  let remainder = amount - base * unique.length;
  const order = [...unique].sort();
  const shares = Object.fromEntries(unique.map((id) => [id, base]));
  for (const id of order) {
    if (remainder <= 0) break;
    shares[id] += 1;
    remainder -= 1;
  }
  return shares;
}

function monthsAgo(n, day = 10) {
  const d = new Date();
  d.setDate(1); // avoid day-overflow rolling into the wrong month
  d.setMonth(d.getMonth() - n);
  d.setDate(day);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');

  console.log(`Target project: ${url}`);

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: me, error: meError } = await supabase
    .from('profiles')
    .select('id, display_name, email')
    .eq('email', TARGET_EMAIL)
    .maybeSingle();
  if (meError) throw meError;
  if (!me) throw new Error(`No profile found for ${TARGET_EMAIL} — sign up with that email in the app first.`);
  console.log(`Found target profile: ${me.display_name} (${me.id})`);

  // Reuse the dummy friend account across runs instead of creating a new one every time.
  let friend = (
    await supabase.from('profiles').select('id, display_name').eq('email', FRIEND_EMAIL).maybeSingle()
  ).data;

  let createdFriendAuthUser = false;
  if (!friend) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: FRIEND_EMAIL,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { full_name: 'Dashboard Test Friend' },
    });
    if (createError) throw createError;
    createdFriendAuthUser = true;
    friend = { id: created.user.id, display_name: 'Dashboard Test Friend' };
    console.log(`Created dummy friend account: ${friend.id}`);
  } else {
    console.log(`Reusing existing dummy friend account: ${friend.id}`);
  }

  await supabase
    .from('friendships')
    .upsert(
      { user_a_id: [me.id, friend.id].sort()[0], user_b_id: [me.id, friend.id].sort()[1] },
      { onConflict: 'user_a_id,user_b_id' },
    );

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ name: 'Dashboard Test Trip', currency: 'PHP', owner_id: me.id, created_by: me.id })
    .select('id, name')
    .single();
  if (groupError) throw groupError;
  console.log(`Created group: ${group.name} (${group.id})`);

  const { error: membersError } = await supabase.from('group_members').insert([
    { group_id: group.id, user_id: me.id, role: 'owner', status: 'active' },
    { group_id: group.id, user_id: friend.id, role: 'member', status: 'active' },
  ]);
  if (membersError) throw membersError;

  // A spread of categories and months so the dashboard's category bars and
  // 6-month trend both have something to show, alternating payer so it
  // isn't just one person's spending.
  const groupExpenses = [
    { desc: 'Grocery run', amount: 185000, category: 'groceries', payer: me.id, monthsAgo: 0 },
    { desc: 'Grab rides', amount: 42000, category: 'transportation', payer: friend.id, monthsAgo: 0 },
    { desc: 'Dinner at Sentro', amount: 156000, category: 'food_dining', payer: me.id, monthsAgo: 1 },
    { desc: 'Movie night', amount: 90000, category: 'entertainment', payer: friend.id, monthsAgo: 1 },
    { desc: 'Condo electricity bill', amount: 320000, category: 'rent_utilities', payer: me.id, monthsAgo: 1 },
    { desc: 'Weekend groceries', amount: 210000, category: 'groceries', payer: friend.id, monthsAgo: 2 },
    { desc: 'Baguio trip gas + tolls', amount: 285000, category: 'travel', payer: me.id, monthsAgo: 2 },
    { desc: 'Shopee haul', amount: 134000, category: 'shopping', payer: friend.id, monthsAgo: 2 },
    { desc: 'Coworking day pass', amount: 60000, category: 'work', payer: me.id, monthsAgo: 3 },
    { desc: 'Brunch', amount: 98000, category: 'food_dining', payer: friend.id, monthsAgo: 3 },
    { desc: 'Internet bill', amount: 180000, category: 'rent_utilities', payer: me.id, monthsAgo: 3 },
    { desc: 'Taxi to airport', amount: 75000, category: 'transportation', payer: me.id, monthsAgo: 4 },
    { desc: 'Concert tickets', amount: 400000, category: 'entertainment', payer: friend.id, monthsAgo: 4 },
    { desc: 'Groceries', amount: 165000, category: 'groceries', payer: friend.id, monthsAgo: 4 },
    { desc: 'New headphones', amount: 249000, category: 'shopping', payer: me.id, monthsAgo: 5 },
    { desc: 'Beach house rental', amount: 600000, category: 'travel', payer: friend.id, monthsAgo: 5 },
    { desc: 'Pharmacy run', amount: 32000, category: 'other', payer: me.id, monthsAgo: 5 },
  ];

  let myGroupShareTotal = 0;
  for (const e of groupExpenses) {
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        group_id: group.id,
        description: e.desc,
        amount_centavos: e.amount,
        payer_id: e.payer,
        category: e.category,
        created_by: e.payer,
        created_at: monthsAgo(e.monthsAgo),
      })
      .select('id')
      .single();
    if (expenseError) throw expenseError;

    const shares = splitEqually(e.amount, [me.id, friend.id]);
    myGroupShareTotal += shares[me.id];
    const { error: participantsError } = await supabase.from('expense_participants').insert(
      Object.entries(shares).map(([user_id, share_centavos]) => ({ expense_id: expense.id, user_id, share_centavos })),
    );
    if (participantsError) throw participantsError;
  }
  console.log(`Inserted ${groupExpenses.length} group expenses (my share total: ₱${(myGroupShareTotal / 100).toFixed(2)})`);

  // One direct (groupless, group_id = null) friend expense — exercises the
  // getMyPersonalSpending() code path for expenses with no groups row.
  const directAmount = 68000;
  const { data: directExpense, error: directExpenseError } = await supabase
    .from('expenses')
    .insert({
      group_id: null,
      description: 'Split cab fare',
      amount_centavos: directAmount,
      payer_id: friend.id,
      category: 'transportation',
      created_by: friend.id,
      created_at: monthsAgo(0),
    })
    .select('id')
    .single();
  if (directExpenseError) throw directExpenseError;

  const directShares = splitEqually(directAmount, [me.id, friend.id]);
  const { error: directParticipantsError } = await supabase.from('expense_participants').insert(
    Object.entries(directShares).map(([user_id, share_centavos]) => ({ expense_id: directExpense.id, user_id, share_centavos })),
  );
  if (directParticipantsError) throw directParticipantsError;
  console.log(`Inserted 1 direct (groupless) expense (my share: ₱${(directShares[me.id] / 100).toFixed(2)})`);

  const record = {
    targetEmail: TARGET_EMAIL,
    meId: me.id,
    friendId: friend.id,
    createdFriendAuthUser,
    groupId: group.id,
    directExpenseId: directExpense.id,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(RECORD_PATH, JSON.stringify(record, null, 2));

  const myTotal = myGroupShareTotal + directShares[me.id];
  console.log('\nDone. Expected on /settings/expenses:');
  console.log(`  Total spent (all time): ₱${(myTotal / 100).toFixed(2)}`);
  console.log(`  Spent this month: ₱${((groupExpenses.filter((e) => e.monthsAgo === 0).reduce((s, e) => s + splitEqually(e.amount, [me.id, friend.id])[me.id], 0) + directShares[me.id]) / 100).toFixed(2)}`);
  console.log(`\nRecord written to ${RECORD_PATH} — run scripts/cleanup-dashboard-dummy-data.mjs to remove all of this.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
