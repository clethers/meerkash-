import { ForgotPasswordForm } from '@/components/auth/AuthForms';

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
