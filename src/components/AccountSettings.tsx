'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useState, useTransition } from 'react';
import { LogOut } from 'lucide-react';
import { deleteAccount, signOut, updateProfile } from '@/lib/actions/auth';
import type { ActionResult } from '@/lib/actions/shared';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { CURRENCIES } from '@/lib/constants';
import type { CurrencyCode } from '@/types/db';

export function ProfileForm({
  displayName,
  avatarUrl,
  email,
  preferredCurrency,
  paymentQrUrl,
}: {
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  preferredCurrency: CurrencyCode | null;
  paymentQrUrl: string | null;
}) {
  const router = useRouter();
  const [state, action] = useActionState<ActionResult | null, FormData>(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await updateProfile(prev, formData);
      if (result.ok) router.refresh();
      return result;
    },
    null,
  );

  return (
    <form action={action} className="card space-y-4 p-5">
      <div className="flex items-center gap-3">
        <Avatar name={displayName} src={avatarUrl} size={52} />
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-slate-50">{displayName}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{email ?? 'No email on file'}</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="display_name">Your name</label>
        <input
          id="display_name"
          name="display_name"
          defaultValue={displayName}
          required
          minLength={2}
          maxLength={60}
          className="input mt-1.5"
        />
      </div>

      <div>
        <label className="label" htmlFor="avatar">Profile picture</label>
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="mt-1.5 block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-white/15"
        />
        <input type="hidden" name="avatar_url" value={avatarUrl ?? ''} />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          PNG, JPEG, WebP or GIF up to 2 MB. Upload nothing to keep your initials avatar.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="payment_qr">Payment QR code</label>
        {paymentQrUrl ? (
          <img
            src={paymentQrUrl}
            alt="Your payment QR code"
            className="mt-1.5 mb-2 h-28 w-28 rounded-lg border border-slate-200 dark:border-white/15 object-contain"
          />
        ) : null}
        <input
          id="payment_qr"
          name="payment_qr"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="mt-1.5 block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-white/15"
        />
        <input type="hidden" name="payment_qr_url" value={paymentQrUrl ?? ''} />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {paymentQrUrl
            ? 'Shown to friends when they choose to pay you by QR code during settle-up.'
            : 'Add your InstaPay, GCash, or bank QR so friends can scan it to pay you back.'}
        </p>
      </div>

      <div>
        <label className="label" htmlFor="preferred_currency">Preferred currency</label>
        <select
          id="preferred_currency"
          name="preferred_currency"
          defaultValue={preferredCurrency ?? ''}
          className="input mt-1.5"
        >
          <option value="">No preference</option>
          {CURRENCIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label} ({c.value})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Shows an approximate converted total on your groups page. Expenses always stay in each
          group&apos;s own currency.
        </p>
      </div>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">{String(state.data?.message ?? 'Saved.')}</Alert> : null}

      <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="secondary">
        <LogOut size={15} /> Sign out
      </Button>
    </form>
  );
}

/** Requirement 31: soft delete + anonymise, so group history stays meaningful. */
export function DeleteAccountPanel() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <div className="card space-y-3 p-5">
        <p className="font-medium text-slate-900 dark:text-slate-50">Delete your account</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your personal details are removed and you lose access. The expenses and settlements you
          were part of stay in their groups so everyone else&apos;s balances still make sense.
        </p>
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Delete my account
        </Button>
      </div>
    );
  }

  return (
    <div className="card space-y-3 border-rose-200 dark:border-rose-500/30 p-5">
      <p className="font-medium text-rose-900 dark:text-rose-300">This cannot be undone</p>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        You must be settled up in every group first. Type <strong>DELETE</strong> to confirm.
      </p>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="input"
        placeholder="DELETE"
        aria-label="Type DELETE to confirm"
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex gap-2">
        <Button
          variant="danger"
          disabled={text !== 'DELETE' || pending}
          onClick={() =>
            start(async () => {
              const result = await deleteAccount();
              if (result.ok) router.push(result.redirectTo ?? '/');
              else setError(result.error ?? 'Could not delete your account.');
            })
          }
        >
          {pending ? 'Deleting…' : 'Permanently delete'}
        </Button>
        <Button variant="secondary" onClick={() => { setConfirming(false); setText(''); }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
