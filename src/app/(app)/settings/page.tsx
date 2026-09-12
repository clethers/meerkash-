import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Receipt } from 'lucide-react';
import { DeleteAccountPanel, ProfileForm, SignOutButton } from '@/components/AccountSettings';
import { getCurrentUser } from '@/lib/data/groups';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Your account</h1>
        <SignOutButton />
      </div>

      <Link
        href="/settings/expenses"
        className="card flex items-center gap-3 p-4 transition-colors hover:border-brand-300"
      >
        <Receipt size={20} className="shrink-0 text-brand-500" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">Your spending</p>
          <p className="text-sm text-slate-500">Totals and trends across every group</p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-slate-300" />
      </Link>

      <ProfileForm
        displayName={me.display_name}
        avatarUrl={me.avatar_url}
        email={me.email}
        preferredCurrency={me.preferred_currency}
        paymentQrUrl={me.payment_qr_url}
      />

      <DeleteAccountPanel />
    </div>
  );
}
