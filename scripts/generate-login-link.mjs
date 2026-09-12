// One-off script: generates a valid magic-link/OTP for an existing account
// via the service-role admin API, bypassing Supabase's own mailer entirely.
// Useful when the project's configured email provider is failing or
// rate-limited (e.g. "Error sending magic link email" / "Error sending
// confirmation email") and you just need to get logged in to test something.
//
// Run: node scripts/generate-login-link.mjs <email>

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
  if (!email) throw new Error('Usage: node scripts/generate-login-link.mjs <email>');

  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (error) throw error;

  console.log(`OTP code (type this into the login form): ${data.properties.email_otp}`);
  console.log(`\nOr open this link directly in the browser you're testing with:\n${data.properties.action_link}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
