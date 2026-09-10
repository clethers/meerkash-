'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from '@/lib/actions/auth';
import type { ActionResult } from '@/lib/actions/shared';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';

function GoogleButton({ next }: { next: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
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
      <span className="h-px flex-1 bg-slate-200" />
      <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [state, action] = useActionState<ActionResult | null, FormData>(signInWithEmail, null);

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="space-y-4">
      <GoogleButton next={next} />
      <Divider />
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
      <p className="text-center text-sm text-slate-600">
        New here?{' '}
        <Link href="/signup" className="font-medium text-brand-700 hover:underline">Create an account</Link>
      </p>
    </div>
  );
}

export function SignupForm({ next }: { next: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(signUpWithEmail, null);

  return (
    <div className="space-y-4">
      <GoogleButton next={next} />
      <Divider />
      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" name="name" required minLength={2} autoComplete="name" className="input mt-1.5" placeholder="Clethers" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input mt-1.5" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="input mt-1.5" />
          <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
        </div>
        {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state?.ok ? <Alert tone="success">{String(state.data?.message ?? 'Account created.')}</Alert> : null}
        <SubmitButton className="w-full" pendingLabel="Creating account…">Create account</SubmitButton>
      </form>
      <p className="text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
