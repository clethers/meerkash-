# Multi-currency per group — design

## Context

Second of five Splitwise-parity sub-projects (see
`docs/superpowers/specs/2026-09-06-percentage-splitting-design.md` for the
full roadmap and session-split agreement: this session owns backend, a
parallel session owns UI). This one reverses half of PRD requirement 11
("PHP only, one currency per group") — the "PHP only" half. The "one
currency per group" half stays: no in-group currency mixing, no conversion.

## Current state (verified by reading the code, not assumed)

- `groups.currency` is `char(3) not null default 'PHP' check (currency = 'PHP')`
  (`0001_schema.sql`). `createGroup` never sets it explicitly — relies
  entirely on the column default. `updateGroup` never touches it. So
  currency is already, implicitly, set-once-at-creation and immutable —
  this design makes that explicit rather than introducing a new restriction.
- The balance engine (`src/lib/balance/*`) is **already currency-agnostic**:
  it operates on opaque integer "smallest units" and never references PHP or
  any currency concept in code (only in doc comments/examples). No change
  needed there.
- `src/lib/money.ts`'s `formatPHP()` hardcodes the ₱ symbol and `'en-PH'`
  locale — the only place currency is actually baked in on the backend.
- `getMyGroups()` (`src/lib/data/groups.ts:139`) already returns each
  group's full row (via `select('role, group:groups(*)')`), so
  `group.currency` is already available to every consumer — no data-layer
  change needed for currency to reach the UI.
- **Found a real cross-group bug this feature would introduce**:
  `src/app/(app)/groups/page.tsx:14` computes
  `groups.reduce((sum, g) => sum + g.balance, 0)` — one number summed across
  every group regardless of currency. Once groups can differ, this sum
  becomes meaningless. (UI-file fix, not in this plan's scope, but flagged
  here so the interface handoff carries it forward.)
- Three backend notification strings hardcode `formatPHP`:
  `src/lib/actions/expenses.ts:150`, `src/lib/actions/settlements.ts:81,134,135`.

## Design

### 1. Data model

New migration `supabase/migrations/0008_multi_currency.sql`:
```sql
alter table groups drop constraint groups_currency_check;
alter table groups add constraint groups_currency_check
  check (currency in ('PHP','USD','EUR','GBP','AUD','CAD','SGD','HKD','NZD','CHF'));
```
Default remains `'PHP'`. Currency stays immutable after group creation (no
`updateGroup` change) — expenses/settlements store raw integer amounts with
no per-row currency tag, so changing a group's currency retroactively would
silently corrupt every historical amount's meaning.

All ten listed currencies use 2 decimal places (100 minor units per major
unit) — the existing `PESO = 100` constant in `money.ts` applies unchanged
to every one of them. This was a deliberate scope choice: currencies with a
different minor-unit count (JPY, KRW, etc.) are excluded to avoid touching
that core assumption.

### 2. Curated currency list (`src/lib/constants.ts`)

```ts
export const CURRENCIES: Array<{ value: string; label: string }> = [
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
export const CURRENCY_CODES = CURRENCIES.map((c) => c.value);
```
Mirrors the existing `CATEGORIES`/`PAYMENT_METHODS` array-plus-derived-lookup
pattern already in this file. `Group.currency` (`src/types/db.ts:26`)
narrows from `string` to a `CurrencyCode` union type derived from this list.

### 3. Formatting (`src/lib/money.ts`)

```ts
export function formatMoney(centavos: Centavos, currencyCode: string, opts: { sign?: boolean } = {}): string {
  const negative = centavos < 0;
  const abs = Math.abs(centavos);
  const body = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(abs / PESO);
  if (negative) return `-${body}`;
  return opts.sign ? `+${body}` : body;
}
```
`formatPHP` is kept, unchanged in signature and behavior, reimplemented as
`formatMoney(centavos, 'PHP', opts)` internally. This is additive: none of
the 11 existing UI call sites break. Migrating them to
`formatMoney(amount, group.currency)` is the other session's work, on its
own schedule — not a breaking change forced by this plan.

`Intl.NumberFormat`'s exact symbol placement/spacing for PHP may differ
slightly from the current hand-rolled `formatPHP` (e.g. `"₱1,234.56"` vs
`"PHP 1,234.56"` depending on Node's ICU data) — this gets verified
empirically in the implementation plan's testing step before being locked
in as `formatPHP`'s new internal behavior, since `formatPHP`'s exact output
string must not silently change for existing PHP groups.

### 4. Backend call sites

`createGroup` (`src/lib/actions/groups.ts`): reads `formData.get('currency')`,
defaults to `'PHP'` if absent (so the current UI, which doesn't send this
field yet, keeps working unchanged), validates membership in
`CURRENCY_CODES` before insert, returns a friendly error otherwise. Explicit
insert of `currency` replaces reliance on the column default.

`expenses.ts:150` and `settlements.ts:81,134,135`: the four
`formatPHP(amount)` calls in notification bodies become
`formatMoney(amount, bundle.group.currency)` — `bundle` (from
`getGroupBundle`) is already in scope at all four call sites, carrying
`bundle.group.currency`.

## Out of scope

Currency conversion/exchange rates. Changing a group's currency after
creation. Zero-decimal or three-decimal currencies (JPY, KRW, BHD, etc.).
Fixing the cross-group "Overall" summary bug in `groups/page.tsx` (UI-file
fix — flagged in the interface handoff for the other session, not built
here).

## Interface handoff to the UI session

- `<select name="currency">` on the group-creation form, options from a
  shared `CURRENCIES` list (`src/lib/constants.ts`) — optional; omitting it
  defaults to `'PHP'`, so existing forms keep working unmodified.
- `formatMoney(centavos, currencyCode)` is now available from `@/lib/money`
  for any display that should honor a group's actual currency instead of
  always showing pesos.
- **The cross-group total bug**: `src/app/(app)/groups/page.tsx`'s
  `groups.reduce((sum, g) => sum + g.balance, 0)` needs to become a
  per-currency breakdown (group summaries by `group.currency`, format each
  bucket separately) rather than one flat sum — per the user's decision
  during this design's brainstorm.
