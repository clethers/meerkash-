import Link from 'next/link';
import Image from 'next/image';
import { JoinGroupButton } from '@/components/JoinGroupButton';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/data/groups';
import type { InvitePreview } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getCurrentUser();

  if (!me) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-slate-900">You&apos;ve been invited</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in or create an account to see the group and join it.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <ButtonLink href={`/login?next=/join/${token}`} size="lg">Sign in</ButtonLink>
          <ButtonLink href={`/signup?next=/join/${token}`} variant="secondary" size="lg">
            Create an account
          </ButtonLink>
        </div>
      </Shell>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc('preview_invite', { invite_token: token });
  const preview = (Array.isArray(data) ? data[0] : data) as InvitePreview | undefined;

  if (!preview || !preview.group_name) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-slate-900">This invitation isn&apos;t valid</h1>
        <p className="mt-2 text-sm text-slate-600">
          {preview?.reason ?? 'Ask whoever invited you to send a fresh link.'}
        </p>
        <ButtonLink href="/groups" variant="secondary" className="mt-5 w-full">
          Go to your groups
        </ButtonLink>
      </Shell>
    );
  }

  if (preview.already_member) {
    return (
      <Shell>
        <Avatar
          name={preview.group_name}
          src={preview.avatar_url}
          seed={preview.avatar_seed ?? preview.group_name}
          size={56}
          className="mx-auto"
        />
        <h1 className="mt-4 text-xl font-semibold text-slate-900">
          You&apos;re already in {preview.group_name}
        </h1>
        <ButtonLink href={`/groups/${preview.group_id}`} className="mt-5 w-full" size="lg">
          Open the group
        </ButtonLink>
      </Shell>
    );
  }

  return (
    <Shell>
      <Avatar
        name={preview.group_name}
        src={preview.avatar_url}
        seed={preview.avatar_seed ?? preview.group_name}
        size={56}
        className="mx-auto"
      />
      <h1 className="mt-4 text-xl font-semibold text-slate-900">{preview.group_name}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {preview.member_count} {preview.member_count === 1 ? 'member' : 'members'} · Philippine Peso
      </p>

      <p className="mt-4 text-sm text-slate-600">
        You&apos;ll start with a ₱0 balance and be part of expenses added from now on. Past expenses
        stay as they are, though someone can add you to one if you were there.
      </p>

      <div className="mt-5">
        {preview.valid ? (
          <JoinGroupButton token={token} />
        ) : (
          <Alert tone="error">{preview.reason ?? 'This invitation can no longer be used.'}</Alert>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="mb-6 flex items-center">
        <Image src="/logo.png" alt="Meerkash" width={139} height={100} className="h-32 w-auto" />
      </Link>
      <div className="card w-full max-w-sm p-6 text-center">{children}</div>
    </main>
  );
}
