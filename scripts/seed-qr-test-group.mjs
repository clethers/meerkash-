// One-off script: puts two accounts in a shared group with one expense, so
// there's an outstanding balance to exercise the settle-up QR-code flow.
//
// Run: node scripts/seed-qr-test-group.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EMAIL_A = 'marxclethers@gmail.com';
const EMAIL_B = 'clederamarkx@gmail.com';

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

async function main() {
  const env = loadEnvLocal();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: a } = await supabase.from('profiles').select('id, display_name').eq('email', EMAIL_A).maybeSingle();
  const { data: b } = await supabase.from('profiles').select('id, display_name').eq('email', EMAIL_B).maybeSingle();
  if (!a) throw new Error(`No account found for ${EMAIL_A}`);
  if (!b) throw new Error(`No account found for ${EMAIL_B}`);

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ name: 'QR Test Group', currency: 'PHP', owner_id: a.id, created_by: a.id })
    .select('id, name')
    .single();
  if (groupError) throw groupError;
  console.log(`Created group "${group.name}" (${group.id})`);

  const { error: membersError } = await supabase.from('group_members').insert([
    { group_id: group.id, user_id: a.id, role: 'owner', status: 'active' },
    { group_id: group.id, user_id: b.id, role: 'member', status: 'active' },
  ]);
  if (membersError) throw membersError;
  console.log(`Added ${a.display_name} (owner) and ${b.display_name} (member)`);

  // A paid, split equally — B ends up owing A half, so B can settle up
  // with A and see A's QR code on the settle-up screen.
  const amount = 100000; // ₱1,000.00
  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .insert({
      group_id: group.id,
      description: 'QR settle-up test expense',
      amount_centavos: amount,
      payer_id: a.id,
      category: 'other',
      created_by: a.id,
    })
    .select('id')
    .single();
  if (expenseError) throw expenseError;

  const half = amount / 2;
  const { error: participantsError } = await supabase.from('expense_participants').insert([
    { expense_id: expense.id, user_id: a.id, share_centavos: half },
    { expense_id: expense.id, user_id: b.id, share_centavos: half },
  ]);
  if (participantsError) throw participantsError;

  console.log(`\nDone. ${b.display_name} owes ${a.display_name} ₱${(half / 100).toFixed(2)} in "${group.name}".`);
  console.log(`Log in as ${EMAIL_B} and go to that group's settle-up screen to test the QR toggle.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
