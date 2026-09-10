# RLS integration tests

The policies in `supabase/migrations/0002_rls.sql` (and the storage policies
in `0004_storage.sql`) are the real permission layer — the UI just hides
buttons. Nothing else in this repo proves they hold against a real client
session, so these tests do: they hit a real Supabase project with real
signed-in `supabase-js` clients, the same way a browser would.

These tests are **not** part of `npm test` / `npm run gate` — they need a
live Supabase project to run against, and the gate has to stay deterministic
in any environment.

## ⚠️ Use a dedicated test project — never your real one

These tests create real throwaway auth users and rows (groups, expenses,
settlements). **Do not** point them at the project your `.env.local` uses for
actual development. Create a second, free Supabase project used for nothing
else, and point `.env.test.local` at that instead.

(This project was written assuming a local Docker-based Supabase stack would
be available for this — `supabase start` — but that needs a Docker-compatible
container engine, which isn't an option on every machine. Testing against a
real, dedicated hosted project needs no Docker/virtualization at all.)

## One-time setup

1. Create a new project at [supabase.com](https://supabase.com) — this is
   your **test** project, separate from whatever `.env.local` points at.
2. Apply the schema to it. Easiest path, no Docker needed:
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_TEST_PROJECT_REF
   npx supabase db push
   ```
   This applies all 5 files in `supabase/migrations/` in order — schema, RLS,
   functions, storage, avatars — directly to the test project's Postgres.
   (Alternatively: paste each migration file into the test project's
   Dashboard → SQL Editor, in order, one at a time.)
3. Copy `.env.test.local.example` to `.env.test.local` and fill in the three
   values from the test project's **Project Settings → API**:
   ```
   SUPABASE_TEST_URL=...
   SUPABASE_TEST_ANON_KEY=...
   SUPABASE_TEST_SERVICE_ROLE_KEY=...   # secret — never sent to a browser
   ```
   `.env.test.local` is gitignored; never commit it.

## Running

```bash
npm run test:rls
```

## No cleanup, on purpose

Every fixture (test user email, group name) gets a run-unique suffix, so
tests never depend on the project being empty and there's no `afterEach`
teardown to keep in sync with schema changes. The test project just
accumulates disposable rows across runs — that's fine, it's not used for
anything else. If it ever bothers you, the clean fix is deleting and
recreating the test project (steps 1–2 above), not writing a cleanup script.

## Proving the suite actually catches a regression

Don't trust a green run alone — break a policy and watch it fail, the same
way `LOOP.md` proves the main gate. Do this in the **test** project's
Dashboard → SQL Editor (never against the project `.env.local` uses):

```sql
-- 1. Loosen the owner-only rename policy
drop policy "owner updates the group" on groups;
create policy "owner updates the group" on groups for update using (true) with check (true);
```

Run `npm run test:rls` — `groups.test.ts`'s non-owner-rename test should now
**fail**. Then restore the real policy by pasting the original `create
policy "owner updates the group" ...` statement from
`supabase/migrations/0002_rls.sql` back into the SQL Editor, and confirm
`npm run test:rls` is green again.

The same recipe works for `is_group_member()` (`membership.test.ts` — replace
its body with `select true;`, confirm the removed-member test fails, restore
from `0002_rls.sql`) and the settlement-proofs storage policy
(`settlement-proofs.test.ts` — loosen its `using` clause in
`0004_storage.sql`'s policy the same way).
