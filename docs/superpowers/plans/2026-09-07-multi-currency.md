# Multi-Currency Per Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a group be created in any of ten curated 2-decimal currencies instead of PHP-only, backend-only (schema, formatting, server actions). The other Claude Code session builds the currency-selection UI and fixes the cross-group total display.

**Architecture:** Widen `groups.currency`'s check constraint from `= 'PHP'` to a curated 10-currency allow-list. Add a currency-aware `formatMoney()` alongside the existing `formatPHP()` (kept unchanged for backward compatibility). Thread each group's actual currency into the three backend-generated notification strings that currently hardcode pesos. The balance engine needs zero changes — it already works in currency-agnostic integer units.

**Tech Stack:** Next.js 15 server actions, Supabase/Postgres, Vitest, TypeScript, `Intl.NumberFormat`.

**Spec:** `docs/superpowers/specs/2026-09-07-multi-currency-design.md`

## Global Constraints

- Currency is set once at group creation and is immutable thereafter — no task adds a way to change an existing group's currency.
- Only these ten codes are valid, all 2-decimal-minor-unit currencies: `PHP, USD, EUR, GBP, AUD, CAD, SGD, HKD, NZD, CHF`.
- `formatPHP()`'s existing signature and output must not change for any existing caller — it is reimplemented in terms of the new `formatMoney()`, not removed or renamed.
- Do not touch `src/components/` or `src/app/**/*.tsx` — that is the other session's territory. This includes the known cross-group-total bug in `src/app/(app)/groups/page.tsx` — flag it in the handoff, don't fix it here.
- Match existing code style: the `CATEGORIES`/`CATEGORY_LABEL` array-plus-derived-map pattern in `src/lib/constants.ts`, flat Vitest `describe`/`it` blocks, no new test infrastructure.

---

## Task 1: Database migration + curated currency list + type mirrors

**Files:**
- Create: `supabase/migrations/0008_multi_currency.sql`
- Modify: `src/lib/constants.ts` (add `CURRENCIES` and `CURRENCY_CODES`)
- Modify: `src/types/db.ts` (narrow `Group.currency` to a `CurrencyCode` union)

**Interfaces:**
- Produces: `CurrencyCode = 'PHP' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'SGD' | 'HKD' | 'NZD' | 'CHF'` (exported from `src/types/db.ts`); `CURRENCIES: Array<{ value: CurrencyCode; label: string }>` and `CURRENCY_CODES: CurrencyCode[]` (exported from `src/lib/constants.ts`). Tasks 2 and 3 consume `CURRENCY_CODES`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0008_multi_currency.sql`:

```sql
-- ============================================================================
-- AbonoShare — multi-currency per group
--
-- Relaxes the PHP-only restriction while keeping the other half of
-- requirement 11 intact: one currency per group, no mixing, no conversion.
-- Currency is set once at group creation and is immutable — expenses and
-- settlements store raw integer amounts with no per-row currency tag, so
-- changing a group's currency after expenses exist would silently corrupt
-- every historical amount's meaning.
--
-- All ten currencies use 2 decimal places (100 minor units per major unit),
-- so the existing PESO = 100 integer-centavos convention in src/lib/money.ts
-- applies unchanged to every one of them. Currencies with a different
-- minor-unit count (JPY, KRW, etc.) are deliberately excluded.
-- ============================================================================
alter table groups drop constraint groups_currency_check;
alter table groups add constraint groups_currency_check
  check (currency in ('PHP','USD','EUR','GBP','AUD','CAD','SGD','HKD','NZD','CHF'));
```

- [ ] **Step 2: Add the curated currency list**

In `src/lib/constants.ts`, add after the existing `PAYMENT_METHOD_LABEL` block (after line 34) and before `RECURRENCES`:

```ts
export const CURRENCIES: Array<{ value: CurrencyCode; label: string }> = [
  { value: 'PHP', label: 'Philippine Peso' },
  { value: 'USD', label: 'US Dollar' },
  { value: 'EUR', label: 'Euro' },
  { value: 'GBP', label: 'British Pound' },
  { value: 'AUD', label: 'Australian Dollar' },
  { value: 'CAD', label: 'Canadian Dollar' },
  { value: 'SGD', label: 'Singapore Dollar' },
  { value: 'HKD', label: 'Hong Kong Dollar' },
  { value: 'NZD', label: 'New Zealand Dollar' },
  { value: 'CHF', label: 'Swiss Franc' },
];

export const CURRENCY_CODES: CurrencyCode[] = CURRENCIES.map((c) => c.value);
```

Add `CurrencyCode` to the existing import from `@/types/db` at the top of the file (currently `import type { ExpenseCategory, PaymentMethod, Recurrence } from '@/types/db';` — change to also import `CurrencyCode`).

- [ ] **Step 3: Narrow the `Group.currency` type**

In `src/types/db.ts`, add near the other mode/status union types (near line 3, alongside `SplitModeDb`):

```ts
export type CurrencyCode = 'PHP' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'SGD' | 'HKD' | 'NZD' | 'CHF';
```

Then change the `Group` interface's `currency` field (currently `currency: string;`) to:

```ts
  currency: CurrencyCode;
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Apply the migration to the connected Supabase project**

```bash
npx supabase db push --db-url "<the session pooler connection string for this project, port 5432>" --include-all
```

Expected: `Applying migration 0008_multi_currency.sql...` then success.

- [ ] **Step 6: Verify the constraint**

```bash
curl -s -X POST "https://sabufeqgqzffizczpofc.supabase.co/rest/v1/rpc/pg_typeof" 2>/dev/null; \
curl -s "https://sabufeqgqzffizczpofc.supabase.co/rest/v1/groups?select=currency&limit=1" \
  -H "apikey: <the NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local>"
```

Expected: `[]` (empty array — RLS correctly returns zero rows to an anonymous request; confirms the table is still queryable and the migration didn't break anything). A more direct constraint check: insert a test row with an invalid currency via the admin/service-role client and confirm Postgres rejects it — optional, skip if time-constrained, since Step 5's successful `db push` already proves the DDL applied without error.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0008_multi_currency.sql src/lib/constants.ts src/types/db.ts
git commit -m "feat: allow 10 curated currencies per group instead of PHP-only"
```

(Skip if no `.git` repo — note that to the user instead of running `git commit`.)

---

## Task 2: `formatMoney` in the money engine

**Files:**
- Modify: `src/lib/money.ts`
- Test: `tests/balance/money.test.ts`

**Interfaces:**
- Produces: `formatMoney(centavos: Centavos, currencyCode: string, opts?: { sign?: boolean }): string`, exported from `@/lib/money`. `formatPHP(centavos, opts?)` keeps its exact existing signature and output — reimplemented as `formatMoney(centavos, 'PHP', opts)`. Task 3 consumes `formatMoney`.

- [ ] **Step 1: Read the existing test file's conventions**

Open `tests/balance/money.test.ts` and note its style before writing new tests (flat `describe`/`it`, plain `expect`, matching the rest of `tests/balance/`).

- [ ] **Step 2: Write the failing tests**

Add to `tests/balance/money.test.ts`:

```ts
describe('formatMoney', () => {
  it('formats PHP identically to formatPHP', () => {
    expect(formatMoney(123_456, 'PHP')).toBe(formatPHP(123_456));
    expect(formatMoney(-123_456, 'PHP')).toBe(formatPHP(-123_456));
    expect(formatMoney(123_456, 'PHP', { sign: true })).toBe(formatPHP(123_456, { sign: true }));
  });

  it('formats USD with a dollar sign', () => {
    expect(formatMoney(123_456, 'USD')).toBe('$1,234.56');
  });

  it('formats EUR with a euro sign', () => {
    expect(formatMoney(123_456, 'EUR')).toBe('€1,234.56');
  });

  it('handles negative amounts', () => {
    expect(formatMoney(-50_000, 'USD')).toBe('-$500.00');
  });

  it('adds a plus sign when requested', () => {
    expect(formatMoney(50_000, 'USD', { sign: true })).toBe('+$500.00');
  });
});
```

Update the import line at the top of `tests/balance/money.test.ts` to include both functions (find the existing import from `@/lib/money` and add `formatMoney` to it).

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/balance/money.test.ts`
Expected: FAIL — `formatMoney is not a function` / `is not exported`.

- [ ] **Step 4: Implement `formatMoney`**

In `src/lib/money.ts`, add after the existing `formatPHP` function:

```ts
/** Currency-aware version of formatPHP. `currencyCode` is a 3-letter ISO 4217 code, e.g. 'USD'. */
export function formatMoney(
  centavos: Centavos,
  currencyCode: string,
  opts: { sign?: boolean } = {},
): string {
  const negative = centavos < 0;
  const abs = Math.abs(centavos);
  const body = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(
    abs / PESO,
  );
  if (negative) return `-${body}`;
  return opts.sign ? `+${body}` : body;
}
```

Then replace the existing `formatPHP` function body to delegate to it, keeping its exact signature:

```ts
/** 123456 -> "₱1,234.56" */
export function formatPHP(centavos: Centavos, opts: { sign?: boolean } = {}): string {
  return formatMoney(centavos, 'PHP', opts);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/balance/money.test.ts`
Expected: PASS, all tests including the 5 new ones.

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/money.ts tests/balance/money.test.ts
git commit -m "feat: add currency-aware formatMoney, reimplement formatPHP on top of it"
```

(Skip if no `.git` repo.)

---

## Task 3: Currency at group creation + notification bodies

**Files:**
- Modify: `src/lib/actions/groups.ts:11-28` (`createGroup`)
- Modify: `src/lib/actions/expenses.ts:150` (notification body in `createExpense`)
- Modify: `src/lib/actions/settlements.ts:81` (notification title in `createSettlement`)
- Modify: `src/lib/actions/settlements.ts:90-141` (`respond`, used by both confirm and reject — notification titles at lines 134-135)

**Interfaces:**
- Consumes: `formatMoney` (Task 2), `CURRENCY_CODES` (Task 1), `CurrencyCode` (Task 1).
- Produces: nothing further downstream — this is the last backend task for this sub-project.

**Important correction to note**: only `createSettlement` (settlements.ts) already has a `bundle` in scope (from `getGroupBundle(groupId)` at line 28) carrying `bundle.group.currency`. `createExpense` (expenses.ts) and `respond` (settlements.ts) do **not** call `getGroupBundle` — calling it just to read one column would be wasteful (it runs 4-5 queries and builds the full ledger). Both need a small, targeted `groups` currency lookup instead, matching the existing lightweight-query style already used in this file (e.g. `respond`'s own `profiles.select('display_name')` lookup at settlements.ts:118-119).

**No unit test for this task** — same reasoning as the equivalent task in the percentage-splitting plan: this codebase has no tests for `src/lib/actions/*.ts` (server actions require a real Next.js request context for `next/headers`-based cookies, which there's no mocking infrastructure for). Verification is typecheck + the full gate + manual smoke test once the UI exists.

- [ ] **Step 1: Validate and persist currency in `createGroup`**

In `src/lib/actions/groups.ts`, add the import at the top of the file: `import { CURRENCY_CODES } from '@/lib/constants';` and `import type { CurrencyCode } from '@/types/db';` (check the existing import block first — merge into it if a `@/lib/constants` or `@/types/db` import already exists rather than adding a duplicate line).

Then in `createGroup` (currently lines 11-28), insert after the existing `const name = ...` line (line 20) and before the `groups` insert (line 22):

```ts
  const currencyRaw = String(formData.get('currency') ?? 'PHP').toUpperCase();
  if (!CURRENCY_CODES.includes(currencyRaw as CurrencyCode)) {
    return fail(`"${currencyRaw}" is not a supported currency.`);
  }
  const currency = currencyRaw as CurrencyCode;
```

Then change the `groups` insert (currently `.insert({ name, owner_id: user.id, created_by: user.id })`) to:

```ts
    .insert({ name, currency, owner_id: user.id, created_by: user.id })
```

(This preserves current behavior exactly when no `currency` field is submitted — it defaults to `'PHP'`, identical to today's implicit column-default behavior.)

- [ ] **Step 2: Thread currency into `createExpense`'s notification**

In `src/lib/actions/expenses.ts`, change the import line (currently `import { formatPHP, toCentavos } from '@/lib/money';`) to:

```ts
import { formatMoney, toCentavos } from '@/lib/money';
```

`supabase` isn't created until line 104 (`const supabase = await createClient();`), so the currency lookup has to go after that. Immediately after `if (!user) return fail('You are not signed in.');` (line 106), add:

```ts
  const { data: groupRow } = await supabase.from('groups').select('currency').eq('id', groupId).maybeSingle();
  const currency = groupRow?.currency ?? 'PHP';
```

Then change line 150 from:
```ts
    body: `${formatPHP(parsed.amount)} — your balance changed.`,
```
to:
```ts
    body: `${formatMoney(parsed.amount, currency)} — your balance changed.`,
```

- [ ] **Step 3: Thread currency into `createSettlement`'s notification**

In `src/lib/actions/settlements.ts`, change the import line (currently `import { formatPHP, toCentavos } from '@/lib/money';`) to:

```ts
import { formatMoney, toCentavos } from '@/lib/money';
```

In `createSettlement`, `bundle` is already fetched at line 28 and carries `bundle.group.currency` (per `GroupBundle` in `src/lib/data/groups.ts:20-21` — no new query needed here). Change line 81 from:
```ts
    title: `${bundle.me.display_name} says they paid you ${formatPHP(amount)}`,
```
to:
```ts
    title: `${bundle.me.display_name} says they paid you ${formatMoney(amount, bundle.group.currency)}`,
```

- [ ] **Step 4: Thread currency into `respond`'s notifications**

`respond` (same file) has no `bundle` — it only fetches `settlement` (line 99-103) and `me`'s display name (line 118-119). Add a currency lookup. After the existing `if (settlement.status !== 'pending') return fail('That settlement was already answered.');` line (line 109), add:

```ts
  const { data: groupRow } = await supabase.from('groups').select('currency').eq('id', groupId).maybeSingle();
  const currency = groupRow?.currency ?? 'PHP';
```

Then change lines 134-135 from:
```ts
        ? `${me?.display_name ?? 'They'} confirmed your ${formatPHP(settlement.amount_centavos)} payment`
        : `${me?.display_name ?? 'They'} rejected your ${formatPHP(settlement.amount_centavos)} payment`,
```
to:
```ts
        ? `${me?.display_name ?? 'They'} confirmed your ${formatMoney(settlement.amount_centavos, currency)} payment`
        : `${me?.display_name ?? 'They'} rejected your ${formatMoney(settlement.amount_centavos, currency)} payment`,
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Run the full gate**

Run: `npm run gate -- --check`
Expected: `GATE GREEN`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/groups.ts src/lib/actions/expenses.ts src/lib/actions/settlements.ts
git commit -m "feat: validate group currency at creation, use it in notification text"
```

(Skip if no `.git` repo.)

---

## UI handoff contract (for the other session — not a task in this plan)

- Optional `<select name="currency">` on the group-creation form, options from `CURRENCIES` (`src/lib/constants.ts`). Omitting the field defaults to `'PHP'` — no existing form breaks.
- `formatMoney(centavos, currencyCode)` is now exported from `@/lib/money` for any UI display that should honor a group's real currency instead of always showing pesos.
- **Known bug to fix**: `src/app/(app)/groups/page.tsx`'s `groups.reduce((sum, g) => sum + g.balance, 0)` sums balances across groups regardless of currency. Per the user's decision during this sub-project's brainstorm, this should become a per-currency breakdown (group the summaries by `group.currency`, format and display each currency's total separately) rather than one combined sum.

## Plan self-review

**Spec coverage:** Section 1 (data model) → Task 1. Section 2 (curated list) → Task 1. Section 3 (formatting) → Task 2. Section 4 (backend call sites) → Task 3. "Out of scope" section → correctly has no task. "Interface handoff" → documented above.

**Placeholder scan:** No TBD/TODO. Task 3 documents and corrects a factual error carried over from the spec (the "`bundle` in scope at all four call sites" claim was only true for one of the three call sites) rather than silently repeating it.

**Type consistency:** `formatMoney(centavos, currencyCode, opts?)` — same signature used in Task 2's implementation, its tests, and all three of Task 3's call sites. `CurrencyCode`/`CURRENCY_CODES`/`CURRENCIES` — consistent names across Tasks 1 and 3. `bundle.group.currency` vs. the two ad-hoc `groupRow.currency` lookups — both resolve to the same `CurrencyCode` type from `Group`/the targeted `select('currency')`.
