import { SignupForm } from '@/components/auth/AuthForms';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith('/') ? params.next : '/groups';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Create your account</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Free, and takes about a minute.</p>
      </div>
      <SignupForm next={next} />
    </div>
  );
}
