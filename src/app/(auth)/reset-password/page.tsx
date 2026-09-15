import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ResetPasswordForm } from '@/components/auth/AuthForms';

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Set a new password</h1>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
