import { LoginForm } from '@/components/auth/AuthForms';
import { Alert } from '@/components/ui/Alert';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith('/') ? params.next : '/groups';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to see where your groups stand.</p>
      </div>
      {params.error ? (
        <Alert tone="error">We could not finish signing you in. Please try again.</Alert>
      ) : null}
      <LoginForm next={next} />
    </div>
  );
}
