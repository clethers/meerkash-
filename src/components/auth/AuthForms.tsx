'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import {
  requestEmailOtp,
  requestSignupOtp,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  verifyEmailOtp,
} from '@/lib/actions/auth';
import type { ActionResult } from '@/lib/actions/shared';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { OtpTokenInput } from './OtpTokenInput';
import { PasswordField } from './PasswordField';
import { UsernameField } from './UsernameField';
import { suggestEmailCorrection } from '@/lib/signup/emailSuggest';

const RESEND_COOLDOWN_SECONDS = 30;

function GoogleButton({ next }: { next: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-brand-950 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z" />
          <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
        </svg>
        Continue with Google
      </button>
    </form>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
      <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">or</span>
      <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
    </div>
  );
}

function PasswordForm({ next }: { next: string }) {
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
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input mt-1.5" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input mt-1.5" />
      </div>
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      <SubmitButton className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

/**
 * Step 2 shared by every OTP flow (login and signup): enter the code, or
 * resend it. `extraFields` carries whatever the request action needs beyond
 * email/next on a resend — signup's `requestSignupOtp` also needs
 * name/username to re-validate and re-attach on every send.
 */
function OtpCodeStep({
  email,
  next,
  requestAction,
  verifyAction,
  verifyState,
  cooldown,
  extraFields,
  onUseDifferentEmail,
}: {
  email: string;
  next: string;
  requestAction: (formData: FormData) => void;
  verifyAction: (formData: FormData) => void;
  verifyState: ActionResult | null;
  cooldown: number;
  extraFields?: Record<string, string>;
  onUseDifferentEmail: () => void;
}) {
  return (
    <div className="space-y-4">
      <form action={verifyAction} className="space-y-4">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="label">6-digit code</label>
          <p className="mt-1 text-sm text-slate-600">Sent to {email}.</p>
          <OtpTokenInput />
        </div>
        {verifyState?.error ? <Alert tone="error">{verifyState.error}</Alert> : null}
        <SubmitButton className="w-full" pendingLabel="Verifying…">Verify and continue</SubmitButton>
      </form>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onUseDifferentEmail}
          className="font-medium text-slate-600 hover:underline"
        >
          Use a different email
        </button>
        <form action={requestAction}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          {extraFields
            ? Object.entries(extraFields).map(([fieldName, value]) => (
                <input key={fieldName} type="hidden" name={fieldName} value={value} />
              ))
            : null}
          <button
            type="submit"
            disabled={cooldown > 0}
            className="font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
          >
            {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
          </button>
        </form>
      </div>
    </div>
  );
}

function EmailOtpForm({ next }: { next: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [requestState, requestAction] = useActionState<ActionResult | null, FormData>(requestEmailOtp, null);
  const [verifyState, verifyAction] = useActionState<ActionResult | null, FormData>(verifyEmailOtp, null);

  useEffect(() => {
    if (requestState?.ok) {
      setEmail(String(requestState.data?.email ?? ''));
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }, [requestState]);

  useEffect(() => {
    if (verifyState?.ok && verifyState.redirectTo) {
      window.location.href = verifyState.redirectTo;
    }
  }, [verifyState]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  if (!email) {
    return (
      <form action={requestAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="label" htmlFor="otp-email">Email</label>
          <input id="otp-email" name="email" type="email" autoComplete="email" required className="input mt-1.5" />
        </div>
        {requestState?.error ? <Alert tone="error">{requestState.error}</Alert> : null}
        <SubmitButton className="w-full" pendingLabel="Sending code…">Send code</SubmitButton>
      </form>
    );
  }

  return (
    <OtpCodeStep
      email={email}
      next={next}
      requestAction={requestAction}
      verifyAction={verifyAction}
      verifyState={verifyState}
      cooldown={cooldown}
      onUseDifferentEmail={() => setEmail(null)}
    />
  );
}

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<'password' | 'otp'>('otp');

  return (
    <div className="space-y-4">
      <GoogleButton next={next} />
      <Divider />
      <div className="flex rounded-xl bg-slate-100 dark:bg-white/6 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode('password')}
          className={`flex-1 rounded-lg py-1.5 transition-colors ${mode === 'password' ? 'bg-white dark:bg-white/12 text-slate-900 dark:text-slate-50 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode('otp')}
          className={`flex-1 rounded-lg py-1.5 transition-colors ${mode === 'otp' ? 'bg-white dark:bg-white/12 text-slate-900 dark:text-slate-50 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
        >
          Email code
        </button>
      </div>
      <div key={mode} className="page-enter">
        {mode === 'password' ? <PasswordForm next={next} /> : <EmailOtpForm next={next} />}
      </div>
      <p className="text-center text-sm text-slate-600 dark:text-slate-300">
        New here?{' '}
        <Link href="/signup" className="font-medium text-brand-700 hover:underline">Create an account</Link>
      </p>
    </div>
  );
}

/** Shared by both signup paths' step 1: name + email (with typo suggestion) + username. */
function NameEmailUsernameFields({
  name,
  onNameChange,
  email,
  onEmailChange,
  username,
  onUsernameChange,
}: {
  name: string;
  onNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  username: string;
  onUsernameChange: (value: string) => void;
}) {
  const emailSuggestion = suggestEmailCorrection(email);

  return (
    <>
      <div>
        <label className="label" htmlFor="name">Your name</label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          autoComplete="name"
          className="input mt-1.5"
          placeholder="Clethers"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          className="input mt-1.5"
        />
        {emailSuggestion ? (
          <p className="mt-1 text-xs text-slate-500">
            Did you mean{' '}
            <button
              type="button"
              onClick={() => onEmailChange(emailSuggestion)}
              className="font-medium text-brand-700 hover:underline"
            >
              {emailSuggestion}
            </button>
            ?
          </p>
        ) : null}
      </div>
      <UsernameField value={username} onChange={onUsernameChange} />
    </>
  );
}

function PasswordSignupForm({ next }: { next: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(signUpWithEmail, null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  return (
    <form action={action} className="space-y-4">
      <NameEmailUsernameFields
        name={name}
        onNameChange={setName}
        email={email}
        onEmailChange={setEmail}
        username={username}
        onUsernameChange={setUsername}
      />
      <PasswordField value={password} onChange={setPassword} />
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">{String(state.data?.message ?? 'Account created.')}</Alert> : null}
      <SubmitButton className="w-full" pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}

function OtpSignupForm({ next }: { next: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [username, setUsername] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [requestState, requestAction] = useActionState<ActionResult | null, FormData>(requestSignupOtp, null);
  const [verifyState, verifyAction] = useActionState<ActionResult | null, FormData>(verifyEmailOtp, null);

  useEffect(() => {
    if (requestState?.ok) {
      setEmail(String(requestState.data?.email ?? ''));
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }, [requestState]);

  useEffect(() => {
    if (verifyState?.ok && verifyState.redirectTo) {
      window.location.href = verifyState.redirectTo;
    }
  }, [verifyState]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  if (email) {
    return (
      <OtpCodeStep
        email={email}
        next={next}
        requestAction={requestAction}
        verifyAction={verifyAction}
        verifyState={verifyState}
        cooldown={cooldown}
        extraFields={{ name, username }}
        onUseDifferentEmail={() => setEmail(null)}
      />
    );
  }

  return (
    <form action={requestAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <NameEmailUsernameFields
        name={name}
        onNameChange={setName}
        email={pendingEmail}
        onEmailChange={setPendingEmail}
        username={username}
        onUsernameChange={setUsername}
      />
      {requestState?.error ? <Alert tone="error">{requestState.error}</Alert> : null}
      <SubmitButton className="w-full" pendingLabel="Sending code…">Send code</SubmitButton>
    </form>
  );
}

export function SignupForm({ next }: { next: string }) {
  const [mode, setMode] = useState<'otp' | 'password'>('otp');

  return (
    <div className="space-y-4">
      <GoogleButton next={next} />
      <Divider />
      <div className="flex rounded-xl bg-slate-100 dark:bg-white/6 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode('password')}
          className={`flex-1 rounded-lg py-1.5 transition-colors ${mode === 'password' ? 'bg-white dark:bg-white/12 text-slate-900 dark:text-slate-50 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode('otp')}
          className={`flex-1 rounded-lg py-1.5 transition-colors ${mode === 'otp' ? 'bg-white dark:bg-white/12 text-slate-900 dark:text-slate-50 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
        >
          Email code
        </button>
      </div>
      <div key={mode} className="page-enter">
        {mode === 'otp' ? <OtpSignupForm next={next} /> : <PasswordSignupForm next={next} />}
      </div>
      <p className="text-center text-sm text-slate-600 dark:text-slate-300">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
