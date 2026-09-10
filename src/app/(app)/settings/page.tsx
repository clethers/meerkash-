import { redirect } from 'next/navigation';
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

      <ProfileForm
        displayName={me.display_name}
        avatarUrl={me.avatar_url}
        email={me.email}
        preferredCurrency={me.preferred_currency}
      />

      <DeleteAccountPanel />
    </div>
  );
}
