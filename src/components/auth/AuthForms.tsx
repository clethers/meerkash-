'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import {
  requestPasswordReset,
  signInWithEmail,
  signUpWithEmail,
  updatePassword,
} from '@/lib/actions/auth';
import type { ActionResult } from '@/lib/actions/shared';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { PasswordField } from './PasswordField';
import { UsernameField } from './UsernameField';
import { suggestEmailCorrection } from '@/lib/signup/emailSuggest';

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(signInWithEmail, null);

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      // A full navigation, not router.push — the client router cache can
      // still be holding the pre-login (logged-out) RSC payload for this
      // URL, which bounces straight back to /login. A hard load always
      // fetches fresh with the new session cookie.
      window.location.href = state.redirectTo;
    }
  }, [state]);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input mt-1.5" />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="password">Password</label>
            <Link href="/forgot-password" className="text-xs font-medium text-brand-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input mt-1.5" />
        </div>
        {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
        <SubmitButton className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
      </form>
      <p className="text-center text-sm text-slate-600 dark:text-slate-300">
        New here?{' '}
        <Link href="/signup" className="font-medium text-brand-700 hover:underline">Create an account</Link>
      </p>
    </div>
  );
}

export function SignupForm({ next }: { next: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(signUpWithEmail, null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const emailSuggestion = suggestEmailCorrection(email);

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      window.location.href = state.redirectTo;
    }
  }, [state]);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="name" value={username} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input mt-1.5"
          />
          {emailSuggestion ? (
            <p className="mt-1 text-xs text-slate-500">
              Did you mean{' '}
              <button
                type="button"
                onClick={() => setEmail(emailSuggestion)}
                className="font-medium text-brand-700 hover:underline"
              >
                {emailSuggestion}
              </button>
              ?
            </p>
          ) : null}
        </div>
        <UsernameField value={username} onChange={setUsername} />
        <PasswordField value={password} onChange={setPassword} />
        {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state?.ok && !state.redirectTo ? (
          <Alert tone="success">{String(state.data?.message ?? 'Account created.')}</Alert>
        ) : null}
        <SubmitButton className="w-full" pendingLabel="Creating account…">Create account</SubmitButton>
      </form>
      <p className="text-center text-sm text-slate-600 dark:text-slate-300">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(requestPasswordReset, null);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input mt-1.5" />
        </div>
        {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state?.ok ? <Alert tone="success">{String(state.data?.message)}</Alert> : null}
        <SubmitButton className="w-full" pendingLabel="Sending link…">Send reset link</SubmitButton>
      </form>
      <p className="text-center text-sm text-slate-600 dark:text-slate-300">
        <Link href="/login" className="font-medium text-brand-700 hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(updatePassword, null);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      window.location.href = state.redirectTo;
    }
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <PasswordField value={password} onChange={setPassword} />
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      <SubmitButton className="w-full" pendingLabel="Saving…">Set new password</SubmitButton>
    </form>
  );
}
