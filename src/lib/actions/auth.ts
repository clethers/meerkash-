'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { uploadAvatar } from '@/lib/storage';
import { CURRENCY_CODES } from '@/lib/constants';
import type { CurrencyCode } from '@/types/db';
import { fail, ok, readableError, type ActionResult } from './shared';

function siteOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Shared by both signup paths (password and OTP): format-check, then a
 * fresh server-side availability check (defense against a stale client-side
 * check — the RPC is also what the client polls while the user types).
 */
async function validateSignupUsername(
  supabase: SupabaseServerClient,
  username: string,
): Promise<{ error: string } | { error: null }> {
  if (!USERNAME_PATTERN.test(username)) {
    return { error: 'Username must be 3-20 characters: lowercase letters, numbers, and underscores.' };
  }

  const { data: available, error: availabilityError } = await supabase.rpc('is_username_available', {
    check_username: username,
  });
  if (availabilityError) return { error: readableError(availabilityError, 'Could not verify username availability.') };
  if (!available) return { error: 'That username is already taken.' };

  return { error: null };
}

export async function signUpWithEmail(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const username = String(formData.get('username') ?? '').trim().toLowerCase();

  if (name.length < 2) return fail('Please enter your name.');
  if (!email.includes('@')) return fail('Please enter a valid email address.');
  if (password.length < 8) return fail('Password must be at least 8 characters.');

  const supabase = await createClient();

  const usernameCheck = await validateSignupUsername(supabase, username);
  if (usernameCheck.error) return fail(usernameCheck.error);

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name, username },
      emailRedirectTo: `${siteOrigin()}/auth/callback`,
    },
  });

  if (error) {
    if (/username/i.test(error.message)) return fail('That username was just taken — try another.');
    return fail(readableError(error, 'We could not create your account.'));
  }
  return ok({ message: 'Check your inbox to confirm your email, then sign in.' });
}

/**
 * OTP-based signup, step 1: collect name/email/username (no password), send
 * a 6-digit code. Verification reuses `verifyEmailOtp` below — Supabase
 * treats "verify a code for an email that doesn't have an account yet" and
 * "verify a code for an existing account" identically once the code is
 * requested with `shouldCreateUser: true`.
 */
export async function requestSignupOtp(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const username = String(formData.get('username') ?? '').trim().toLowerCase();
  const next = String(formData.get('next') ?? '/groups');

  if (name.length < 2) return fail('Please enter your name.');
  if (!email.includes('@')) return fail('Please enter a valid email address.');

  const supabase = await createClient();

  const usernameCheck = await validateSignupUsername(supabase, username);
  if (usernameCheck.error) return fail(usernameCheck.error);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: { full_name: name, username },
    },
  });

  if (error) return fail(readableError(error, 'We could not send a code. Please try again.'));
  return ok({ email, next });
}

export async function signInWithEmail(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/groups');

  if (!email || !password) return fail('Enter your email and password.');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail('That email and password do not match an account.');

  revalidatePath('/', 'layout');
  return ok(undefined, next.startsWith('/') ? next : '/groups');
}

export async function requestEmailOtp(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim();
  const next = String(formData.get('next') ?? '/groups');

  if (!email.includes('@')) return fail('Please enter a valid email address.');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) return fail(readableError(error, 'We could not send a code. Please try again.'));
  return ok({ email, next });
}

export async function verifyEmailOtp(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const next = String(formData.get('next') ?? '/groups');

  if (!email.includes('@')) return fail('Please enter a valid email address.');
  if (!/^\d{6}$/.test(token)) return fail('Enter the 6-digit code from your email.');

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) return fail(readableError(error, 'That code is invalid or has expired.'));

  revalidatePath('/', 'layout');
  return ok(undefined, next.startsWith('/') ? next : '/groups');
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = String(formData.get('next') ?? '/groups');
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });

  if (error || !data?.url) redirect('/login?error=google');
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function updateProfile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get('display_name') ?? '').trim();
  let avatarUrl = String(formData.get('avatar_url') ?? '').trim();
  if (name.length < 2) return fail('Please enter a name with at least 2 characters.');

  const preferredCurrencyRaw = String(formData.get('preferred_currency') ?? '').trim();
  if (preferredCurrencyRaw && !CURRENCY_CODES.includes(preferredCurrencyRaw as CurrencyCode)) {
    return fail('Please choose a valid preferred currency.');
  }
  const preferredCurrency: CurrencyCode | null = preferredCurrencyRaw
    ? (preferredCurrencyRaw as CurrencyCode)
    : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const upload = await uploadAvatar(supabase, 'users', user.id, formData.get('avatar') as File | null);
  if (upload && 'error' in upload) return fail(upload.error);
  if (upload) avatarUrl = upload.url;

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name, avatar_url: avatarUrl || null, preferred_currency: preferredCurrency })
    .eq('id', user.id);

  if (error) return fail(readableError(error, 'Could not save your profile.'));
  revalidatePath('/', 'layout');
  return ok({ message: 'Profile saved.' });
}

export async function deleteAccount(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_my_account');
  if (error) return fail(readableError(error, 'Could not delete your account.'));
  await supabase.auth.signOut();
  return ok(undefined, '/');
}
