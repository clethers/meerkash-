# Glassmorphism + dark mode adaptation — design

## Context

AbonoShare's current visual system (from `docs/superpowers/specs/2026-09-10`-era
work, verified directly against today's code) is a "paper/receipt" theme:
flat `bg-paper` (`#eef2ee`) canvas, `.card` = `bg-receipt border-ink/15`, brand
green as the accent, a handwritten "meerkash." wordmark, and a receipt-styled
hero on the landing page. `AppDockClient.tsx` already has a partial glass
treatment (a local `GLASS` Tailwind string: `border-white/60 bg-white/40
backdrop-blur-lg backdrop-saturate-150` + an inset shadow) — this spec
generalizes that existing pattern into the shared design system instead of
inventing a new one.

This pass was designed collaboratively via five live Artifact mockups (login,
app shell, landing, account/signup/settings/spending, and iterative refinements)
before any code was written. Direction confirmed at each step:

1. **Blend, don't replace** the paper/receipt identity — brand green, the
   receipt visual, and the wordmark stay; frosted glass surfaces and an
   ambient gradient backdrop become the new "material" those elements sit on.
2. **Whole app** gets the treatment — landing, auth, and every in-app screen —
   not just one page.
3. **Perf/legibility is designed in, not bolted on**: exactly one
   `backdrop-filter` layer per surface, never nested (a card blurs; the
   buttons/inputs inside it are flat, solid-ish translucent fills, not their
   own blurred layer). List rows share one glass container instead of each
   row being its own card.
4. **Full OS-driven dark mode ships in this same pass** (decided explicitly —
   the app has zero `dark:` usage today, so this is new scope, not a free
   side effect of the glass pass).

Out of scope: the wordmark/logo files (`/logo.png`, `/wordmark.png`) — a
separate, already-in-progress session owns replacing these with a text
wordmark. Do not touch `<Image src="/logo.png" .../>` or `/wordmark.png`
usages in this pass.

## Token system

Two new Tailwind color tokens, added alongside the existing `brand` /
`paper` / `receipt` / `ink` scale in `tailwind.config.ts`:

| Token | Value | Purpose |
|---|---|---|
| `night` | `#07130e` | Dark-mode page canvas (replaces `paper` in dark) |

No other new tokens are needed — dark glass surfaces reuse the existing
`brand-950` (`#06261d`, already in the palette) at partial opacity, which is
visually almost identical to the `night` canvas, giving cards a "slightly
lighter than the page" feel exactly like the light-mode `receipt`-on-`paper`
relationship does today.

**Darkmode strategy:** Tailwind's default `media` strategy (`prefers-color-
scheme`), already relied on by the (unshipped) 2026-09-06 Honey Neutral spec
— no `darkMode: 'class'` config change, no in-app toggle. `tailwind.config.ts`
has no `darkMode` key today, so the default already applies.

### Shared primitive classes (`src/app/globals.css`)

```
.card       → the ONE blurred glass surface. Light: border-white/60
              bg-white/40 backdrop-blur-lg backdrop-saturate-150, shadow
              [0_8px_30px_rgba(31,41,55,.12),inset_0_1px_0_rgba(255,255,255,.6)].
              Dark: border-white/10 bg-brand-950/50, shadow
              [0_8px_30px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.06)].
.input      → FLAT (no backdrop-filter — it lives inside an already-blurred
              .card). Light: bg-white/55 border-ink/15. Dark: bg-white/6
              border-white/12 text-slate-100 placeholder:text-slate-500.
.label      → dark:text-slate-300 added.
.money-positive / .money-negative → dark:text-brand-400 / dark:text-rose-400
              added (brighter, for contrast on dark glass).
```

`body` canvas: `bg-paper dark:bg-night`. The flat canvas color is still the
base paint; the ambient gradient blobs (next section) sit on top of it as a
separate fixed layer, so on a browser without `backdrop-filter` support the
page still reads correctly (flat color, opaque cards) — a graceful fallback,
not a broken one.

### Ambient backdrop

A new `<AmbientBackdrop />` component (fixed, `z-index: -1`, four blurred
radial gradients in brand green / coral / sky / gold, slow 26–30s drift
animation, `prefers-reduced-motion` guard that freezes the drift) rendered
once per top-level layout: `(app)/layout.tsx`, `(auth)/layout.tsx`, and the
landing page. Exact gradient stops and colors are given in the plan (Task 2).

### The two hard rules (apply everywhere, no exceptions)

1. **No nested blur.** If an element's parent already has `backdrop-filter`,
   the child never gets its own `backdrop-filter` — it gets a flat
   `bg-white/opacity` (or `bg-white/6` in dark) fill instead. This is why
   `.input` has no blur even though it usually sits inside a `.card`, and why
   modal scrims (`bg-ink/40`) stay flat, not blurred, behind an
   already-blurred modal panel.
2. **One glass container per list, not per row.** Where a screen shows a
   list of similar items (friends, groups, notifications, expenses,
   settlements), the whole list is one `.card` with `divide-y` rows inside —
   never N separate `.card`s. Two real files violate this today and are
   fixed in this pass: `src/app/(app)/friends/page.tsx` and
   `src/app/(app)/groups/page.tsx`, both of which currently wrap each row in
   its own `<Link className="card ...">`.

## Page/component inventory

Reference mockups (Artifacts, for exact visual target — not code):
login, app shell (nav/dock/groups/friends/alerts/add-expense modal),
landing, and account screens (signup/groups-list/settings/spending/invite
modal) — five published Artifacts from this conversation.

In scope, grouped by how they pick up the change:

- **Free via shared primitives** (no code change beyond the dark: text pass
  described per-file in the plan): every screen using `.card`/`.input`/
  `.label` — roughly 30+ files per the codebase survey (stat tiles, forms,
  settle screens, member lists, recurring forms, activity page, etc.).
- **Bespoke structural/visual work** (own plan tasks): `AppNav.tsx` +
  `AppDockClient.tsx` (shared glass surface + dark pass), `(app)/layout.tsx`
  + `(auth)/layout.tsx` (backdrop wiring), landing page (backdrop + glass nav
  + glass feature cards, receipt stays solid paper on purpose), auth forms
  (Google button, OTP boxes), group overview cluster (`GroupHeader`,
  `BalanceSummary`, `ExpenseFilters`, `ExpenseRow`), friends/groups list
  consolidation (the two-file violation above), settings + personal spending
  charts, the three modals (`AddExpenseButton`, `CreateGroupForm`,
  `InviteFriendsModal`/`InvitePanel`) + `GlobalSearchOverlay`, and the shared
  `ui/` primitives (`Alert`, `Button`, `EmptyState`, `Skeleton`,
  `SectionLabel`).

Out of scope (explicitly, per the "blend not replace" decision): the receipt
visual on the landing page stays solid paper, not glass — it's the one
deliberately physical object in the scene. Wordmark/logo image replacement
(separate in-flight session). No new dependencies, no changes to server
actions, data layer, RLS, or the balance engine — this is a `src/app/**`,
`src/components/**`, `src/app/globals.css`, `tailwind.config.ts` visual pass
only, same boundary the 2026-09-06 redesign spec used.

## Testing

No logic changes anywhere in this pass, so `npm test` (vitest) must stay
green throughout untouched. `npm run typecheck` must stay clean after every
task. `npm run gate` (full check) before considering the pass done. Because
the gate can't see visual regressions or dark-mode contrast, every task also
gets a manual dev-server pass (Playwright, login `admin@abonoshare.app` /
`adminadmin`) checked in **both** light and dark (toggle via OS/browser
`prefers-color-scheme` emulation) before it's marked done — this is the
step that actually catches the "invisible dark text on dark glass" failure
mode this spec exists to avoid.

## Out of scope (this pass)

An in-app light/dark toggle (vs. following OS preference) — nothing asks for
one, matches the precedent set by the unshipped Honey Neutral spec. Pixel-
perfect dark-mode tuning of the least-visited screens (recurring forms,
expense edit, member management detail rows) beyond what the shared
primitive + text-color pass gives them for free — if something reads wrong
there after this ships, it's a fast follow, not a blocker for "at once."
