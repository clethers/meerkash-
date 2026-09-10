# Smart account-creation UX — design

## Context

The original ask specified a framework-free (HTML5 + vanilla JS, no
TypeScript) signup page. That conflicts with the app as it actually exists:
Meerkash is Next.js 15 / React 19 / TypeScript, and already has a working
Supabase-backed signup flow (`src/app/(auth)/signup/page.tsx` →
`SignupForm` in `src/components/auth/AuthForms.tsx`, submitting through the
`signUpWithEmail` server action). Resolved via brainstorm: rebuild the
"smart" UX *inside* this app's existing React/TypeScript/Tailwind
component and server-action model rather than as a standalone page.

Two more gaps between the original spec and the real app, also resolved
during brainstorm:

- **Username.** The spec assumed a debounced username-availability check,
  but `profiles` has no `username` column today (users are identified by
  `display_name` + `email`). Decision: add a real `username` column and
  build the check against it, rather than dropping the feature or
  repurposing it as an email-exists check.
- **DOB / phone.** Mentioned in the original spec only as illustrative
  examples of "contextual microcopy." Meerkash (an expense-splitting app)
  has no current use for either. Decision: skip both — out of scope.

Final field set: **name, email, password, username** (plus the existing
Google OAuth button). That's exactly the 4-field threshold the original
spec used as the "break into steps" trigger — so this stays a single-page
form, not a wizard, but is structured so splitting into steps later is a
layout change, not a rewrite.

Username format, locked in during brainstorm: 3–20 characters, lowercase
letters/numbers/underscore, stored lowercase, case-insensitively unique.

## Design

### 1. Data model (migration `0014_username.sql`)

```sql
alter table profiles add column username text;

create unique index profiles_username_lower_idx on profiles (lower(username));

alter table profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');
```

Extend the existing `handle_new_user()` trigger (introduced in
`0001_schema.sql`) to also read `username` out of `raw_user_meta_data`,
mirroring how it already reads `full_name`:

```sql
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url, email, username)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, 'member'), '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    nullif(new.raw_user_meta_data->>'username', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
```

Username lands in `profiles` atomically with the auth user — no follow-up
`UPDATE` needed, same pattern the codebase already uses for
`full_name`/`avatar_url`.

**Availability check RPC** — narrow by design: returns only a boolean, so
anonymous visitors can probe "is X taken" without gaining read access to
the `profiles` table itself (no RLS change on `profiles`):

```sql
create or replace function is_username_available(check_username text)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from profiles where lower(username) = lower(check_username)
  );
$$;

grant execute on function is_username_available(text) to anon, authenticated;
```

### 2. Validation modules — `src/lib/signup/` (plain `.ts`, no React import)

Framework-agnostic by design: each is a pure function or small utility,
unit-testable with Vitest without mounting a component, and reusable if
this logic is ever needed somewhere other than `SignupForm`.

- **`passwordStrength.ts`** — `scorePassword(password: string): { score: 0-4, label: 'weak'|'fair'|'good'|'strong', checks: { minLength, hasUpper, hasLower, hasNumber, hasSymbol, notCommon } }`. Checklist UI items map 1:1 to the `checks` fields. `notCommon` checks against a small bundled common-password list (~200 entries).
- **`emailSuggest.ts`** — `suggestEmailCorrection(email: string): string | null`. Compares the typed domain against a short list of common providers (gmail.com, yahoo.com, outlook.com, hotmail.com, icloud.com) via edit-distance ≤ 2. Purely local — no network call, no dependency on the username RPC's debounce path.
- **`debounce.ts`** — a small generic `debounce<T extends (...args: any[]) => void>(fn: T, delay: number)` utility. No external debounce library.
- **`usernameCheck.ts`** — `checkUsernameAvailable(supabase: SupabaseClient, username: string): Promise<boolean>`, a thin wrapper around `.rpc('is_username_available', { check_username: username })`.

### 3. Components — `src/components/auth/`

- **`AuthForms.tsx`** — `SignupForm` gains a `username` field plus derived UI state: `passwordChecks`, `emailSuggestion`, `usernameStatus: 'idle' | 'checking' | 'available' | 'taken' | 'invalid'`. State lives in `useState`/`useReducer`; no new global state mechanism.
- **`PasswordField.tsx`** (new) — input with show/hide toggle, red/yellow/green strength bar, and the live requirements checklist. Self-contained: takes `value`/`onChange`, calls `scorePassword` internally.
- **`UsernameField.tsx`** (new) — input wired to a debounced (400ms via `debounce.ts`) call into `checkUsernameAvailable`, rendering a status affordance (spinner → check/x icon + message) driven by `usernameStatus`.
- Email typo suggestion is a one-line conditional under the existing email input in `AuthForms.tsx` — no new file needed.

All four fields stay on one scrollable page. `PasswordField` and
`UsernameField` are already isolated components, so a future move to a
multi-step wizard only touches layout/routing, not this validation logic.

### 4. Submission flow

`username` is **required** on this form (rejected client- and
server-side if empty), same tier as name/email/password — the column
stays nullable at the DB level only so pre-migration rows don't need a
backfill, not because new signups may skip it.

Unchanged shape: `useActionState` + `signUpWithEmail` server action.
`signUpWithEmail` is extended to:

1. Read `username` from `formData`; reject if empty (mirrors the
   existing `name.length < 2` / `password.length < 8` checks).
2. Re-validate format server-side (same regex as the DB constraint) and
   re-check availability via `is_username_available` — defense against a
   stale client-side check (the user waited, someone else took the name).
3. Pass `username` through `options.data` on `supabase.auth.signUp(...)`,
   alongside the existing `full_name`, so `handle_new_user()` picks it up.

### 5. Error handling

- Client-side checks (strength meter, typo suggestion, availability
  check) are advisory only and never block submission — a slow or failed
  RPC must not trap the user in the form.
- The server action remains the source of truth. A unique-violation on
  `username` at insert time (race: taken between the client's last check
  and submit) is caught and mapped through the existing `readableError`
  helper to "That username was just taken — try another."

### 6. Testing

- Vitest unit tests for `passwordStrength.ts` and `emailSuggest.ts` —
  pure functions, table-driven test cases.
- Manual browser pass for the debounced RPC flow and full signup
  submission (this is a UI-behavior feature; automated tests don't cover
  "does the checklist visibly tick as you type").

## Out of scope (v1)

Username editing after signup (profile settings still only expose
`display_name`/`avatar_url`/`preferred_currency` today — extending
`updateProfile` to also handle `username` is separate, unscoped work).
Multi-step wizard navigation (structured for later, not built now — see
§3). DOB and phone number fields (confirmed not needed for this app).
zxcvbn or any third-party password-strength library (custom heuristic
matches the "checklist that ticks off" requirement more directly and
avoids the bundle-size hit).
