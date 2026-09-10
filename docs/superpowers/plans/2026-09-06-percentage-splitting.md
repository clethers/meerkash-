# Percentage Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third expense split mode — percentages — alongside the existing `equal` and `exact` modes, backend-only (schema, balance engine, server actions, types). The other Claude Code session builds the `ExpenseForm.tsx` UI on top of the interface this plan produces.

**Architecture:** A new nullable `expense_participants.percentage_basis_points` column stores what was actually typed (0–10000 basis points = 0.00%–100.00%), while the existing `share_centavos` column — computed once at save time — remains the single source of truth every other query already reads. A new `splitByPercentage()` function in the balance engine mirrors the existing `splitExactly()`/`splitEqually()` pattern exactly: validate, compute, distribute the rounding remainder deterministically.

**Tech Stack:** Next.js 15 server actions, Supabase/Postgres, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-06-percentage-splitting-design.md`

## Global Constraints

- Money is always an integer number of centavos — never a float, never `numeric`. Percentages are stored as integer basis points (0–10000) for the same reason.
- Percentages must sum to exactly `10000` (100.00%) — no tolerance.
- `share_centavos` stays the only column balance/RLS/display logic depends on; `percentage_basis_points` is display/edit-only metadata.
- Match existing code style exactly: flat `describe`/`it` Vitest blocks, plain `expect(...).toBe/toEqual/toThrow(...)`, no custom matchers or new test infrastructure.
- This plan is backend-only. Do not touch `src/components/` or `src/app/**/*.tsx` — that is the other session's territory.

---

## Task 1: Database migration + DB type mirror

**Files:**
- Create: `supabase/migrations/0007_percentage_splits.sql`
- Modify: `src/types/db.ts:3` (the `SplitModeDb` type)
- Modify: `src/types/db.ts:75-79` (the `ExpenseParticipant` interface)

**Interfaces:**
- Produces: `SplitModeDb = 'equal' | 'exact' | 'percentage'`; `ExpenseParticipant.percentage_basis_points: number | null`. Every later task in this plan consumes these.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0007_percentage_splits.sql`:

```sql
-- ============================================================================
-- AbonoShare — percentage splitting
--
-- A third split mode alongside 'equal' and 'exact'. Percentages are stored as
-- integer basis points (0-10000 = 0.00%-100.00%) so there is never float
-- rounding, matching the centavos-only philosophy used everywhere else.
-- Nullable: 'equal'/'exact' rows are untouched and stay null. share_centavos
-- remains the one column balance/RLS/display logic reads — this column is
-- display/edit metadata only.
--
-- `alter type ... add value` must be its own statement/migration: Postgres
-- forbids using a new enum value in the same transaction that adds it.
-- ============================================================================
alter type split_mode add value 'percentage';

alter table expense_participants
  add column percentage_basis_points integer
    check (percentage_basis_points is null or percentage_basis_points between 0 and 10000);
```

- [ ] **Step 2: Update the `SplitModeDb` type**

In `src/types/db.ts`, change line 3:

```ts
export type SplitModeDb = 'equal' | 'exact' | 'percentage';
```

- [ ] **Step 3: Update the `ExpenseParticipant` interface**

In `src/types/db.ts`, change the interface at lines 75-79 to:

```ts
export interface ExpenseParticipant {
  expense_id: string;
  user_id: string;
  share_centavos: number;
  percentage_basis_points: number | null;
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors (this is a pure additive type change — nothing currently exhaustively switches over `SplitModeDb` in a way that would break on a new member; if something does fail, read the error and fix that call site as part of this task, since it means Task 3 hasn't happened yet and the codebase doesn't compile without it).

- [ ] **Step 5: Apply the migration to the connected Supabase project**

This repo has a live dev Supabase project connected (`.env.local`, project ref `sabufeqgqzffizczpofc`, migrations 0001-0006 already applied via `supabase db push`). Apply this one the same way:

```bash
npx supabase db push --db-url "<the session pooler connection string for this project, port 5432>" --include-all
```

(The connection string and DB password are not written into this plan file — use the same one from earlier in this session's history, or fetch a fresh one from the project's Dashboard → Connect if it's no longer at hand.)

Expected output: `Applying migration 0007_percentage_splits.sql...` then success.

- [ ] **Step 6: Verify the column exists**

```bash
curl -s "https://sabufeqgqzffizczpofc.supabase.co/rest/v1/expense_participants?select=percentage_basis_points&limit=1" \
  -H "apikey: <the NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local>"
```

Expected: `[]` (empty array, not a `PGRST205`/column-not-found error) — confirms the column exists and RLS is correctly returning zero rows to an anonymous request.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0007_percentage_splits.sql src/types/db.ts
git commit -m "feat: add percentage split mode to schema and DB types"
```

(Skip this step if the repo has no `.git` yet — note that to the user instead of running `git commit`, which will fail with "not a git repository.")

---

## Task 2: Balance engine — `splitByPercentage`

**Files:**
- Modify: `src/lib/balance/types.ts` (the `SplitMode` type and `ExpenseInput` interface)
- Modify: `src/lib/balance/split.ts` (new function + `computeShares` dispatch)
- Test: `tests/balance/split.test.ts`

**Interfaces:**
- Consumes: `Centavos`/`isCentavos` from `@/lib/money`; `BalanceError` from `./types`.
- Produces: `splitByPercentage(amount: Centavos, participants: UserId[], basisPoints: Record<UserId, number> | undefined): Record<UserId, Centavos>`, exported from `@/lib/balance` (via the existing `export * from './split'` in `src/lib/balance/index.ts` — no change needed there). `ExpenseInput.percentages?: Record<UserId, number>`. `computeShares()` now dispatches to this for `splitMode === 'percentage'`. Task 3 consumes all of this.

- [ ] **Step 1: Write the failing tests**

Add to `tests/balance/split.test.ts`, after the existing `splitExactly` describe block (after line 66) and before `describe('expenseDeltas', ...)`:

```ts
describe('splitByPercentage', () => {
  it('splits ₱1,000 by exact thirds without losing a centavo', () => {
    const shares = splitByPercentage(100_000, ['a', 'b', 'c'], { a: 3333, b: 3333, c: 3334 });
    const total = Object.values(shares).reduce((x, y) => x + y, 0);
    expect(total).toBe(100_000);
    expect(shares).toEqual({ a: 33_333, b: 33_333, c: 33_334 });
  });

  it('gives the whole amount to a single 100% participant', () => {
    expect(splitByPercentage(50_000, ['a'], { a: 10_000 })).toEqual({ a: 50_000 });
  });

  it('conserves the total for many awkward amounts and splits', () => {
    for (let amount = 1; amount <= 300; amount += 7) {
      const shares = splitByPercentage(amount, ['a', 'b', 'c'], { a: 5000, b: 3000, c: 2000 });
      const sum = Object.values(shares).reduce((x, y) => x + y, 0);
      expect(sum).toBe(amount);
    }
  });

  it('rejects a sum under 100%', () => {
    expect(() => splitByPercentage(100_000, ['a', 'b'], { a: 4000, b: 4000 })).toThrow(/100/);
  });

  it('rejects a sum over 100%', () => {
    expect(() => splitByPercentage(100_000, ['a', 'b'], { a: 6000, b: 6000 })).toThrow(/100/);
  });

  it('rejects a participant with no percentage', () => {
    expect(() => splitByPercentage(100_000, ['a', 'b'], { a: 10_000 })).toThrow(/a|Missing/);
  });

  it('rejects a percentage for a non-participant', () => {
    expect(() => splitByPercentage(100_000, ['a'], { a: 10_000, ghost: 0 })).toThrow(/not a participant/);
  });

  it('rejects an undefined percentage map', () => {
    expect(() => splitByPercentage(100_000, ['a'], undefined)).toThrow();
  });
});
```

Also update the `import` line at the top of the file (line 2) to include the new function:

```ts
import { computeShares, expenseDeltas, splitByPercentage, splitEqually, splitExactly } from '@/lib/balance';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/balance/split.test.ts`
Expected: FAIL — `splitByPercentage is not exported` / `is not a function`.

- [ ] **Step 3: Add `percentages` to `ExpenseInput`**

In `src/lib/balance/types.ts`, change line 5 and the interface at lines 7-20:

```ts
export type SplitMode = 'equal' | 'exact' | 'percentage';

export interface ExpenseInput {
  id: string;
  /** Who fronted the cash. Need not be a participant. */
  payerId: UserId;
  /** Total of the expense, in centavos. Must be > 0. */
  amount: Centavos;
  /** Everyone who consumed it. Excluded members simply are not in this list. */
  participants: UserId[];
  splitMode: SplitMode;
  /** Required when splitMode === 'exact'. Must sum to `amount`. */
  exactShares?: Record<UserId, Centavos>;
  /** Required when splitMode === 'percentage'. Basis points (0-10000), must sum to 10000. */
  percentages?: Record<UserId, number>;
  /** Soft-deleted expenses never affect balances. */
  deletedAt?: string | null;
}
```

- [ ] **Step 4: Implement `splitByPercentage`**

In `src/lib/balance/split.ts`, add after the `splitExactly` function (after line 62, before `computeShares`):

```ts
/**
 * Split `amount` by percentage across `participants`. Percentages are integer
 * basis points (0-10000 = 0.00%-100.00%) and must sum to exactly 10000 — no
 * tolerance, matching splitExactly's exact-sum requirement. The rounding
 * remainder is handed out one centavo at a time in the same deterministic
 * sorted-id order splitEqually uses, so shares always sum exactly to the
 * total on every machine.
 */
export function splitByPercentage(
  amount: Centavos,
  participants: UserId[],
  basisPoints: Record<UserId, number> | undefined,
): Record<UserId, Centavos> {
  if (!isCentavos(amount)) throw new BalanceError('Amount must be an integer number of centavos');
  if (amount <= 0) throw new BalanceError('Amount must be greater than zero');
  if (!basisPoints) throw new BalanceError('Percentage split requires a percentage per person');

  const unique = dedupe(participants);
  if (unique.length === 0) throw new BalanceError('An expense needs at least one participant');

  let sum = 0;
  for (const id of unique) {
    const bp = basisPoints[id];
    if (!Number.isInteger(bp) || bp < 0 || bp > 10000) {
      throw new BalanceError(`Missing or invalid percentage for ${id}`);
    }
    sum += bp;
  }
  for (const id of Object.keys(basisPoints)) {
    if (!unique.includes(id)) throw new BalanceError(`${id} has a percentage but is not a participant`);
  }
  if (sum !== 10000) {
    throw new BalanceError(
      `Percentages add up to ${(sum / 100).toFixed(2)}% but an expense must add up to 100%`,
    );
  }

  const shares: Record<UserId, Centavos> = {};
  let remainder = amount;
  for (const id of unique) {
    shares[id] = Math.floor((amount * basisPoints[id]) / 10000);
    remainder -= shares[id];
  }

  const order = [...unique].sort();
  for (const id of order) {
    if (remainder <= 0) break;
    shares[id] += 1;
    remainder -= 1;
  }
  return shares;
}
```

- [ ] **Step 5: Wire it into `computeShares`**

In `src/lib/balance/split.ts`, replace the `computeShares` function (lines 65-69):

```ts
/** The one entry point the rest of the app should use. */
export function computeShares(expense: ExpenseInput): Record<UserId, Centavos> {
  if (expense.splitMode === 'exact') {
    return splitExactly(expense.amount, expense.participants, expense.exactShares);
  }
  if (expense.splitMode === 'percentage') {
    return splitByPercentage(expense.amount, expense.participants, expense.percentages);
  }
  return splitEqually(expense.amount, expense.participants);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/balance/split.test.ts`
Expected: PASS, all tests including the 8 new ones.

- [ ] **Step 7: Run the full test suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS — confirms nothing elsewhere broke (in particular, anything exhaustively switching on `SplitMode` would now fail to typecheck; there is currently no such switch outside `computeShares`, which this step just updated).

- [ ] **Step 8: Commit**

```bash
git add src/lib/balance/types.ts src/lib/balance/split.ts tests/balance/split.test.ts
git commit -m "feat: add splitByPercentage to the balance engine"
```

(Skip if no `.git` repo — see Task 1 Step 7 note.)

---

## Task 3: Server action — percentage mode in `expenses.ts`

**Files:**
- Modify: `src/lib/actions/expenses.ts:12-67` (`ParsedExpense` interface and `parseExpenseForm`)
- Modify: `src/lib/actions/expenses.ts:93-115` (`createExpense`'s `expense_participants` insert)
- Modify: `src/lib/actions/expenses.ts:194-214` (`updateExpense`'s `expense_participants` delete+reinsert)

**Interfaces:**
- Consumes: `computeShares`, `ExpenseInput` from `@/lib/balance` (Task 2); `SplitModeDb` from `@/types/db` (Task 1).
- Produces: the exact form-field contract the UI session builds against — see "UI handoff contract" below. `addMemberToExpense` (lines 319-380) needs **no change**: it always hardcodes `splitMode: 'equal'` and never sets `percentage_basis_points`, which is correct — the column stays `null` for equal-mode rows, exactly like it already does for exact-mode rows today. Verified by reading the function; do not add a task for it.

**No unit test for this task.** This codebase has no tests for `src/lib/actions/*.ts` — server actions call `createClient()` from `@/lib/supabase/server`, which uses `next/headers` and throws outside a real Next.js request context, and there is no existing mocking infrastructure for that. This matches the existing untested state of every other action in this file (`createExpense`, `updateExpense`, etc. have zero tests today). Verification for this task is: typecheck, the full gate, and (once the other session's UI exists) a manual smoke test through the real form — not a new test file. Do not introduce new test/mocking infrastructure to work around this; that would be a larger, separate decision.

- [ ] **Step 1: Add `percentages` to `ParsedExpense` and parse it**

In `src/lib/actions/expenses.ts`, change the `ParsedExpense` interface (lines 12-21):

```ts
interface ParsedExpense {
  description: string;
  amount: number;
  payerId: string;
  participants: string[];
  splitMode: SplitModeDb;
  shares: Record<string, number>;
  percentages?: Record<string, number>;
  category: ExpenseCategory;
  note: string | null;
}
```

Then in `parseExpenseForm` (lines 23-67), add a `percentage` branch after the existing `if (splitMode === 'exact') { ... }` block (after line 59, before the `try { const shares = computeShares(input);` block on line 61):

```ts
  } else if (splitMode === 'percentage') {
    const percentages: Record<string, number> = {};
    for (const id of participants) {
      const raw = String(formData.get(`percentage_${id}`) ?? '').trim();
      const value = raw === '' ? NaN : Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return 'One of the percentages is not a valid value between 0 and 100.';
      }
      percentages[id] = Math.round(value * 100);
    }
    input.percentages = percentages;
  }
```

(This becomes an `if`/`else if` chain with the existing `if (splitMode === 'exact') { ... }` block — change that block's opening from `if (splitMode === 'exact') {` to keep it as the first branch, this new block as `} else if (splitMode === 'percentage') {`.)

Finally, update the return statement (line 63) to carry `percentages` through:

```ts
    return { description, amount, payerId, participants, splitMode, shares, percentages: input.percentages, category, note };
```

- [ ] **Step 2: Persist `percentage_basis_points` in `createExpense`**

In `src/lib/actions/expenses.ts`, change the `expense_participants` insert in `createExpense` (lines 110-114):

```ts
  const { error: partError } = await supabase.from('expense_participants').insert(
    Object.entries(parsed.shares).map(([user_id, share_centavos]) => ({
      expense_id: expense.id, user_id, share_centavos,
      percentage_basis_points: parsed.percentages?.[user_id] ?? null,
    })),
  );
```

- [ ] **Step 3: Persist `percentage_basis_points` in `updateExpense`**

In `src/lib/actions/expenses.ts`, change the `expense_participants` reinsert in `updateExpense` (lines 210-214):

```ts
  await supabase.from('expense_participants').insert(
    Object.entries(parsed.shares).map(([user_id, share_centavos]) => ({
      expense_id: expenseId, user_id, share_centavos,
      percentage_basis_points: parsed.percentages?.[user_id] ?? null,
    })),
  );
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Run the full gate**

Run: `npm run gate -- --check`
Expected: `GATE GREEN` — confirms the build still succeeds and nothing else broke.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/expenses.ts
git commit -m "feat: persist percentage splits in create/update expense actions"
```

(Skip if no `.git` repo — see Task 1 Step 7 note.)

---

## UI handoff contract (for the other session — not a task in this plan)

Once Task 3 is done, `ExpenseForm.tsx` can add a percentage mode against this fixed contract:

- `<select name="split_mode">` gets a `<option value="percentage">`.
- When that's selected, submit one `percentage_${participantUserId}` field per participant, as a plain decimal string with up to 2 decimal places (e.g. `"33.33"`), for every id present in the `participants` field list. Client-side sum validation is optional — the server re-validates and returns `"One of the percentages is not a valid value between 0 and 100."` or `"Percentages add up to X% but an expense must add up to 100%"` via the existing form-error path (identical UX to how exact-amount mode surfaces its own errors today).
- When editing an existing percentage-split expense, each participant row from `getGroupBundle`/the expense-with-participants read already includes `percentage_basis_points: number | null` — divide by 100 to prefill the display percentage (`3333` → `33.33`).

---

## Plan self-review

**Spec coverage:** Section 1 (data model) → Task 1. Section 2 (split calculation) → Task 2. Section 3 (server action) → Task 3. Section 4 (testing) → Task 2 Step 1. Section 5 (migration numbering) → confirmed `0007` in Task 1. Section 6 (UI handoff) → documented above, not a task (out of this session's scope). "Out of scope" section (shares/parts, split-mode-conversion) → correctly has no task.

**Placeholder scan:** No TBD/TODO. Task 3 explicitly explains *why* it has no unit test (matches existing untested-action-file convention) rather than silently skipping testing.

**Type consistency:** `splitByPercentage(amount, participants, basisPoints)` — same name and parameter order used in Task 2's implementation, Task 2's tests, and Task 3's `computeShares` call. `ExpenseInput.percentages` / `ParsedExpense.percentages` / form field `percentage_${id}` — consistent naming across all three tasks. `ExpenseParticipant.percentage_basis_points` (Task 1) matches the column name used in Task 3's inserts.
