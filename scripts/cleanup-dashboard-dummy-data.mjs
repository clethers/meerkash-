// Undoes scripts/seed-dashboard-dummy-data.mjs: deletes the dummy group
// (cascades its members/expenses/participants), the direct expense, the
// friendship row, and the dummy friend auth user (cascades its profile) —
// using the record that script wrote to .dashboard-dummy-data.json.
//
// Run: node scripts/cleanup-dashboard-dummy-data.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORD_PATH = path.join(__dirname, '.dashboard-dummy-data.json');

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
  const record = JSON.parse(readFileSync(RECORD_PATH, 'utf8'));
  const env = loadEnvLocal();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Cleaning up dummy data for ${record.targetEmail}...`);

  const { error: groupError } = await supabase.from('groups').delete().eq('id', record.groupId);
  if (groupError) throw groupError;
  console.log(`Deleted group ${record.groupId} (cascaded members + expenses + participants)`);

  const { error: directError } = await supabase.from('expenses').delete().eq('id', record.directExpenseId);
  if (directError) throw directError;
  console.log(`Deleted direct expense ${record.directExpenseId} (cascaded participants)`);

  const [userA, userB] = [record.meId, record.friendId].sort();
  const { error: friendshipError } = await supabase
    .from('friendships')
    .delete()
    .eq('user_a_id', userA)
    .eq('user_b_id', userB);
  if (friendshipError) throw friendshipError;
  console.log('Deleted friendship row');

  if (record.createdFriendAuthUser) {
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(record.friendId);
    if (deleteUserError) throw deleteUserError;
    console.log(`Deleted dummy friend auth user ${record.friendId} (cascaded profile)`);
  } else {
    console.log('Dummy friend account pre-existed a run — leaving it in place.');
  }

  unlinkSync(RECORD_PATH);
  console.log('\nDone. marxclethers@gmail.com is back to its original state.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
