# Meerkash

Group expense sharing for the Philippines. Someone pays, the app works out each
person's fair share, cancels debts against each other, and tells you plainly who
owes whom.

> Clethers pays ₱1,000 for both. Later John pays ₱600 for both.
> Meerkash doesn't show two debts — it shows one: **John owes Clethers ₱200.**

---

## Get it running

You need Node 20+ and a free Supabase project.

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com) → New project. Pick a region close to
you (Singapore is the nearest to PH). Wait for it to finish provisioning.

### 3. Run the migrations

In the Supabase dashboard, open **SQL Editor** and run these four files **in
order**, one at a time:

```
supabase/migrations/0001_schema.sql     tables, enums, triggers
supabase/migrations/0002_rls.sql        row level security — the real permission layer
supabase/migrations/0003_functions.sql  invites, leaving, ownership, account deletion
supabase/migrations/0004_storage.sql    receipt + settlement-proof buckets
supabase/migrations/0005_avatars.sql    profile + group photo bucket
```

If you use the Supabase CLI instead: `supabase db push`.

### 4. Point the app at it

```bash
cp .env.example .env.local
```

Fill in from **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Never put the `service_role` key in this file — the app doesn't need it, and
anything in `NEXT_PUBLIC_*` ships to the browser.

### 5. Turn on Google sign-in (optional)

**Authentication → Providers → Google**, paste a Google OAuth client ID and
secret, and add this to the Google console's authorised redirect URIs:

```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

Email/password sign-in works without this.

### 6. Run it

```bash
npm run dev
```

Open <http://localhost:3000>.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Balance-engine test suite |
| `npm run test:rls` | RLS integration tests (needs a dedicated Supabase test project — see `tests/rls/README.md`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run gate -- --check` | Run the whole verification gate by hand |
| `npm run setup:loop` | Install the closed-loop Stop hook (once) |

---

## How it's put together

```
src/lib/balance/     the money engine — pure, deterministic, fully tested
src/lib/actions/     server actions (every write goes through one)
src/lib/data/        server-side reads
src/app/             pages
supabase/migrations/ schema + RLS + storage policies
loop/                the closed-loop build gate (see LOOP.md)
```

**Money is always an integer number of centavos.** Never a float, never a
`numeric` peso value. `₱1,000 ÷ 3` becomes `33334, 33333, 33333` — the remainder
is handed out one centavo at a time in a deterministic order, so the shares
always add back up to the total, on every machine, forever.

**Row Level Security is the permission layer.** The UI hides buttons; the
policies in `0002_rls.sql` are what actually stops someone with a valid session
and a REST client. Settlement proofs are the strictest case — only the two
people named on the settlement can fetch one, enforced in storage policies, not
in React.

**Nothing is hard-deleted.** Expenses and accounts are soft-deleted so group
balances and history stay meaningful. `activity_log` is append-only by design:
there is no update policy and no delete policy on it.

---

## What's deliberately not here

Multi-currency, real payment processing (GCash/Maya/bank APIs), AI receipt
scanning, percentage or share-based splitting, custom categories, a formal
dispute workflow, offline mode, a native app, push and email notifications.
These are parked for later versions on purpose — see requirement 35 of the spec.
