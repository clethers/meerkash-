import Image from 'next/image';

export function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <span className="flex items-center">
        <Image src="/logo.png" alt="Meerkash" width={139} height={100} className="h-32 w-auto" />
      </span>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">
        Almost there — connect a Supabase project
      </h1>
      <p className="mt-2 text-slate-600">
        The app is running, it just has nowhere to keep your groups yet.
      </p>

      <ol className="mt-8 space-y-5">
        <Step n={1} title="Create a free project at supabase.com">
          Pick a region close to you — Singapore is the nearest to the Philippines.
        </Step>

        <Step n={2} title="Run the four migrations">
          In the Supabase dashboard open <Code>SQL Editor</Code> and run these in order:
          <ul className="mt-2 space-y-1 font-mono text-xs text-slate-600">
            <li>supabase/migrations/0001_schema.sql</li>
            <li>supabase/migrations/0002_rls.sql</li>
            <li>supabase/migrations/0003_functions.sql</li>
            <li>supabase/migrations/0004_storage.sql</li>
            <li>supabase/migrations/0005_avatars.sql</li>
          </ul>
        </Step>

        <Step n={3} title="Fill in .env.local">
          Copy <Code>.env.example</Code> to <Code>.env.local</Code> and paste the Project URL and
          the <Code>anon</Code> public key from Project Settings → API. Leave the{' '}
          <Code>service_role</Code> key out of it.
        </Step>

        <Step n={4} title="Restart the dev server">
          <Code>npm run dev</Code> — environment variables are read at startup.
        </Step>
      </ol>

      <p className="mt-8 text-sm text-slate-500">
        The full walkthrough, including Google sign-in, is in <Code>README.md</Code>.
      </p>
    </main>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
        {n}
      </span>
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{title}</p>
        <div className="mt-1 text-sm text-slate-600">{children}</div>
      </div>
    </li>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.8em] text-slate-800">
      {children}
    </code>
  );
}
