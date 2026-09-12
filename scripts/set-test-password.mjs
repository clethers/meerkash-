// One-off script: sets a password on an existing account via the
// service-role admin API, so it can be logged into with the app's
// Password tab instead of relying on email delivery (OTP/magic link),
// which needs a verified sending domain to reach arbitrary recipients.
//
// Run: node scripts/set-test-password.mjs <email> [password]
// If password is omitted, a random one is generated and printed.

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
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

function randomPassword() {
  // 16 chars, URL-safe alphabet — easy to select/copy from a terminal, no quoting issues.
  return randomBytes(12).toString('base64url');
}

async function main() {
  const email = process.argv[2];
  const password = process.argv[3] ?? randomPassword();
  if (!email) throw new Error('Usage: node scripts/set-test-password.mjs <email> [password]');

  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: profile, error: lookupError } = await supabase
    .from('profiles').select('id, display_name').eq('email', email).maybeSingle();
  if (lookupError) throw lookupError;
  if (!profile) throw new Error(`No account found for ${email}.`);

  const { error } = await supabase.auth.admin.updateUserById(profile.id, { password });
  if (error) throw error;

  console.log(`Password set for ${profile.display_name} <${email}>:`);
  console.log(password);
  console.log(`\nLog in at /login with the Password tab.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
