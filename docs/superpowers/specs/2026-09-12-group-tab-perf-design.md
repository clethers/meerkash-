# Group tab data-fetching — design

## Context

Reported symptom: switching between a group's tabs (Overview, Activity,
Spending, Members, Recurring, Settings — the row rendered by
`GroupHeader` in `src/components/groups/GroupHeader.tsx`) feels slow.

Investigation found two separate causes:

1. **Redundant Auth-server round trip on every navigation.** `src/middleware.ts`
   calls `supabase.auth.getUser()` on every request, and the `(app)` layout's
   `getAuthUser()` (`src/lib/data/groups.ts`) called it again — a second,
   independent network round trip to Supabase's Auth server, since middleware
   runs in a separate execution context that React's `cache()` can't dedupe
   against. This cost is fixed per navigation, independent of data volume,
   which is why the app felt slow even with no expenses/settlements in the
   database yet. **Already fixed and shipped**: middleware now forwards the
   verified user id via an `x-user-id` request header; `getAuthUser()` reads
   it first and only falls back to its own `getUser()` call when absent. Same
   security guarantee (still server-verified once per request), one fewer
   round trip per click.

2. **Over-fetching per tab.** All six tab pages call the same
   `getGroupBundle(groupId)` (`src/lib/data/groups.ts`), which runs 5 parallel
   Supabase queries — group, members+profiles, **all expenses with
   participant rows**, **all settlements**, current user — and computes a
   full balance ledger, on every click, regardless of what that tab actually
   renders. This is the subject of this spec. It didn't explain the
   "slow with zero data" symptom (fix #1 did), but it's real, unnecessary
   work that will matter as soon as a group has real expense history, and the
   design for it was already worked out during investigation.

Per-tab data audit (read from each page's source):

| Tab | needs group+members | needs expenses/settlements/ledger |
|---|---|---|
| Settings | yes | no |
| Recurring | yes | no |
| Activity | yes | no |
| Spending | yes (chart data comes from separate `getSpendingSummary`) | no |
| Members | yes | yes (net balances) |
| Overview | yes | yes |

Four of six tabs never touch expense/settlement data today — they only pay
for it.

**Scope, decided during brainstorming:** touch only the 6 group-tab pages.
`getGroupBundle` stays exactly as-is for its other 12 callers (server
actions in `lib/actions/expenses.ts`/`groups.ts`/`settlements.ts`,
`lib/data/spending.ts`, `lib/data/friends.ts`, and the non-tab pages under
`[groupId]/` — expenses new/edit/detail, settle, settle/[userId],
glass-preview). Those are unrelated to the tab-switch complaint and touching
them would be unjustified risk. Query trimming (below) is bundled into this
same pass since it's a small addition to the same functions this work is
already touching.

## Design

### New data-layer functions (`src/lib/data/groups.ts`)

Added alongside `getGroupBundle`, not replacing it:

- **`getGroupCore(groupId)`** — group row, current user, role, full members
  list with profiles. Two Supabase queries (group, members), reusing
  `getCurrentUser()`'s existing `cache()`. Returns `null` under the same
  conditions `getGroupBundle` does today (group not found / deleted, or
  viewer not an active member) so the "not a member → 404" behavior is
  unchanged. Wrapped in React `cache()`.

- **`getGroupLedger(groupId)`** — expenses (with participants) + settlements
  + the computed ledger, for the two tabs that show balances. Same shape as
  the corresponding fields on `GroupBundle` today. Changes from how
  `getGroupBundle` fetches this, folded in per the "include trimming" scope
  decision — with one correction found while reading the consuming
  components: `ExpenseFilters.tsx` has a real `includeDeleted` toggle that
  expects deleted expense rows to still be present in the array it's given
  (`src/components/expenses/ExpenseFilters.tsx:33,43`), so the expenses
  query must keep fetching deleted rows exactly as `getGroupBundle` does
  today. No component reads a deleted *settlement*, so that filter is safe.
  - Settlements query: filter `deleted_at is null` server-side
    (`.is('deleted_at', null)`) instead of fetching soft-deleted rows and
    filtering them out in JS.
  - Expenses query: **no** `deleted_at` filter — unchanged from
    `getGroupBundle`, to preserve `ExpenseFilters`' show-deleted toggle.
  - Cap rows with `.limit(500)` on both the expenses and settlements
    queries, matching the existing pattern in `getActivity(groupId, limit = 50)`.
  Wrapped in React `cache()`.

Both functions live next to `getGroupBundle` and share its `toExpenseInput`/
`toSettlementInput` helpers — no duplication of the ledger-building logic
itself (`buildLedger` from `src/lib/balance`).

### Layout (`src/app/(app)/groups/[groupId]/layout.tsx`, new file)

Calls `getGroupCore(groupId)` and does the "not found / not a member" guard
(`notFound()`) once, centralizing a check that's currently duplicated across
all 6 pages. Because `getGroupCore` is `cache()`-wrapped, a page that also
calls it within the same render doesn't cost a second query — but the
layout's main job here is correctness/centralization, not a caching
guarantee. (Whether Next's client router cache additionally skips
re-invoking this across sibling-tab navigations depends on `staleTimes`
config, which this project doesn't set — that's a possible future tuning
knob, not something this change relies on or promises.)

### Per-page changes

Each of the 6 pages replaces its `getGroupBundle` call:

- **Settings, Recurring, Activity, Spending** → `getGroupCore` only. They
  stop fetching expenses/settlements/ledger entirely.
- **Members, Overview** → `getGroupCore` + `getGroupLedger`.

No page's rendered output changes. `GroupHeader`'s props (`group`,
`memberCount`, `current`) are populated the same way as today, just sourced
from `getGroupCore` instead of `getGroupBundle`. Each page's own use of
bundle fields (e.g. Members' `netFor(bundle.ledger.net, ...)`, Overview's
`ExpenseFilters`/`BalanceSummary` props) is remapped to the equivalent field
on the combined `getGroupCore`/`getGroupLedger` results — same values, same
shapes, different source functions.

## Error handling

Identical to today. `getGroupCore` returns `null` under exactly the
conditions `getGroupBundle` does now (group deleted/not found, viewer not an
active member); the layout's `notFound()` call produces the same 404 before
any tab-specific code runs. `getGroupLedger` has no independent not-found
case — it's only called after the layout has already confirmed membership.

## Testing

- `npm run typecheck` and `npm run test` (no existing test coverage
  specifically targets these pages or `getGroupBundle`, so no test file is
  expected to need updates — this is a data-fetching refactor behind
  existing, unchanged rendered output).
- Manual walkthrough of all 6 tabs: values match what they show today (no
  visual diff expected — balances, member list, settings values, recurring
  reminders, activity feed all identical).
- Confirm via Supabase logs / Network tab that Settings, Recurring, Activity,
  and Spending no longer trigger expense/settlement queries.
