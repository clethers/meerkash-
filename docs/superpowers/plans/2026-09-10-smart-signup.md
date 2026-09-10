# Smart Signup UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-time password-strength meter, debounced username-availability checking, and email-typo detection to Meerkash's existing signup form, backed by a new `username` column on `profiles`.

**Architecture:** Framework-agnostic validation logic (pure `.ts` functions, no React import) in `src/lib/signup/`, consumed by two new client components (`PasswordField`, `UsernameField`) that plug into the existing `SignupForm` in `src/components/auth/AuthForms.tsx`. Username availability is checked via a narrow `SECURITY DEFINER` Postgres RPC callable by anonymous users. Final submission stays on the existing `useActionState` + server-action pattern; `signUpWithEmail` gains server-side re-validation of the username.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, Tailwind CSS, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Vitest, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-09-10-smart-signup-design.md`

## Global Constraints

- No third-party password-strength library (e.g. zxcvbn) — custom heuristic only.
- No new frontend framework or state-management library — plain `useState`/`useReducer`.
- Username: 3-20 chars, lowercase letters/numbers/underscore only, stored lowercase, case-insensitively unique.
- Client-side checks (strength, typo suggestion, availability) are advisory only and must never block form submission.
- `username` is required on the signup form (empty rejected client- and server-side), even though the DB column stays nullable for pre-migration rows.
- Follow existing code style: Tailwind utility classes (`.label`, `.input` from `src/app/globals.css`), `lucide-react` for icons, `cn()` from `@/lib/utils` where class merging is needed.
- Never edit an already-applied migration file — this feature is a new, appended migration (`0014_username.sql`).

---

## Task 1: Database migration — `username` column, uniqueness, availability RPC

**Files:**
- Create: `supabase/migrations/0014_username.sql`

**Interfaces:**
- Produces: `profiles.username` (nullable `text`, lowercase, 3-20 chars `[a-z0-9_]`, case-insensitively unique). RPC `is_username_available(check_username text) returns boolean`, executable by `anon` and `authenticated`. `handle_new_user()` trigger now also reads `username` from `raw_user_meta_data`.

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================================================
-- AbonoShare — add profiles.username
--
-- Adds a public handle used by the new "smart" signup form. The column is
-- nullable at the DB level only so pre-existing rows (created before this
-- migration) don't need a backfill — the signup form itself requires it for
-- every *new* account, enforced in src/lib/actions/auth.ts.
--
-- is_username_available() is SECURITY DEFINER and returns only a boolean so
-- an anonymous visitor typing a username during signup can check it without
-- gaining read access to the profiles table itself (no RLS change here).
-- ============================================================================

alter table profiles add column username text;

create unique index profiles_username_lower_idx on profiles (lower(username));

alter table profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

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

create or replace function is_username_available(check_username text)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from profiles where lower(username) = lower(check_username)
  );
$$;

grant execute on function is_username_available(text) to anon, authenticated;
```

- [ ] **Step 2: Verify the SQL against the checklist**

Read the file back and confirm:
- The `create or replace function handle_new_user()` body is byte-for-byte identical to the version in `supabase/migrations/0001_schema.sql` except for the added `username` column/value — no other behavior changed.
- `is_username_available` is `stable` (not `volatile`) and has no side effects — it only reads.
- No existing migration file was edited.

- [ ] **Step 3: Apply the migration to your Supabase project**

This repo has no Docker-based local stack for normal development (see `tests/rls/README.md`). Apply it the same way other migrations reach a project:

```bash
npx supabase db push
```

(Or paste the file's contents into your project's Dashboard → SQL Editor if it isn't linked via the CLI.) This must be done before Task 9's manual QA pass will work end-to-end.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0014_username.sql
git commit -m "Add profiles.username column, availability RPC, and signup trigger support"
```

---

## Task 2: Password-strength scoring module

**Files:**
- Create: `src/lib/signup/passwordStrength.ts`
- Test: `tests/signup/passwordStrength.test.ts`

**Interfaces:**
- Produces: `scorePassword(password: string): PasswordStrength` where `PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: 'weak' | 'fair' | 'good' | 'strong'; checks: { minLength: boolean; hasUpper: boolean; hasLower: boolean; hasNumber: boolean; hasSymbol: boolean; notCommon: boolean } }`. Also exports the `PasswordStrength` and `PasswordChecks` types.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/signup/passwordStrength.test.ts
import { describe, expect, it } from 'vitest';
import { scorePassword } from '@/lib/signup/passwordStrength';

describe('scorePassword', () => {
  it('scores an empty password as weak with nothing checked', () => {
    const result = scorePassword('');
    expect(result.score).toBe(0);
    expect(result.label).toBe('weak');
    expect(result.checks).toEqual({
      minLength: false,
      hasUpper: false,
      hasLower: false,
      hasNumber: false,
      hasSymbol: false,
      notCommon: true,
    });
  });

  it('scores a too-short password as weak even with mixed characters', () => {
    const result = scorePassword('Ab1!');
    expect(result.score).toBe(0);
    expect(result.label).toBe('weak');
    expect(result.checks.minLength).toBe(false);
  });

  it('flags a well-known common password as weak regardless of length', () => {
    const result = scorePassword('password');
    expect(result.checks.minLength).toBe(true);
    expect(result.checks.notCommon).toBe(false);
    expect(result.score).toBe(0);
    expect(result.label).toBe('weak');
  });

  it('scores a long password with only lowercase letters as weak', () => {
    const result = scorePassword('correcthorse');
    expect(result.checks.minLength).toBe(true);
    expect(result.checks.hasLower).toBe(true);
    expect(result.checks.hasUpper).toBe(false);
    expect(result.score).toBe(1);
    expect(result.label).toBe('weak');
  });

  it('scores length + two character classes as fair', () => {
    const result = scorePassword('correctHorse');
    expect(result.checks.hasUpper).toBe(true);
    expect(result.checks.hasLower).toBe(true);
    expect(result.checks.hasNumber).toBe(false);
    expect(result.score).toBe(2);
    expect(result.label).toBe('fair');
  });

  it('scores length + three character classes as good', () => {
    const result = scorePassword('correctHorse9');
    expect(result.score).toBe(3);
    expect(result.label).toBe('good');
  });

  it('scores length + all four character classes as strong', () => {
    const result = scorePassword('correctHorse9!');
    expect(result.checks).toEqual({
      minLength: true,
      hasUpper: true,
      hasLower: true,
      hasNumber: true,
      hasSymbol: true,
      notCommon: true,
    });
    expect(result.score).toBe(4);
    expect(result.label).toBe('strong');
  });

  it('is case-insensitive when matching the common-password list', () => {
    const result = scorePassword('PASSWORD1');
    expect(result.checks.notCommon).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/signup/passwordStrength.test.ts`
Expected: FAIL — `Cannot find module '@/lib/signup/passwordStrength'` (or similar; the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/signup/passwordStrength.ts

// A small, real subset of the most common leaked passwords (RockYou-derived).
// Checked case-insensitively — this is a "don't use an obviously weak
// password" guard, not an exhaustive breach-database lookup.
const COMMON_PASSWORDS = new Set([
  'password', '123456', '123456789', '12345678', '12345', '1234567',
  'qwerty', 'abc123', 'password1', '111111', '123123', '1234567890',
  'iloveyou', '1q2w3e4r', '000000', 'qwerty123', 'zaq1zaq1', 'dragon',
  'sunshine', 'princess', 'letmein', 'monkey', 'football', 'shadow',
  'master', '654321', 'superman', 'michael', 'ashley', 'bailey',
  'passw0rd', 'shadow1', '121212', '123321', 'welcome', 'admin', 'login',
  'starwars', 'trustno1', 'freedom', 'whatever', 'qazwsx', 'hello123',
  'hunter2', 'batman', 'jennifer', 'jordan23', 'michelle', 'charlie',
  'daniel', 'andrea', 'samsung', 'computer', 'internet', 'service',
  'secret', 'summer', 'ninja', 'azerty', 'harley', 'ranger', 'iloveyou1',
  'tigger', 'robert', 'matthew', 'hockey', 'thomas', 'minecraft',
  'amanda', 'love123', 'jasmine', 'taylor', 'jessica', 'joshua',
  'mustang', 'hannah', 'buster', 'soccer', 'hello', 'pepper', 'snoopy',
  'cookie', 'george', 'midnight', 'ginger', 'william', 'orange',
  'banana', 'purple', 'killer', 'phoenix', 'pokemon', 'dolphin',
  'biteme', 'gateway', 'fuckyou', 'access', 'chelsea', 'black',
  'diamond', 'football1', 'baseball', 'softball', 'corvette',
]);

export interface PasswordChecks {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  notCommon: boolean;
}

export type PasswordStrengthLabel = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: PasswordStrengthLabel;
  checks: PasswordChecks;
}

const LABELS: PasswordStrengthLabel[] = ['weak', 'weak', 'fair', 'good', 'strong'];

export function scorePassword(password: string): PasswordStrength {
  const checks: PasswordChecks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
    notCommon: !COMMON_PASSWORDS.has(password.toLowerCase()),
  };

  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (checks.minLength && checks.notCommon) {
    score = [checks.hasUpper, checks.hasLower, checks.hasNumber, checks.hasSymbol]
      .filter(Boolean).length as 0 | 1 | 2 | 3 | 4;
  }

  return { score, label: LABELS[score], checks };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/signup/passwordStrength.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/signup/passwordStrength.ts tests/signup/passwordStrength.test.ts
git commit -m "Add password-strength scoring module"
```

---

## Task 3: Email-typo suggestion module

**Files:**
- Create: `src/lib/signup/emailSuggest.ts`
- Test: `tests/signup/emailSuggest.test.ts`

**Interfaces:**
- Produces: `suggestEmailCorrection(email: string): string | null` — returns a corrected email (e.g. `"user@gmail.com"`) when the domain looks like a near-miss of a common provider, or `null` when no correction applies.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/signup/emailSuggest.test.ts
import { describe, expect, it } from 'vitest';
import { suggestEmailCorrection } from '@/lib/signup/emailSuggest';

describe('suggestEmailCorrection', () => {
  it('suggests gmail.com for a transposed typo', () => {
    expect(suggestEmailCorrection('user@gmial.com')).toBe('user@gmail.com');
  });

  it('suggests yahoo.com for an extra letter', () => {
    expect(suggestEmailCorrection('user@yahooo.com')).toBe('user@yahoo.com');
  });

  it('suggests gmail.com for a missing letter', () => {
    expect(suggestEmailCorrection('user@gmai.com')).toBe('user@gmail.com');
  });

  it('returns null for an exact common-domain match', () => {
    expect(suggestEmailCorrection('user@gmail.com')).toBeNull();
  });

  it('returns null for a domain too different from any common provider', () => {
    expect(suggestEmailCorrection('user@protonmail.com')).toBeNull();
  });

  it('returns null when there is no @ symbol', () => {
    expect(suggestEmailCorrection('notanemail')).toBeNull();
  });

  it('returns null when the domain is empty', () => {
    expect(suggestEmailCorrection('user@')).toBeNull();
  });

  it('preserves the local part in the suggestion', () => {
    expect(suggestEmailCorrection('first.last+tag@hotnail.com')).toBe('first.last+tag@hotmail.com');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/signup/emailSuggest.test.ts`
Expected: FAIL — `Cannot find module '@/lib/signup/emailSuggest'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/signup/emailSuggest.ts

const COMMON_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[rows - 1][cols - 1];
}

export function suggestEmailCorrection(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at === -1 || at === email.length - 1) return null;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (COMMON_DOMAINS.includes(domain)) return null;

  let best: { domain: string; distance: number } | null = null;
  for (const candidate of COMMON_DOMAINS) {
    const distance = levenshtein(domain, candidate);
    if (distance > 0 && distance <= 2 && (!best || distance < best.distance)) {
      best = { domain: candidate, distance };
    }
  }

  return best ? `${local}@${best.domain}` : null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/signup/emailSuggest.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/signup/emailSuggest.ts tests/signup/emailSuggest.test.ts
git commit -m "Add email-typo suggestion module"
```

---

## Task 4: Debounce utility and username-check wrapper

**Files:**
- Create: `src/lib/signup/debounce.ts`
- Create: `src/lib/signup/usernameCheck.ts`

**Interfaces:**
- Consumes: none (new browser Supabase client comes from `createClient()` in `@/lib/supabase/client`, already exists).
- Produces: `debounce<Args extends unknown[]>(fn: (...args: Args) => void, delay: number): (...args: Args) => void`. `checkUsernameAvailable(supabase: SupabaseClient, username: string): Promise<boolean>`.

- [ ] **Step 1: Write `debounce.ts`**

```typescript
// src/lib/signup/debounce.ts

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
```

- [ ] **Step 2: Write `usernameCheck.ts`**

```typescript
// src/lib/signup/usernameCheck.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function checkUsernameAvailable(
  supabase: SupabaseClient,
  username: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_username_available', {
    check_username: username,
  });
  if (error) throw error;
  return Boolean(data);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from these two files (both are small enough that a type error would be immediately obvious in the output).

- [ ] **Step 4: Commit**

```bash
git add src/lib/signup/debounce.ts src/lib/signup/usernameCheck.ts
git commit -m "Add debounce utility and username-availability check wrapper"
```

---

## Task 5: `PasswordField` component

**Files:**
- Create: `src/components/auth/PasswordField.tsx`

**Interfaces:**
- Consumes: `scorePassword` from `@/lib/signup/passwordStrength` (Task 2).
- Produces: `PasswordField({ value: string; onChange: (value: string) => void })` — a controlled `<input name="password">` with a show/hide toggle, strength bar, and requirements checklist. Rendered inside a form, so `name="password"` is what `FormData` picks up on submit.

- [ ] **Step 1: Write the component**

```tsx
// src/components/auth/PasswordField.tsx
'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { scorePassword, type PasswordChecks } from '@/lib/signup/passwordStrength';

const REQUIREMENTS: { key: keyof PasswordChecks; label: string }[] = [
  { key: 'minLength', label: 'At least 8 characters' },
  { key: 'hasUpper', label: 'One uppercase letter' },
  { key: 'hasLower', label: 'One lowercase letter' },
  { key: 'hasNumber', label: 'One number' },
  { key: 'hasSymbol', label: 'One symbol' },
];

const STRENGTH_COLOR: Record<string, string> = {
  weak: 'bg-rose-500',
  fair: 'bg-amber-500',
  good: 'bg-amber-500',
  strong: 'bg-brand-500',
};

export function PasswordField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const strength = scorePassword(value);

  return (
    <div>
      <label className="label" htmlFor="password">Password</label>
      <div className="relative mt-1.5">
        <input
          id="password"
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={8}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="input pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {value.length > 0 ? (
        <>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all ${STRENGTH_COLOR[strength.label]}`}
              style={{ width: `${(strength.score / 4) * 100}%` }}
            />
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {REQUIREMENTS.map((requirement) => {
              const met = strength.checks[requirement.key];
              return (
                <li
                  key={requirement.key}
                  className={`flex items-center gap-1.5 ${met ? 'text-brand-700' : 'text-slate-500'}`}
                >
                  {met ? <Check size={14} /> : <X size={14} />}
                  {requirement.label}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `PasswordField.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/PasswordField.tsx
git commit -m "Add PasswordField component with strength meter and show/hide toggle"
```

---

## Task 6: `UsernameField` component

**Files:**
- Create: `src/components/auth/UsernameField.tsx`

**Interfaces:**
- Consumes: `debounce` (Task 4), `checkUsernameAvailable` (Task 4), `createClient` from `@/lib/supabase/client` (existing).
- Produces: `UsernameField({ value: string; onChange: (value: string) => void })` — a controlled `<input name="username">` with a debounced availability indicator and contextual microcopy explaining why it's collected.

- [ ] **Step 1: Write the component**

```tsx
// src/components/auth/UsernameField.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { checkUsernameAvailable } from '@/lib/signup/usernameCheck';
import { debounce } from '@/lib/signup/debounce';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const MESSAGES: Record<UsernameStatus, string | null> = {
  idle: null,
  checking: 'Checking availability…',
  available: 'Username is available',
  taken: 'That username is taken',
  invalid: '3-20 characters: lowercase letters, numbers, underscore',
};

const MESSAGE_COLOR: Record<UsernameStatus, string> = {
  idle: 'text-slate-500',
  checking: 'text-slate-500',
  available: 'text-brand-700',
  taken: 'text-rose-600',
  invalid: 'text-rose-600',
};

export function UsernameField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const supabaseRef = useRef(createClient());
  const debouncedCheckRef = useRef(
    debounce((username: string) => {
      checkUsernameAvailable(supabaseRef.current, username)
        .then((available) => setStatus(available ? 'available' : 'taken'))
        .catch(() => setStatus('idle'));
    }, 400),
  );

  useEffect(() => {
    if (value.length === 0) {
      setStatus('idle');
      return;
    }
    if (!USERNAME_PATTERN.test(value)) {
      setStatus('invalid');
      return;
    }
    setStatus('checking');
    debouncedCheckRef.current(value);
  }, [value]);

  const message = MESSAGES[status];
  const icon = {
    idle: null,
    checking: <Loader2 size={14} className="animate-spin" />,
    available: <Check size={14} />,
    taken: <X size={14} />,
    invalid: <X size={14} />,
  }[status];

  return (
    <div>
      <label className="label" htmlFor="username">Username</label>
      <input
        id="username"
        name="username"
        required
        minLength={3}
        maxLength={20}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value.toLowerCase())}
        className="input mt-1.5"
        placeholder="juan_delacruz"
      />
      {message ? (
        <p className={`mt-1 flex items-center gap-1.5 text-xs ${MESSAGE_COLOR[status]}`}>
          {icon}
          {message}
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">This is how friends will find you.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `UsernameField.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/UsernameField.tsx
git commit -m "Add UsernameField component with debounced availability check"
```

---

## Task 7: Wire `SignupForm` to the new fields

**Files:**
- Modify: `src/components/auth/AuthForms.tsx:77-108` (the `SignupForm` function)

**Interfaces:**
- Consumes: `PasswordField` (Task 5), `UsernameField` (Task 6), `suggestEmailCorrection` (Task 3).
- Produces: an updated `SignupForm` whose submitted `FormData` includes `name`, `email`, `password`, `username` (unchanged external signature: `SignupForm({ next: string })`).

- [ ] **Step 1: Update imports and add controlled state**

In `src/components/auth/AuthForms.tsx`, add to the top of the file (alongside the existing `useActionState, useEffect` import):

```typescript
import { useActionState, useEffect, useState } from 'react';
```

Add new imports near the top, after the existing `SubmitButton` import:

```typescript
import { PasswordField } from './PasswordField';
import { UsernameField } from './UsernameField';
import { suggestEmailCorrection } from '@/lib/signup/emailSuggest';
```

- [ ] **Step 2: Replace the `SignupForm` body**

Replace the existing `SignupForm` function (lines 77-108) with:

```tsx
export function SignupForm({ next }: { next: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(signUpWithEmail, null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const emailSuggestion = suggestEmailCorrection(email);

  return (
    <div className="space-y-4">
      <GoogleButton next={next} />
      <Divider />
      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" name="name" required minLength={2} autoComplete="name" className="input mt-1.5" placeholder="Clethers" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input mt-1.5"
          />
          {emailSuggestion ? (
            <p className="mt-1 text-xs text-slate-500">
              Did you mean{' '}
              <button
                type="button"
                onClick={() => setEmail(emailSuggestion)}
                className="font-medium text-brand-700 hover:underline"
              >
                {emailSuggestion}
              </button>
              ?
            </p>
          ) : null}
        </div>
        <UsernameField value={username} onChange={setUsername} />
        <PasswordField value={password} onChange={setPassword} />
        {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state?.ok ? <Alert tone="success">{String(state.data?.message ?? 'Account created.')}</Alert> : null}
        <SubmitButton className="w-full" pendingLabel="Creating account…">Create account</SubmitButton>
      </form>
      <p className="text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `AuthForms.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/AuthForms.tsx
git commit -m "Wire SignupForm to PasswordField, UsernameField, and email-typo suggestion"
```

---

## Task 8: Server-side username validation in `signUpWithEmail`

**Files:**
- Modify: `src/lib/actions/auth.ts:15-36` (the `signUpWithEmail` function)

**Interfaces:**
- Consumes: the `is_username_available` RPC (Task 1), existing `fail`/`ok`/`readableError` from `./shared`.
- Produces: `signUpWithEmail` now validates and persists `username`, unchanged external signature (`(_prev: ActionResult | null, formData: FormData) => Promise<ActionResult>`).

- [ ] **Step 1: Replace `signUpWithEmail`**

In `src/lib/actions/auth.ts`, replace the existing `signUpWithEmail` function (lines 15-36) with:

```typescript
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export async function signUpWithEmail(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const username = String(formData.get('username') ?? '').trim().toLowerCase();

  if (name.length < 2) return fail('Please enter your name.');
  if (!email.includes('@')) return fail('Please enter a valid email address.');
  if (password.length < 8) return fail('Password must be at least 8 characters.');
  if (!USERNAME_PATTERN.test(username)) {
    return fail('Username must be 3-20 characters: lowercase letters, numbers, and underscores.');
  }

  const supabase = await createClient();

  const { data: available, error: availabilityError } = await supabase.rpc('is_username_available', {
    check_username: username,
  });
  if (availabilityError) return fail(readableError(availabilityError, 'Could not verify username availability.'));
  if (!available) return fail('That username is already taken.');

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name, username },
      emailRedirectTo: `${siteOrigin()}/auth/callback`,
    },
  });

  if (error) {
    if (/username/i.test(error.message)) return fail('That username was just taken — try another.');
    return fail(readableError(error, 'We could not create your account.'));
  }
  return ok({ message: 'Check your inbox to confirm your email, then sign in.' });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `auth.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/auth.ts
git commit -m "Validate and persist username in signUpWithEmail"
```

---

## Task 9: Full gate check and manual QA

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run: `node loop/gate.mjs --check`
Expected: all stages green (unit tests, typecheck, `next build`, stub scan).

- [ ] **Step 2: Manual browser walkthrough**

Prerequisite: Task 1's migration must already be applied to the Supabase project your `.env.local` points at.

Run: `npm run dev`, then in a browser visit `/signup` and confirm:
- Typing a password under 8 characters shows the "At least 8 characters" helper text; typing 8+ characters replaces it with the strength bar and checklist, which tick off live as you add uppercase/lowercase/number/symbol characters.
- Clicking the eye icon toggles the password field between masked and plain text.
- Typing an email like `you@gmial.com` shows a "Did you mean you@gmail.com?" suggestion; clicking it fills the corrected email in.
- Typing a username shows "Checking availability…" briefly, then either an available/taken message; typing an existing account's username (or your own, before creating a new one) shows "That username is taken"; typing something with an uppercase letter or a space is rejected as invalid with the format hint.
- Submitting the form with a valid, available username creates the account and shows the "Check your inbox…" success message.
- Submitting with a username that fails format validation is rejected with the "3-20 characters…" error even if JavaScript validation were somehow bypassed (confirms server-side re-validation).

- [ ] **Step 3: Commit (only if the walkthrough surfaced fixes)**

If manual QA required any code changes, commit them individually with descriptive messages before considering this plan complete. If no changes were needed, this step is a no-op.
