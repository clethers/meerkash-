# Percentage splitting — design

## Context

The user asked for AbonoShare to reach feature parity with Splitwise. That
request bundles five independent, differently-sized subsystems, three of
which reverse decisions this project made deliberately (see `docs/PRD.md`
requirement 35 and `docs/BACKLOG.md`'s "explicitly out of scope" section):

1. **Percentage splitting** (this spec) — additive, no conflict.
2. Multi-currency per group — reverses a hard schema constraint.
3. Friends / 1:1 balances outside groups — reverses requirement 2 ("everything
   belongs to a group").
4. Receipt OCR — needs a third-party vision/OCR API decision.
5. Real payment integration (GCash/Maya/bank) — not actually buildable as a
   coding task; real merchant API access needs business registration/KYC
   outside this session's scope. Will land as payment-app deep-linking
   instead, if pursued.

Agreed approach: each gets its own brainstorm → spec → plan → implementation
cycle, built in this order (least to most disruptive). This is sub-project 1.

**Session split**: this Claude Code session owns backend (schema, split
logic, server actions, types) for all five sub-projects; a parallel session
owns `src/components/` and `src/app/**/*.tsx` (UI). This spec is scoped to
the backend half only — section 6 documents the exact interface the UI side
builds against.

## Current state

- `expenses.split_mode` is a Postgres enum: `'equal' | 'exact'`
  (`supabase/migrations/0001_schema.sql`).
- `src/lib/balance/split.ts` has `splitEqually()` and `splitExactly()`, both
  `(amount: Centavos, participants: UserId[]) => Record<UserId, Centavos>`,
  and a `computeShares()` dispatcher keyed on `expense.splitMode`.
- `expense_participants` stores only `share_centavos` per participant — the
  computed result, not how it was entered.
- `src/lib/actions/expenses.ts`'s `parseExpenseForm()` reads mode-specific
  form fields (`share_${id}` for exact mode) and calls `computeShares()`.

## Design

### 1. Data model

New migration `supabase/migrations/0007_percentage_splits.sql`:

```sql
alter type split_mode add value 'percentage';

alter table expense_participants
  add column percentage_basis_points integer
    check (percentage_basis_points is null or percentage_basis_points between 0 and 10000);
```

Basis points (hundredths of a percent, `0`–`10000`) store 33.33% as `3333` —
integer-only, same philosophy as centavos, no float drift. Nullable: `equal`
and `exact` rows leave it `null`, completely unchanged from today.
`share_centavos` stays the single source of truth every other query (balance
engine, activity log, RLS-adjacent reads) already depends on — nothing
downstream needs to know percentage mode exists.

`alter type ... add value` must be its own migration file/statement (Postgres
forbids using a new enum value in the same transaction that adds it) — this
migration only adds the value, never uses it.

### 2. Split calculation (`src/lib/balance/split.ts`, `types.ts`)

```ts
export function splitByPercentage(
  amount: Centavos,
  participants: UserId[],
  basisPoints: Record<UserId, number>,
): Record<UserId, Centavos>
```

Validation, matching `splitExactly`'s style:
- Every participant must have an entry in `basisPoints`; entries for
  non-participants throw.
- Every value must be an integer in `[0, 10000]`.
- Values must sum to exactly `10000` (100.00%) — no tolerance, same as
  `splitExactly` requiring amounts to sum to the total exactly.

Calculation: `base = Math.floor(amount * bp / 10000)` per person, then the
leftover remainder (`amount - sum(base)`) is handed out one centavo at a time
in the same deterministic sorted-participant-id order `splitEqually` already
uses. This gives percentage splits the identical guarantee every other mode
has: shares always sum exactly to the total, identically on every machine.

`SplitMode` (`types.ts`) gains `'percentage'`. `ExpenseInput` gains
`percentages?: Record<UserId, number>` (basis points), alongside the existing
`exactShares`. `computeShares()` gets a third branch dispatching to
`splitByPercentage`.

### 3. Server action (`src/lib/actions/expenses.ts`)

`parseExpenseForm()` gains a `splitMode === 'percentage'` branch mirroring
the existing `'exact'` branch: reads `percentage_${id}` fields per
participant, parses each as a decimal string (`"33.33"`) into basis points
(`Math.round(parseFloat(raw) * 100)`), builds the `percentages` map, calls
`computeShares()` (which validates and throws `BalanceError` on a bad sum,
surfaced via the existing `readableError()` path — no new error handling
needed).

`createExpense()`'s single `expense_participants` insert, and
`updateExpense()`'s delete-then-reinsert of the same table (confirmed at
`src/lib/actions/expenses.ts:209-214` — edits fully replace participant rows,
they aren't patched in place), both gain
`percentage_basis_points: input.percentages?.[id] ?? null` per row. Both
existing read paths that load an expense with its participants already
`select('*, participants:expense_participants(*)')`
(`src/lib/data/groups.ts:81` and `src/lib/actions/expenses.ts:157`), so
`percentage_basis_points` comes back for free once the column exists — the
UI side reconstructs the actual entered percentages, not a lossy
recomputation from rounded centavos.

### 4. Testing (`tests/balance/split.test.ts`)

New `describe('splitByPercentage', ...)` block, matching the file's existing
style (flat `describe`/`it`, plain `expect`, local fixture helpers):

- Even thirds (33.33/33.33/33.34 bp-equivalent) on ₱1,000 sums to exactly
  100000 centavos.
- A single 100% participant gets the whole amount.
- A basis-point sum of 9999 or 10001 throws `BalanceError`.
- A basis-point map missing one participant, or including a non-participant,
  throws `BalanceError`.
- Zero participants throws `BalanceError`.
- Remainder distribution is deterministic and sorted, matching
  `splitEqually`'s existing remainder tests in the same file.

### 5. Migration numbering check

Current highest migration is `0006_rls_fixes.sql` (added mid-session by
another process — a legitimate RLS security fix, already applied to the
connected dev project). This spec's migration is `0007_percentage_splits.sql`.

### 6. Interface handoff to the UI session

Fixed contract the UI side builds `ExpenseForm.tsx`'s percentage inputs
against, independent of this implementation's internals:

- `<select name="split_mode">` gains an `<option value="percentage">`.
- When `split_mode=percentage`, submit one `percentage_${participantUserId}`
  form field per participant, as a decimal string with up to 2 decimal
  places (e.g. `"33.33"`), one per selected participant. Values need not be
  pre-validated client-side to sum to 100 — the server re-validates and
  returns a readable error (`"That split does not add up."` or similar) via
  the existing `ActionResult` error path if they don't, exactly like exact-
  amount mode does today.
- When editing an existing percentage-split expense, `share.percentage_basis_points`
  (an integer `0`–`10000`) is available per participant row for prefilling —
  divide by `100` to get the display percentage (`3333` → `33.33`).

## Out of scope for this sub-project

Shares/parts splitting (the other Splitwise non-equal mode) — the user chose
percentages only. Editing the *split mode* of an existing expense after
creation (e.g. converting an equal-split expense to percentage) is already
supported generically today (whatever `updateExpense` currently allows for
switching between `equal`/`exact` extends unchanged to `percentage`).
