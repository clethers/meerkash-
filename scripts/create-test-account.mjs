// One-off script: creates a confirmed auth account directly via the
// service-role admin API (bypasses the app's email-OTP signup flow),
// so it's ready to log into immediately.
//
// Run: node scripts/create-test-account.mjs <email> ["Display Name"]

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  const email = process.argv[2];
  const displayName = process.argv[3] ?? email?.split('@')[0];
  if (!email) throw new Error('Usage: node scripts/create-test-account.mjs <email> ["Display Name"]');

  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: existing } = await supabase.from('profiles').select('id, display_name').eq('email', email).maybeSingle();
  if (existing) {
    console.log(`Account already exists: ${existing.display_name} (${existing.id})`);
    return;
  }

  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  });
  if (error) throw error;

  console.log(`Created account: ${displayName} <${email}> (${created.user.id})`);
  console.log(`Log in at /login with this email — since it's confirmed, the OTP code goes straight to that inbox.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
