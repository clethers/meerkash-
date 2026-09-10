# UI/UX redesign — "Honey Neutral, warm & friendly" — design

## Context

AbonoShare is functionally complete: all 35 PRD requirements are implemented and
`npm run gate -- --check` is green. This spec covers a presentation-only
redesign pass — no changes to server actions, data layer, RLS, or the balance
engine. It runs alongside a parallel effort (a different session) working
through `docs/BACKLOG.md` correctness items in `supabase/` and `tests/`; this
spec touches only `src/components/`, `src/app/**/*.tsx`, `src/app/globals.css`,
and `tailwind.config.ts`.

Chosen direction, from a visual brainstorming session with mockups: **warm &
friendly**, keeping the existing green brand color as the anchor, palette
name **Honey Neutral**, supporting both light and dark mode from the start.

## Color tokens

Replace the current ad-hoc slate/rose usage with named Tailwind theme tokens
so every component reads from one palette. Add to `tailwind.config.ts`:

| Token | Light | Dark |
|---|---|---|
| `bg` | `#FAF8F4` | `#1F1B14` |
| `surface` | `#FFFDF9` | `#2A251C` |
| `surface-border` | `#EEE6D6` | `#3A3326` |
| `ink` (text primary) | `#3A342A` | `#F5EFE2` |
| `ink-muted` | `#8A8070` | `#B8AD94` |
| `honey` (sparing accent) | `#E8B94A` | `#F0C868` |

`brand` (green, existing 50–950 scale) is unchanged and stays the anchor color
for positive balances, primary actions, and focus rings. `rose-600` stays the
negative-balance / destructive color, with a `dark:` variant (`rose-400`) for
contrast on dark backgrounds.

Dark mode ships via Tailwind's `dark:` variants driven by `prefers-color-scheme`
(class-based dark mode is not needed — there's no in-app theme toggle in
scope), so every updated component gets a `dark:` counterpart for its color
classes, not a parallel component.

## Typography

- Body text: unchanged system-font stack (`ui-sans-serif, system-ui, ...`).
- New: **Nunito**, loaded via `next/font/google` (self-hosted at build, no
  runtime request, no layout shift), applied only to page titles, section
  headings, and the primary balance statement (e.g. "John owes you ₱500").
  Everything else keeps the system font.

## Shape & elevation

Radii and spacing stay close to current values (already reasonably rounded):
16–20px card radius, 12–14px button/input radius, full-round avatars. What
changes is border and shadow color — warm-tinted (`surface-border`, a
warm-tinted shadow) instead of cool slate.

## Shared primitives (updated once, cascades everywhere)

- `src/app/globals.css` — `.card`, `.label`, `.input`, `.money-positive`,
  `.money-negative` updated to the new tokens, each with a `dark:` pair.
- `tailwind.config.ts` — add the token colors above.
- `src/components/ui/Button.tsx`, `Alert.tsx`, `Avatar.tsx`, `EmptyState.tsx`,
  `SubmitButton.tsx` — restyled to the new tokens; no prop/API changes.
- Root layout (`src/app/layout.tsx`) — wires up the Nunito font via
  `next/font/google` and exposes it as a CSS variable/Tailwind font family
  (e.g. `font-display`), alongside the existing `--font-sans`.

Updating these is what makes every other page in the app (groups list, auth,
notifications, activity, settings) look better automatically, even though only
three screens get a bespoke layout pass below.

## Screen 1 — Group dashboard ("People First" layout)

Files: `src/app/(app)/groups/[groupId]/page.tsx`, `GroupHeader.tsx`,
`BalanceSummary.tsx`.

`GroupHeader` already has the right bones — group name + avatar, a member
count line, and a tab strip (Overview / Activity / Members / Recurring /
Settings). This pass keeps that tab set (just restyled to the new tokens) and
adds one new element: an overlapping avatar stack of the group's members
(replacing the single group avatar, or sitting alongside it) so the page
leads with *who's in this* before the numbers — that's the "People First"
part. Layout, top to bottom:

1. Group name (Nunito) + member avatar stack.
2. Existing tab strip (Overview / Activity / Members / Recurring / Settings),
   restyled — same hrefs and active-state logic, new colors only.
3. Compact balance line ("John owes you ₱500") in Nunito, brand-green —
   `BalanceSummary` restyled, not restructured.
4. The pending-settlement banner, the three stat cards, the Add
   expense/Settle up buttons, the expense list (`ExpenseFilters`), and recent
   settlements — all keep their current order and data, restyled to the new
   tokens (including `ExpenseRow.tsx`, `StatusPill`, and the local `Stat`
   component in `page.tsx`).

No new data is fetched and no props change — this is a restyle plus one
addition (the avatar stack), not a restructure.

## Screen 2 — Expense form

File: `src/components/expenses/ExpenseForm.tsx`.

Visually group the form into distinct sections (card-per-section, not one
long form): **What & how much** (name, amount, category with honey-accented
category chips), **Who paid**, **Split between** (participant toggles +
equal/exact split control), **Receipt & note**. No field additions, removals,
or validation changes — `ExpenseFilters.tsx` and `ExpenseRow.tsx` pick up the
shared token/primitive updates but aren't otherwise restructured this pass.

## Screen 3 — Settle up

Files: `src/components/settlements/SettleForm.tsx`,
`src/app/(app)/groups/[groupId]/settle/*`.

Confirm and reject actions must be visually unambiguous: confirm as the solid
brand-green primary button, reject as a neutral/outline button — never two
same-weight buttons. Pre-filled amount and payment method keep their current
behavior; only the visual treatment changes.

## Testing

No logic changes, so the existing test suite (`vitest run`, balance engine
tests in `tests/balance/`) is unaffected and must stay green throughout. The
gate (`npm run gate -- --check`: unit tests, `tsc --noEmit`, `next build`,
stub scan) is the pass/fail bar — same as any other change to this repo. In
addition, the dev server is run and all three screens are clicked through in
both light and dark (OS-level `prefers-color-scheme`) before this is called
done, since the gate can't see visual regressions.

## Out of scope (this pass)

Groups list page, auth pages, notifications, activity log, group settings,
recurring forms, invite panel — get the primitive/token improvements for free
but no bespoke layout redesign. A follow-up pass can extend the same system to
these once this round is reviewed. An in-app light/dark toggle (vs. following
OS preference) is also out of scope — nothing in the current PRD/backlog asks
for one.
