// Diagnostic: signs in as a real user (not service role) and attempts the
// exact upload the app does, to test whether the payment-qr RLS policies
// actually let an authenticated user write their own QR image.
//
// Run: node scripts/diagnose-qr-rls.mjs <email> <password>

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
  const [email, password] = process.argv.slice(2);
  if (!email || !password) throw new Error('Usage: node scripts/diagnose-qr-rls.mjs <email> <password>');

  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Sign-in failed: ${signInError.message}`);
  console.log(`Signed in as ${email} (${signIn.user.id})`);

  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const testPath = `users/${signIn.user.id}/${Date.now()}.png`;

  console.log(`Attempting upload to payment-qr/${testPath} as this user...`);
  const { error: uploadError } = await supabase.storage
    .from('payment-qr')
    .upload(testPath, tinyPng, { contentType: 'image/png', upsert: true });

  if (uploadError) {
    console.log(`UPLOAD FAILED: ${uploadError.message}`);
    console.log(JSON.stringify(uploadError, null, 2));
  } else {
    console.log('UPLOAD SUCCEEDED as authenticated user — RLS is not the problem.');
    const { data: pub } = supabase.storage.from('payment-qr').getPublicUrl(testPath);
    console.log(`Public URL: ${pub.publicUrl}`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
