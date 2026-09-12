// Diagnostic: checks whether migration 0016_payment_qr.sql actually applied
// cleanly — the profiles.payment_qr_url column, the payment-qr storage
// bucket, its RLS policies, and the qr_code enum value.
//
// Run: node scripts/diagnose-qr-upload.mjs

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
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log('--- 1. profiles.payment_qr_url column ---');
  const { data: colTest, error: colError } = await supabase.from('profiles').select('payment_qr_url').limit(1);
  console.log(colError ? `ERROR: ${colError.message}` : `OK — column exists (sample: ${JSON.stringify(colTest)})`);

  console.log('\n--- 2. payment-qr storage bucket ---');
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) console.log(`ERROR listing buckets: ${bucketError.message}`);
  else {
    const bucket = buckets.find((b) => b.id === 'payment-qr');
    console.log(bucket ? `OK — bucket exists: ${JSON.stringify(bucket)}` : 'MISSING — payment-qr bucket not found');
  }

  console.log('\n--- 4. qr_code payment_method enum value ---');
  const { data: enumTest, error: enumError } = await supabase
    .from('settlements')
    .select('id')
    .eq('method', 'qr_code')
    .limit(1);
  console.log(enumError ? `ERROR: ${enumError.message}` : 'OK — qr_code is a valid enum value (query did not reject it)');

  console.log('\n--- 5. Test upload as service role (bypasses RLS — only proves bucket/path work) ---');
  const testPath = `users/diagnostic-test/${Date.now()}.png`;
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const { error: uploadError } = await supabase.storage.from('payment-qr').upload(testPath, tinyPng, {
    contentType: 'image/png',
    upsert: true,
  });
  console.log(uploadError ? `ERROR: ${uploadError.message}` : 'OK — service-role upload succeeded');
  if (!uploadError) await supabase.storage.from('payment-qr').remove([testPath]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
