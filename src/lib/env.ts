/**
 * A first `npm run dev` before .env.local exists should explain itself, not
 * throw a stack trace at the person. Everything Supabase-shaped checks this
 * first and the app renders a setup screen instead of crashing.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured =
  SUPABASE_URL.startsWith('http') &&
  !SUPABASE_URL.includes('YOUR_PROJECT_REF') &&
  SUPABASE_ANON_KEY.length > 20;
