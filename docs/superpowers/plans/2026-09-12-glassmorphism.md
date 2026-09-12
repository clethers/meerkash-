# Glassmorphism + Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the whole app (landing, auth, and every in-app screen) with a frosted-glass visual system over an ambient gradient backdrop, blended with the existing brand/receipt identity, and ship full dark mode alongside it — in one pass.

**Architecture:** A small set of shared primitives (`globals.css` tokens, one `<AmbientBackdrop>` component, one `GLASS_SURFACE` Tailwind string) does most of the work by cascading into ~30 screens that already use `.card`/`.input`/`.label`. On top of that, a per-file `dark:` text/border/background pass (a fixed, mechanical substitution table, given once below and applied file-by-file) makes every screen legible in dark mode. Two files get a structural fix (per-row cards → one shared list card) as part of this pass. No server actions, data layer, or business logic changes anywhere.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS 3.4, TypeScript, CSS Modules (for the two bespoke visual files: `landing.module.css`, `AmbientBackdrop.module.css`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-12-glassmorphism-design.md`

**Reconciled with concurrent work:** a separate in-flight session has already (uncommitted) added `darkMode: 'class'` to `tailwind.config.ts`, a `<ThemeToggle>` component (flips the `dark` class on `<html>`, persists to `localStorage`, applied pre-hydration via a script in `src/app/layout.tsx`), and a `<Wordmark>` component. This plan **adopts** that work rather than assuming Tailwind's OS-driven `media` strategy or building its own toggle:
- Every `dark:` Tailwind utility class in this plan works identically under `class` or `media` strategy — only the trigger differs — so none of the many `dark:` JSX classes below need to change.
- The two files that use **raw CSS media queries** instead of Tailwind (`AmbientBackdrop.module.css`, `landing.module.css`) do need different selectors — `:global(.dark) .foo` instead of `@media (prefers-color-scheme: dark) { .foo { ... } }` — called out explicitly in Tasks 2 and 4.
- Task 1 no longer adds `darkMode` to `tailwind.config.ts` (already present) — it only adds the `night` color token, additively, without disturbing the existing `darkMode: 'class'` or `fontFamily.display` lines.
- Task 3 wires the existing `<ThemeToggle>` into the new glass top nav (it isn't rendered anywhere yet).
- `<Wordmark>` is NOT touched or integrated by this plan — that stays with the session that owns it, per the Global Constraints below.

## Global Constraints

- No changes to server actions, `src/lib/data/**`, `src/lib/actions/**`, RLS, or the balance engine — visual layer only (`src/app/**/*.tsx`, `src/components/**`, `src/app/globals.css`, `tailwind.config.ts`, `landing.module.css`).
- Do not touch `<Image src="/logo.png" .../>` or `/wordmark.png` usages, and do not wire in `<Wordmark>` — a separate in-flight session owns wordmark replacement end-to-end.
- Do not touch anything under `src/components/settlements/`, `src/lib/spendingSummary.ts`, `supabase/migrations/0016_*`, or `scripts/*qr*` — an unrelated payment-QR feature is mid-flight, uncommitted, in this same tree.
- **No nested blur**: an element never gets its own `backdrop-blur-*` if its parent already has one. Buttons/inputs/badges inside a `.card` stay flat.
- **One glass container per list, not per row.** Friends and Groups lists move from per-row `.card` to one `.card` with `divide-y` rows (Task 7).
- `npm run typecheck` must stay clean after every task. `npm test` (vitest) must stay green throughout — no logic changed, so any failure means something broke.
- Before starting Task 1, run `git status` and confirm with the user which currently-uncommitted files are safe to build on top of vs. still actively changing elsewhere — this tree has multiple concurrent sessions' uncommitted work in it right now.
- Verify every task with the dev server (`npm run dev`; check `netstat -ano | grep 3000` first — don't run `npm run gate`/`next build` while `next dev` is running, shared `.next` dir corrupts) via Playwright, logged in as `admin@abonoshare.app` / `adminadmin`, in **both** light and dark — toggle via the in-app `<ThemeToggle>` button, not OS/browser emulation (that only works for `media`-strategy dark mode, which this app no longer uses). Screenshot both. On pages with no nav (landing `/`, `/login`, `/signup` — `<ThemeToggle>` only lives in the app-shell nav, wired in Task 3), force dark mode instead via the browser console: `localStorage.setItem('theme','dark'); location.reload();` (and `localStorage.removeItem('theme'); location.reload();` to return to light) — the pre-hydration script in `src/app/layout.tsx` reads the same `theme` key on every page.
- **Standard dark: substitution table** (apply verbatim wherever these exact classes appear in a file this plan touches):

  | Light class | Add dark companion |
  |---|---|
  | `text-slate-900` | `dark:text-slate-50` |
  | `text-slate-800` | `dark:text-slate-100` |
  | `text-slate-700` | `dark:text-slate-200` |
  | `text-slate-600` | `dark:text-slate-300` |
  | `text-slate-500` | `dark:text-slate-400` |
  | `text-slate-400` | `dark:text-slate-500` |
  | `border-slate-200` | `dark:border-white/10` |
  | `border-slate-300` | `dark:border-white/15` |
  | `bg-slate-50` | `dark:bg-white/5` |
  | `bg-slate-100` | `dark:bg-white/8` |
  | `bg-slate-200` | `dark:bg-white/10` |
  | `bg-white` (solid, opaque surface) | `dark:bg-brand-950` |
  | `text-brand-600` / `.money-positive` | `dark:text-brand-400` |
  | `text-rose-600` / `.money-negative` | `dark:text-rose-400` |
  | `ring-white` (badge-dot ring) | `dark:ring-night` |
  | `hover:bg-slate-100` | `dark:hover:bg-white/10` |
  | `hover:bg-slate-50` | `dark:hover:bg-white/5` |
  | `bg-{tone}-50 text-{tone}-800 border-{tone}-200` (Alert tones) | `dark:bg-{tone}-950/40 dark:text-{tone}-200 dark:border-{tone}-900/50` |

  Tailwind's brand-colored buttons (`bg-brand-600 text-white`, `bg-rose-600 text-white`) need **no** dark: variant — those hexes are dark enough that white text stays legible in both themes unchanged. Don't add dark: to them (YAGNI — extra classes with no visual effect).

---

## File Structure

- **Modify** `tailwind.config.ts` — add one token (`night`).
- **Modify** `src/app/globals.css` — the highest-leverage change: `.card`, `.input`, `.label`, `.money-positive`/`.money-negative`, `body`.
- **Create** `src/components/ui/AmbientBackdrop.tsx` + `.module.css` — the fixed gradient-blob layer, wired into both app layouts and the landing page.
- **Create** `src/lib/ui/glass.ts` — the one shared Tailwind string for the two non-`.card` glass surfaces (top nav, bottom dock).
- **Modify** `src/components/AppNav.tsx`, `AppNavClient.tsx`, `AppDockClient.tsx` — floating glass nav/dock.
- **Modify** `src/app/landing.module.css` — glass nav + feature cards, dark palette, receipt stays solid paper.
- **Modify** auth: `AuthForms.tsx`, `PasswordField.tsx`, `UsernameField.tsx` (dark: text pass — `OtpTokenInput.tsx` needs no change, it already uses `.input`).
- **Modify** group cluster: `GroupHeader.tsx`, `BalanceSummary.tsx`, `groups/[groupId]/page.tsx`, `ExpenseFilters.tsx`, `ExpenseRow.tsx`.
- **Modify** `friends/page.tsx`, `groups/page.tsx` (list consolidation), `BalanceRing.tsx`, `RecentActivityCard.tsx`, `NotificationList.tsx`.
- **Modify** `AccountSettings.tsx`, `settings/expenses/page.tsx`, `SpendingCharts.tsx`.
- **Modify** `AddExpenseButton.tsx`, `CreateGroupForm.tsx`, `InviteFriendsModal.tsx`, `InvitePanel.tsx`, `GlobalSearchOverlay.tsx`.
- **Modify** shared ui: `Alert.tsx`, `Button.tsx`, `EmptyState.tsx`, `Skeleton.tsx`.

---

### Task 1: Global tokens + shared primitives

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: Tailwind utility `bg-night`/`text-night`/etc. Every later task relies on `.card`, `.input`, `.label`, `.money-positive`, `.money-negative` already being glass/dark-aware from this task on.

- [ ] **Step 1: Add the `night` token**

`tailwind.config.ts` already has uncommitted changes from concurrent work (`darkMode: 'class'` and a `fontFamily.display` entry) — this step is **additive only**: open the file and add a single `night: '#07130e',` line inside the existing `colors: { brand: {...}, paper: ..., receipt: ..., ink: ... }` object, right after the `ink` line. Do not replace the whole `colors` block or the whole file, and do not touch the `darkMode` or `fontFamily` keys — they're not this plan's to add (already there) or change.

The result should have `colors` looking like:

```ts
colors: {
  brand: {
    50: '#eefbf4', 100: '#d6f5e3', 200: '#b0e9cb', 300: '#7dd7ad',
    400: '#47bd8b', 500: '#22a170', 600: '#15825a', 700: '#12684a',
    800: '#12523c', 900: '#104433', 950: '#06261d',
  },
  paper: '#eef2ee',
  receipt: '#fbfbf8',
  ink: '#10241c',
  night: '#07130e',
},
```

— with whatever `darkMode`/`fontFamily` lines are already in the file, above and below this block, left exactly as they are.

- [ ] **Step 2: Retint the shared primitives**

In `src/app/globals.css`, replace:

```css
body {
  @apply bg-paper text-slate-900 antialiased;
}

@layer components {
  .card {
    @apply rounded-2xl border border-ink/15 bg-receipt shadow-sm;
  }
  .label {
    @apply block text-sm font-medium text-slate-700;
  }
  .input {
    @apply block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900
           placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2
           focus:ring-brand-500/20 disabled:bg-slate-100 disabled:text-slate-500;
  }
  .money-positive { @apply text-brand-600; }
  .money-negative { @apply text-rose-600; }
}
```

with:

```css
body {
  @apply bg-paper text-slate-900 antialiased dark:bg-night dark:text-slate-50;
}

@layer components {
  .card {
    @apply rounded-2xl border border-white/60 bg-white/40 shadow-[0_8px_30px_rgba(31,41,55,0.12),inset_0_1px_0_rgba(255,255,255,0.6)]
           backdrop-blur-lg backdrop-saturate-150
           dark:border-white/10 dark:bg-brand-950/50 dark:shadow-[0_8px_30px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)];
  }
  .label {
    @apply block text-sm font-medium text-slate-700 dark:text-slate-300;
  }
  .input {
    @apply block w-full rounded-xl border border-ink/15 bg-white/55 px-3 py-2.5 text-slate-900
           placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2
           focus:ring-brand-500/20 disabled:bg-slate-100 disabled:text-slate-500
           dark:border-white/12 dark:bg-white/6 dark:text-slate-100 dark:placeholder:text-slate-500
           dark:focus:ring-brand-400/25 dark:disabled:bg-white/5 dark:disabled:text-slate-500;
  }
  .money-positive { @apply text-brand-600 dark:text-brand-400; }
  .money-negative { @apply text-rose-600 dark:text-rose-400; }
}
```

`.card` no longer has its own opaque `bg-receipt` — it's now the one blurred glass surface everywhere it's used (per the spec's "no nested blur" rule, nothing inside a `.card` gets its own `backdrop-blur-*`). `.input`'s border now reuses `ink/15` instead of `slate-300` so it reads as warm-toned glass, not cool-gray, matching the existing brand palette.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: clean (CSS/config-only change).

- [ ] **Step 4: Visual check**

Dev server running, Playwright login, screenshot `/groups` in light and dark. Confirm: canvas is `paper` (light) / `night` (dark), every `.card` now looks like frosted glass (blurred, translucent, soft border) instead of flat receipt-paper, text is still legible in both themes (slate-900 body text is unaffected by this task — dark-mode text legibility on cards comes from later per-file tasks, so it's OK if some card text still looks low-contrast in dark mode right now; that's fixed as later tasks touch each file). Zero new console errors.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts src/app/globals.css
git commit -m "style: convert shared card/input primitives to glassmorphism with dark mode tokens"
```

---

### Task 2: Ambient backdrop, wired into every top-level layout

**Files:**
- Create: `src/components/ui/AmbientBackdrop.tsx`
- Create: `src/components/ui/AmbientBackdrop.module.css`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/(auth)/layout.tsx`
- Modify: `src/app/landing.module.css`

**Interfaces:**
- Produces: `AmbientBackdrop` — a zero-prop component. Every layout in this task imports and renders it once, as the first child.

- [ ] **Step 1: Create the component and its styles**

`src/components/ui/AmbientBackdrop.module.css`:

```css
.backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  background: #eef2ee;
}

.backdrop::before {
  content: '';
  position: absolute;
  inset: -12%;
  background:
    radial-gradient(ellipse 40% 36% at 12% 8%, rgba(255, 154, 122, 0.5), transparent 70%),
    radial-gradient(ellipse 46% 40% at 90% 14%, rgba(34, 161, 112, 0.46), transparent 72%),
    radial-gradient(ellipse 48% 42% at 80% 90%, rgba(142, 197, 255, 0.44), transparent 72%),
    radial-gradient(ellipse 44% 38% at 8% 88%, rgba(255, 209, 102, 0.46), transparent 70%);
  filter: blur(10px);
  animation: drift 28s ease-in-out infinite alternate;
}

/* Dark mode is a `.dark` class on <html> (set by <ThemeToggle>), not OS
   preference — a plain `:global()` selector, not a media query, so this
   responds to the same toggle as every Tailwind `dark:` class elsewhere. */
:global(.dark) .backdrop { background: #07130e; }
:global(.dark) .backdrop::before {
  background:
    radial-gradient(ellipse 38% 32% at 12% 8%, rgba(255, 140, 105, 0.3), transparent 70%),
    radial-gradient(ellipse 44% 36% at 90% 12%, rgba(48, 201, 143, 0.32), transparent 72%),
    radial-gradient(ellipse 46% 40% at 82% 90%, rgba(115, 165, 255, 0.26), transparent 72%),
    radial-gradient(ellipse 40% 36% at 8% 90%, rgba(255, 198, 92, 0.24), transparent 70%);
}

@keyframes drift {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to   { transform: translate3d(-1.2%, 1.2%, 0) scale(1.03); }
}

@media (prefers-reduced-motion: reduce) {
  .backdrop::before { animation: none; }
}
```

`src/components/ui/AmbientBackdrop.tsx`:

```tsx
import styles from './AmbientBackdrop.module.css';

/** Fixed, decorative gradient-blob layer behind every screen — the "glass" in
 * glassmorphism needs something colorful and blurred to refract. Renders
 * once per top-level layout (app shell, auth shell, landing). */
export function AmbientBackdrop() {
  return <div className={styles.backdrop} aria-hidden="true" />;
}
```

- [ ] **Step 2: Wire into the app shell layout**

In `src/app/(app)/layout.tsx`, add the import and render it as the first child of the wrapping div:

```tsx
import { redirect } from 'next/navigation';
import { AppNav } from '@/components/AppNav';
import { AppDock } from '@/components/AppDock';
import { AmbientBackdrop } from '@/components/ui/AmbientBackdrop';
import { getAuthUser } from '@/lib/data/groups';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getAuthUser();
  if (!authUser) redirect('/login');

  return (
    <div className="flex min-h-screen flex-col">
      <AmbientBackdrop />
      <AppNav />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-28 pt-12">
        {children}
      </main>
      <AppDock />
    </div>
  );
}
```

- [ ] **Step 3: Wire into the auth shell layout**

In `src/app/(auth)/layout.tsx`:

```tsx
import Link from 'next/link';
import Image from 'next/image';
import { AmbientBackdrop } from '@/components/ui/AmbientBackdrop';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <AmbientBackdrop />
      <Link href="/" className="mb-6 flex items-center">
        <Image src="/logo.png" alt="Meerkash" width={139} height={100} className="h-32 w-auto" priority />
      </Link>
      <div className="card w-full max-w-sm p-6">{children}</div>
    </main>
  );
}
```

- [ ] **Step 4: Let the landing page's own backdrop show through**

`AmbientBackdrop` can't be dropped into `src/app/page.tsx` as-is because the landing page's `.stage` class currently paints an opaque background that would hide it. In `src/app/landing.module.css`, remove the `background` line from `.stage` (keep the CSS variable declarations and `color`):

```css
.stage {
  --paper: #eef2ee;
  --ink: #10241c;
  --copy: #3d4b43;
  --brand: #15825a;
  --brand-dark: #0c3f2d;
  --receipt: #fbfbf8;
  --rule: rgba(16, 36, 28, 0.16);
  --gold: #c9973f;

  position: relative;
  color: var(--ink);
}
```

Then in `src/app/page.tsx`, import and render `AmbientBackdrop` as the first child of `<main className={styles.stage}>`:

```tsx
import { AmbientBackdrop } from '@/components/ui/AmbientBackdrop';
// ...existing imports...

export default async function LandingPage() {
  // ...existing logic unchanged...
  return (
    <main className={styles.stage}>
      <AmbientBackdrop />
      <nav className={styles.nav}>
        {/* ...unchanged... */}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Visual check**

`<ThemeToggle>` isn't rendered anywhere yet (that's Task 3), so force dark mode via the browser console on each page: `localStorage.setItem('theme','dark'); location.reload();` (the pre-hydration script and `.dark` class already work regardless of whether anything renders the toggle button). Dev server, Playwright: screenshot `/login`, `/groups`, and `/` (landing, on desktop UA — it redirects on mobile UA) in light and dark. Confirm the blurred gradient blobs are visible behind the login card, behind the group page's (still receipt-colored, pre-Task-3) cards, and behind the landing hero — and that the blobs' colors and position shift between light/dark. Confirm `prefers-reduced-motion` (emulate in Playwright/devtools) freezes the drift. Zero new console errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/AmbientBackdrop.tsx src/components/ui/AmbientBackdrop.module.css \
  src/app/(app)/layout.tsx "src/app/(auth)/layout.tsx" src/app/landing.module.css src/app/page.tsx
git commit -m "feat: add ambient gradient backdrop behind app shell, auth shell, and landing"
```

---

### Task 3: Glass top nav + bottom dock

**Files:**
- Create: `src/lib/ui/glass.ts`
- Modify: `src/components/AppDockClient.tsx`
- Modify: `src/components/AppNav.tsx`
- Modify: `src/components/AppNavClient.tsx`
- Modify: `src/components/ThemeToggle.tsx` (dark: class fix only — not otherwise this plan's to own)

**Interfaces:**
- Produces: `GLASS_SURFACE` (string constant) from `@/lib/ui/glass`, consumed by `AppDockClient.tsx` and `AppNavClient.tsx`.
- Consumes: `ThemeToggle` (zero-prop component) from `@/components/ThemeToggle`, already built by concurrent work — this task renders it for the first time anywhere in the app.

- [ ] **Step 1: Extract the shared glass string**

`src/lib/ui/glass.ts`:

```ts
/** The one shared "floating glass chrome" treatment for surfaces that aren't
 * built from the `.card` primitive (the top nav bar and bottom dock — both
 * sit directly on the ambient backdrop, not inside page content). Kept as a
 * single constant so the two surfaces always match. */
export const GLASS_SURFACE =
  'border border-white/60 dark:border-white/10 bg-white/40 dark:bg-brand-950/50 ' +
  'backdrop-blur-lg backdrop-saturate-150 ' +
  'shadow-[0_8px_30px_rgba(31,41,55,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] ' +
  'dark:shadow-[0_8px_30px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]';
```

- [ ] **Step 2: Update `AppDockClient.tsx`**

Remove the local constant (lines 11-13):

```ts
const GLASS =
  'border border-white/60 bg-white/40 backdrop-blur-lg backdrop-saturate-150 ' +
  'shadow-[0_8px_30px_rgba(31,41,55,0.12),inset_0_1px_0_rgba(255,255,255,0.6)]';
```

Add the import instead:

```ts
import { GLASS_SURFACE } from '@/lib/ui/glass';
```

Replace every use of `GLASS` in the `cn(...)` call with `GLASS_SURFACE`. Then update the icon states and badge ring for dark mode:

```tsx
active ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-white/50 dark:text-slate-300 dark:hover:bg-white/10',
```

```tsx
<Icon size={20} strokeWidth={active ? 2.4 : 2} />
{badge > 0 ? (
  <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-night" />
) : null}
```

And the search button:

```tsx
className={cn(
  'flex h-11 w-11 items-center justify-center rounded-full text-slate-600 dark:text-slate-300',
  'transition-[color,background-color,transform] duration-200 ease-out',
  'hover:scale-110 hover:bg-white/50 dark:hover:bg-white/10 active:scale-95 motion-reduce:hover:scale-100',
)}
```

- [ ] **Step 3: Turn the top nav into a floating glass pill**

`src/components/AppNav.tsx` — wrap in a sticky, floating container instead of an edge-to-edge bar:

```tsx
import { getUnreadCount } from '@/lib/actions/notifications';
import { getMyGroupsList } from '@/lib/data/groups';
import { AppNavClient } from './AppNavClient';

export async function AppNav() {
  const [groups, unread] = await Promise.all([getMyGroupsList(), getUnreadCount()]);

  return (
    <div className="sticky top-3 z-20 mx-auto w-full max-w-4xl px-4">
      <AppNavClient groups={groups} unread={unread} />
    </div>
  );
}
```

`src/components/AppNavClient.tsx` — the `<nav>` itself becomes the glass pill (add `cn` and `GLASS_SURFACE` imports), and this is also where the existing, not-yet-rendered-anywhere `<ThemeToggle>` gets wired in, grouped with the bell on the right:

```tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { AddExpenseButton } from '@/components/AddExpenseButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { GLASS_SURFACE } from '@/lib/ui/glass';
import { cn } from '@/lib/utils';
import type { Group } from '@/types/db';

export function AppNavClient({ groups, unread }: { groups: Group[]; unread: number }) {
  return (
    <nav className={cn('relative flex h-16 items-center justify-between rounded-3xl px-4', GLASS_SURFACE)}>
      <AddExpenseButton groups={groups} />

      <Link href="/groups" className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
        <Image
          src="/wordmark.png"
          alt="Meerkash"
          width={688}
          height={384}
          className="h-20 w-auto"
          priority
        />
      </Link>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Link
          href="/notifications"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          className={cn(
            'relative flex h-11 w-11 items-center justify-center rounded-full text-slate-600 dark:text-slate-300',
            'transition-[background-color,transform] duration-200 ease-out',
            'hover:scale-110 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 motion-reduce:hover:scale-100',
          )}
        >
          <Bell size={20} />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-night" />
          ) : null}
        </Link>
      </div>
    </nav>
  );
}
```

`<ThemeToggle>` itself needs one small fix while you're in there: its own className string (`text-slate-600 ... hover:bg-slate-100`) predates this plan's dark pass and has no `dark:` companion. Update it to match every other icon button in this file:

```tsx
className={[
  'flex h-11 w-11 items-center justify-center rounded-full text-slate-600 dark:text-slate-300',
  'transition-[background-color,transform] duration-200 ease-out',
  'hover:scale-110 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 motion-reduce:hover:scale-100',
].join(' ')}
```

(`(app)/layout.tsx`'s `<main>` keeps its existing `pt-12` unchanged — the nav is still in normal document flow, just wrapped and floating, so the same gap logic applies.)

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Visual check**

Dev server, Playwright, `/groups`. Click the new moon/sun `<ThemeToggle>` button in the top nav and confirm it actually flips the whole app to dark (this is the first place it's rendered — if it does nothing, the import/wiring is wrong). In both states, confirm: top nav is now a floating rounded glass bar (not edge-to-edge), bottom dock matches it exactly (same border/blur/shadow recipe), icons and the unread/pending badge rings look correct, hover states visible. Reload the page after toggling to confirm the choice persisted (pre-hydration script + `localStorage`). Zero new console errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ui/glass.ts src/components/AppDockClient.tsx src/components/AppNav.tsx src/components/AppNavClient.tsx src/components/ThemeToggle.tsx
git commit -m "feat: unify top nav and bottom dock into one floating glass surface; wire up dark mode toggle"
```

---

### Task 4: Landing page glass + dark palette

**Files:**
- Modify: `src/app/landing.module.css`

**Interfaces:** none (leaf CSS-module change; `page.tsx` already wired to `AmbientBackdrop` in Task 2).

- [ ] **Step 1: Add the dark palette override**

- [ ] **Step 1: Add `--stamp-bg` as a light-mode default**

In the base `.stage` rule (added in Task 2 Step 4), add one more variable so both themes have a value:

```css
.stage {
  --paper: #eef2ee;
  --ink: #10241c;
  --copy: #3d4b43;
  --brand: #15825a;
  --brand-dark: #0c3f2d;
  --receipt: #fbfbf8;
  --rule: rgba(16, 36, 28, 0.16);
  --gold: #c9973f;
  --stamp-bg: rgba(251, 251, 248, 0.5);

  position: relative;
  color: var(--ink);
}
```

Then change the `.stamp` rule's `background` line from `rgba(251, 251, 248, 0.6);` to `var(--stamp-bg);`.

- [ ] **Step 2: Add the dark palette override**

Append, right after the `.stage` rule (a `:global()` selector, not a media query — dark mode here follows the same `.dark` class on `<html>` that `<ThemeToggle>` sets everywhere else, not OS preference):

```css
:global(.dark) .stage {
  --ink: #eef6f1;
  --copy: #b6c7bd;
  --receipt: #182420;
  --rule: rgba(238, 246, 241, 0.2);
  --stamp-bg: rgba(24, 36, 32, 0.55);
}
```

(`--paper` is no longer used for a background per Task 2 Step 4, so it's not redefined here. `--brand`, `--brand-dark`, `--gold` stay constant across themes on purpose — they're already dark/saturated enough that white button text and the brand-colored stamp border/feature dot need no dark-mode change, exactly like `Button.tsx`'s `bg-brand-600 text-white` elsewhere in the app.)

- [ ] **Step 3: Glass the nav**

Replace the `.nav` rule with:

```css
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1180px;
  margin: 20px auto 0;
  padding: 10px 20px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.62);
  background: rgba(255, 255, 255, 0.44);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  box-shadow: 0 10px 24px rgba(16, 36, 28, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.55);
}
:global(.dark) .nav {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(19, 32, 26, 0.48);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
```

Add a matching narrow-viewport margin override right after the existing `@media (max-width: 480px)` block's `.nav` line (`padding-left: 16px; padding-right: 16px;` stays — just also add `margin-left: 14px; margin-right: 14px;` there so the floating pill doesn't touch the screen edge on phones).

- [ ] **Step 4: Glass the feature cards**

The `.feature` rule currently has no visual box at all (`max-width: 34ch;` only) — features float as plain text today. Replace it with:

```css
.feature {
  max-width: 34ch;
  padding: 22px 20px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.62);
  background: rgba(255, 255, 255, 0.64);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  box-shadow: 0 10px 24px rgba(16, 36, 28, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.55);
}
:global(.dark) .feature {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(22, 37, 30, 0.7);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: clean (CSS-only).

- [ ] **Step 6: Visual check**

Dev server, Playwright, desktop UA, screenshot `/` in light and dark. Confirm: nav is a floating glass pill, the three feature cards are frosted glass panels (previously borderless text), the receipt hero stays solid opaque paper in both themes (with a subtly different paper tone in dark mode) — not glass, per the spec's "receipt stays physical" rule. Confirm headline/lede/footer text is legible in both themes. Zero new console errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/landing.module.css
git commit -m "style: glass nav and feature cards on landing page, add dark palette"
```

---

### Task 5: Auth screens dark pass

**Files:**
- Modify: `src/components/auth/AuthForms.tsx`
- Modify: `src/components/auth/PasswordField.tsx`
- Modify: `src/components/auth/UsernameField.tsx`

**Interfaces:** none new — `OtpTokenInput.tsx` needs no change (it only uses the now-dark-aware `.input` class).

- [ ] **Step 1: `AuthForms.tsx` — Google button, divider, tab toggle**

Replace the `GoogleButton` button className:

```tsx
className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-brand-950 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
```

Replace `Divider`'s spans:

```tsx
function Divider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
      <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">or</span>
      <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
    </div>
  );
}
```

In both `LoginForm` and `SignupForm`, the tab-toggle track and buttons currently read:

```tsx
<div className="flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
  <button
    ...
    className={`flex-1 rounded-lg py-1.5 transition-colors ${mode === 'password' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
  >
```

Replace with (same pattern in both places — two call sites, `LoginForm` and `SignupForm`):

```tsx
<div className="flex rounded-xl bg-slate-100 dark:bg-white/6 p-1 text-sm font-medium">
  <button
    ...
    className={`flex-1 rounded-lg py-1.5 transition-colors ${mode === 'password' ? 'bg-white dark:bg-white/12 text-slate-900 dark:text-slate-50 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
  >
```

(apply the identical class change to the second button in each toggle, which uses `mode === 'otp'` in the same ternary shape).

The bottom "New here?" / "Already have an account?" lines (`text-sm text-slate-600`) get `dark:text-slate-300` added — two occurrences, one in `LoginForm`, one in `SignupForm`.

- [ ] **Step 2: `PasswordField.tsx` — strength bar and requirement list**

Replace the strength-bar track:

```tsx
<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
```

Replace the requirement list item classes:

```tsx
className={`flex items-center gap-1.5 ${met ? 'text-brand-700 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'}`}
```

Replace the fallback hint paragraph:

```tsx
<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">At least 8 characters.</p>
```

Replace the show/hide-password button's icon color:

```tsx
className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
```

- [ ] **Step 3: `UsernameField.tsx` — availability message colors**

Replace the `MESSAGE_COLOR` map:

```ts
const MESSAGE_COLOR: Record<UsernameStatus, string> = {
  idle: 'text-slate-500 dark:text-slate-400',
  checking: 'text-slate-500 dark:text-slate-400',
  available: 'text-brand-700 dark:text-brand-400',
  taken: 'text-rose-600 dark:text-rose-400',
  invalid: 'text-rose-600 dark:text-rose-400',
};
```

Replace the fallback hint paragraph:

```tsx
<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your unique handle on Meerkash.</p>
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Visual check**

Dev server, Playwright, screenshot `/login` and `/signup` in light and dark, both the Password and Email-code tabs, and the OTP verify step (request a code to reach it). Confirm every string of text is legible in dark mode — Google button, divider, tab toggle, field hints, password strength checklist, username availability message. Zero new console errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/AuthForms.tsx src/components/auth/PasswordField.tsx src/components/auth/UsernameField.tsx
git commit -m "style: dark mode pass for login and signup forms"
```

---

### Task 6: Group overview cluster

**Files:**
- Modify: `src/components/groups/GroupHeader.tsx`
- Modify: `src/components/groups/BalanceSummary.tsx`
- Modify: `src/app/(app)/groups/[groupId]/page.tsx`
- Modify: `src/components/expenses/ExpenseFilters.tsx`
- Modify: `src/components/expenses/ExpenseRow.tsx`

**Interfaces:** none new — all consume the already-updated `.card`/`.input`/`.label`/`.money-positive`/`.money-negative` from Task 1.

- [ ] **Step 1: `GroupHeader.tsx`**

Replace the name/member-count block:

```tsx
<h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
  {group.name}
</h1>
<p className="text-sm text-slate-500 dark:text-slate-400">
  {memberCount} {memberCount === 1 ? 'member' : 'members'} · {CURRENCY_LABEL[group.currency]}
</p>
```

Replace the tabs row and link classes:

```tsx
<nav className="scroll-x -mx-1 flex gap-1 border-b border-slate-200 dark:border-white/10 pb-px">
  {TABS.map((tab) => {
    const active = current === tab.href;
    return (
      <Link
        key={tab.href}
        href={`/groups/${group.id}${tab.href}`}
        className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400'
            : 'border-b-2 border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        {tab.label}
      </Link>
    );
  })}
</nav>
```

- [ ] **Step 2: `BalanceSummary.tsx`**

Replace the settled-up card body:

```tsx
<div className="card p-5">
  <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">You are all settled up</p>
  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
    Nobody owes you anything in this group, and you owe nothing.
  </p>
</div>
```

Replace the balance hero block:

```tsx
<div className={`px-5 py-4 ${owedMode ? 'bg-brand-50 dark:bg-brand-500/10' : 'bg-rose-50 dark:bg-rose-500/10'}`}>
  <p className="text-sm text-slate-600 dark:text-slate-300">{owedMode ? 'You are owed' : 'You owe'}</p>
```

Replace both row templates' text/strong colors (the `owedToYou` and `youOwe` `.map` blocks):

```tsx
<span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-300">
  <strong className="font-medium text-slate-900 dark:text-slate-50">{nameOf(line.userId)}</strong> owes you
</span>
```

```tsx
<span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-300">
  You owe <strong className="font-medium text-slate-900 dark:text-slate-50">{nameOf(line.userId)}</strong>
</span>
```

And the row divider:

```tsx
<ul className="divide-y divide-slate-100 dark:divide-white/8">
```

(the `Settle` link's `bg-brand-600 text-white` needs no dark: variant, per the Global Constraints table.)

- [ ] **Step 3: `groups/[groupId]/page.tsx`**

Replace the pending-settlement banner:

```tsx
<Link
  href={`/groups/${groupId}/settle`}
  className="card flex items-center gap-3 border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 hover:border-amber-400 dark:hover:border-amber-500/50"
>
  <Wallet size={18} className="text-amber-700 dark:text-amber-400" />
  <span className="flex-1 text-sm text-amber-900 dark:text-amber-200">
```

(leave the `ArrowRight` icon's `text-amber-700` → add `dark:text-amber-400` too, same line pattern.)

Replace the local `Stat` component:

```tsx
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{value}</p>
    </div>
  );
}
```

Replace the recent-settlements list:

```tsx
<ul className="card divide-y divide-slate-100 dark:divide-white/8 overflow-hidden">
  {recentSettlements.map((s) => (
    <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
      <span className="flex-1 text-slate-700 dark:text-slate-300">
        <strong className="font-medium text-slate-900 dark:text-slate-50">
          {s.from_user_id === bundle.me.id ? 'You' : bundle.nameOf(s.from_user_id)}
        </strong>{' '}
        paid{' '}
        <strong className="font-medium text-slate-900 dark:text-slate-50">
          {s.to_user_id === bundle.me.id ? 'you' : bundle.nameOf(s.to_user_id)}
        </strong>{' '}
        {formatMoney(s.amount_centavos, bundle.group.currency)}
      </span>
      <StatusPill status={s.status} />
      <span className="hidden shrink-0 text-xs text-slate-400 dark:text-slate-500 sm:inline">
        {relativeTime(s.created_at)}
      </span>
    </li>
  ))}
</ul>
```

Replace `StatusPill`'s style map:

```tsx
function StatusPill({ status }: { status: 'pending' | 'confirmed' | 'rejected' }) {
  const styles = {
    pending: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300',
    confirmed: 'bg-brand-100 dark:bg-brand-500/15 text-brand-800 dark:text-brand-300',
    rejected: 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300',
  } as const;
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}
```

- [ ] **Step 4: `ExpenseFilters.tsx`**

Replace the search icon and Filters button:

```tsx
<Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
<input
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  placeholder="Search expenses"
  className="input pl-9"
  aria-label="Search expenses"
/>
```

```tsx
<button
  onClick={() => setShowFilters((v) => !v)}
  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-brand-950 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
>
```

Replace the "Show deleted expenses" checkbox row and the checkbox itself:

```tsx
<label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
  <input
    type="checkbox"
    checked={includeDeleted}
    onChange={(e) => setIncludeDeleted(e.target.checked)}
    className="h-4 w-4 rounded border-slate-300 dark:border-white/20 text-brand-600 focus:ring-brand-500"
  />
  Show deleted expenses
</label>
```

Replace the expenses list wrapper:

```tsx
<ul className="card divide-y divide-slate-100 dark:divide-white/8 overflow-hidden">
```

- [ ] **Step 5: `ExpenseRow.tsx`**

Replace the row link and its contents:

```tsx
<Link
  href={`/groups/${groupId}/expenses/${expense.id}`}
  className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${
    deleted ? 'opacity-60' : ''
  }`}
>
  <span className="text-xl" aria-hidden>
    {CATEGORY_EMOJI[expense.category]}
  </span>

  <div className="min-w-0 flex-1">
    <p
      className={`truncate font-medium text-slate-900 dark:text-slate-50 ${deleted ? 'line-through' : ''}`}
    >
      {expense.description}
    </p>
    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
      {iPaid ? 'You' : nameOf(expense.payer_id)} paid {formatMoney(expense.amount_centavos, currency)} ·{' '}
      {relativeTime(expense.created_at)}
      {deleted ? ' · deleted' : ''}
    </p>
  </div>

  <div className="shrink-0 text-right">
    {deleted || delta === 0 ? (
      <span className="text-xs text-slate-400 dark:text-slate-500">no effect</span>
    ) : (
      <>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{delta > 0 ? 'you lent' : 'you borrowed'}</p>
        <p className={`text-sm font-semibold ${delta > 0 ? 'money-positive' : 'money-negative'}`}>
          {formatMoney(Math.abs(delta), currency)}
        </p>
      </>
    )}
  </div>
</Link>
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 7: Visual check**

Dev server, Playwright, open any group's overview page in light and dark. Confirm every piece of text (header, tabs, balance card, stat tiles, pending banner, expense rows, settlement rows, status pills) is legible in both themes. Zero new console errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/groups/GroupHeader.tsx src/components/groups/BalanceSummary.tsx \
  "src/app/(app)/groups/[groupId]/page.tsx" src/components/expenses/ExpenseFilters.tsx src/components/expenses/ExpenseRow.tsx
git commit -m "style: dark mode pass for group overview, balance summary, and expense list"
```

---

### Task 7: Friends & Groups lists — consolidate to one glass container, dark pass

**Files:**
- Modify: `src/app/(app)/friends/page.tsx`
- Modify: `src/app/(app)/groups/page.tsx`
- Modify: `src/components/home/BalanceRing.tsx`
- Modify: `src/components/home/RecentActivityCard.tsx`
- Modify: `src/components/NotificationList.tsx`

**Interfaces:** none new.

- [ ] **Step 1: `friends/page.tsx` — one glass card, not one per friend**

Replace the friends list block (currently `<ul className="space-y-2">` of individually-carded `<Link>`s) with a single `.card` and `divide-y` rows:

```tsx
<ul className="card divide-y divide-slate-100 dark:divide-white/8 overflow-hidden">
  {friends.map(({ profile, netCentavos }) => (
    <li key={profile.id}>
      <Link
        href={`/friends/${profile.id}`}
        className="flex items-center gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
      >
        <Avatar name={profile.display_name} src={profile.avatar_url} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900 dark:text-slate-50">{profile.display_name}</p>
        </div>
        <div className="text-right">
          {netCentavos === 0 ? (
            <span className="text-sm text-slate-500 dark:text-slate-400">Settled up</span>
          ) : (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {netCentavos > 0 ? 'owes you' : 'you owe'}
              </p>
              <p className={`font-semibold ${netCentavos > 0 ? 'money-positive' : 'money-negative'}`}>
                {formatPHP(Math.abs(netCentavos))}
              </p>
            </>
          )}
        </div>
        <ChevronRight size={18} className="shrink-0 text-slate-300 dark:text-slate-600" />
      </Link>
    </li>
  ))}
</ul>
```

Also add `dark:text-slate-50`/`dark:text-slate-300` to the page's own heading block:

```tsx
<h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Friends</h1>
<p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
  Balances here are separate from any group — just the two of you.
</p>
```

- [ ] **Step 2: `groups/page.tsx` — same consolidation**

Replace the groups list block with the same pattern (one `.card`, `divide-y` rows):

```tsx
<ul className="card divide-y divide-slate-100 dark:divide-white/8 overflow-hidden">
  {groups.map(({ group, balance, memberCount }) => (
    <li key={group.id}>
      <Link
        href={`/groups/${group.id}`}
        className="flex items-center gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
      >
        <Avatar
          name={group.name}
          src={group.avatar_url}
          seed={group.avatar_seed}
          size={44}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900 dark:text-slate-50">{group.name}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </p>
        </div>
        <div className="text-right">
          {balance === 0 ? (
            <span className="text-sm text-slate-500 dark:text-slate-400">Settled up</span>
          ) : (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {balance > 0 ? 'you are owed' : 'you owe'}
              </p>
              <p
                className={`font-semibold ${balance > 0 ? 'money-positive' : 'money-negative'}`}
              >
                {formatMoney(Math.abs(balance), group.currency)}
              </p>
            </>
          )}
        </div>
        <ChevronRight size={18} className="shrink-0 text-slate-300 dark:text-slate-600" />
      </Link>
    </li>
  ))}
</ul>
```

Also update the page heading and summary text blocks (`text-2xl ... text-slate-900` → add `dark:text-slate-50`; the three `text-sm text-slate-600` paragraphs and the `text-xs text-slate-500` conversion note → add `dark:text-slate-300` / `dark:text-slate-400` respectively; `<strong className="font-medium text-slate-900">` inside the balance summary paragraph → add `dark:text-slate-50`).

- [ ] **Step 3: `BalanceRing.tsx`**

Replace the name label and the `settled` ring color:

```tsx
<span
  className={cn(
    'flex h-14 w-14 items-center justify-center rounded-full p-0.5',
    netCentavos < 0 && 'bg-gradient-to-tr from-rose-300 to-rose-600',
    netCentavos > 0 && 'bg-gradient-to-tr from-brand-300 to-brand-600',
    netCentavos === 0 && 'bg-slate-300 dark:bg-white/15',
  )}
>
  <Avatar
    name={profile.display_name}
    src={profile.avatar_url}
    size={52}
    className="border-2 border-paper dark:border-night"
  />
</span>
<span className="w-full truncate text-center text-[11px] text-slate-600 dark:text-slate-400">
  {profile.display_name}
</span>
```

- [ ] **Step 4: `RecentActivityCard.tsx`**

Replace the list wrapper and row contents:

```tsx
<ul className="card divide-y divide-slate-100 dark:divide-white/8 overflow-hidden">
  {entries.map((entry) => {
    const nameOf = (id: string) =>
      id === entry.actor_id ? (entry.actor?.display_name ?? 'Someone') : 'Someone';

    return (
      <li key={entry.id}>
        <Link
          href={`/groups/${entry.group.id}/activity`}
          className="flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
        >
          <Avatar name={entry.actor?.display_name ?? 'Someone'} src={entry.actor?.avatar_url} size={30} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-800 dark:text-slate-200">{describeActivity(entry, nameOf, entry.group.currency)}</p>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="rounded-full bg-brand-50 dark:bg-brand-500/15 px-2 py-0.5 font-medium text-brand-700 dark:text-brand-300">
                {entry.group.name}
              </span>
              <span>{relativeTime(entry.created_at)}</span>
            </div>
          </div>
        </Link>
      </li>
    );
  })}
</ul>
```

- [ ] **Step 5: `NotificationList.tsx`**

Replace the list wrapper and row body:

```tsx
<ul className="card divide-y divide-slate-100 dark:divide-white/8 overflow-hidden">
  {notifications.map((notification) => {
    const body = (
      <div className={`px-4 py-3 ${notification.read_at ? '' : 'bg-brand-50/60 dark:bg-brand-500/10'}`}>
        <div className="flex items-start gap-2">
          {!notification.read_at ? (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600 dark:bg-brand-400" aria-hidden />
          ) : (
            <span className="mt-1.5 h-2 w-2 shrink-0" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{notification.title}</p>
            {notification.body ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">{notification.body}</p>
            ) : null}
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              {relativeTime(notification.created_at)}
            </p>
          </div>
        </div>
      </div>
    );

    return (
      <li key={notification.id}>
        {notification.link ? (
          <Link
            href={notification.link}
            onClick={() => { void markRead(notification.id); }}
            className="block hover:bg-slate-50 dark:hover:bg-white/5"
          >
            {body}
          </Link>
        ) : (
          body
        )}
      </li>
    );
  })}
</ul>
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 7: Visual check**

Dev server, Playwright, screenshot `/friends`, `/groups`, and `/notifications` in light and dark. Confirm: friends and groups are each one glass container with divided rows (not N separate glass cards — this is the structural fix, look closely for a seam between rows vs. a gap between cards), balance-ring gradients and recent-activity/notification lists are legible in dark mode. Zero new console errors.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/friends/page.tsx" "src/app/(app)/groups/page.tsx" \
  src/components/home/BalanceRing.tsx src/components/home/RecentActivityCard.tsx src/components/NotificationList.tsx
git commit -m "style: consolidate friends/groups lists into one glass card, add dark mode"
```

---

### Task 8: Settings + personal spending charts

**Files:**
- Modify: `src/components/AccountSettings.tsx`
- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `src/app/(app)/settings/expenses/page.tsx`
- Modify: `src/components/groups/SpendingCharts.tsx`

**Interfaces:** none new.

- [ ] **Step 1: `settings/page.tsx` — heading + the new "Your spending" link row**

```tsx
<h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Your account</h1>
```

```tsx
<Link
  href="/settings/expenses"
  className="card flex items-center gap-3 p-4 transition-colors hover:border-brand-300 dark:hover:border-brand-500/40"
>
  <Receipt size={20} className="shrink-0 text-brand-500 dark:text-brand-400" />
  <div className="min-w-0 flex-1">
    <p className="font-medium text-slate-900 dark:text-slate-50">Your spending</p>
    <p className="text-sm text-slate-500 dark:text-slate-400">Totals and trends across every group</p>
  </div>
  <ChevronRight size={18} className="shrink-0 text-slate-300 dark:text-slate-600" />
</Link>
```

- [ ] **Step 2: `AccountSettings.tsx` — `ProfileForm`**

Replace the identity row and name label area:

```tsx
<div className="flex items-center gap-3">
  <Avatar name={displayName} src={avatarUrl} size={52} />
  <div className="min-w-0">
    <p className="font-medium text-slate-900 dark:text-slate-50">{displayName}</p>
    <p className="truncate text-sm text-slate-500 dark:text-slate-400">{email ?? 'No email on file'}</p>
  </div>
</div>
```

Replace the avatar file-input's file-button styling:

```tsx
<input
  id="avatar"
  name="avatar"
  type="file"
  accept="image/png,image/jpeg,image/webp,image/gif"
  className="mt-1.5 block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-white/15"
/>
<input type="hidden" name="avatar_url" value={avatarUrl ?? ''} />
<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
  PNG, JPEG, WebP or GIF up to 2 MB. Upload nothing to keep your initials avatar.
</p>
```

The `preferred_currency` hint paragraph — same `text-xs text-slate-500` → add `dark:text-slate-400`.

- [ ] **Step 3: `AccountSettings.tsx` — `DeleteAccountPanel`**

Replace the initial (not-confirming) state:

```tsx
return (
  <div className="card space-y-3 p-5">
    <p className="font-medium text-slate-900 dark:text-slate-50">Delete your account</p>
    <p className="text-sm text-slate-600 dark:text-slate-300">
      Your personal details are removed and you lose access. The expenses and settlements you
      were part of stay in their groups so everyone else&apos;s balances still make sense.
    </p>
    <Button variant="secondary" onClick={() => setConfirming(true)}>
      Delete my account
    </Button>
  </div>
);
```

Replace the confirming state:

```tsx
return (
  <div className="card space-y-3 border-rose-200 dark:border-rose-500/30 p-5">
    <p className="font-medium text-rose-900 dark:text-rose-300">This cannot be undone</p>
    <p className="text-sm text-slate-600 dark:text-slate-300">
      You must be settled up in every group first. Type <strong>DELETE</strong> to confirm.
    </p>
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      className="input"
      placeholder="DELETE"
      aria-label="Type DELETE to confirm"
    />
    {error ? <Alert tone="error">{error}</Alert> : null}
    <div className="flex gap-2">
      <Button
        variant="danger"
        disabled={text !== 'DELETE' || pending}
        onClick={() =>
          start(async () => {
            const result = await deleteAccount();
            if (result.ok) router.push(result.redirectTo ?? '/');
            else setError(result.error ?? 'Could not delete your account.');
          })
        }
      >
        {pending ? 'Deleting…' : 'Permanently delete'}
      </Button>
      <Button variant="secondary" onClick={() => { setConfirming(false); setText(''); }}>
        Cancel
      </Button>
    </div>
  </div>
);
```

- [ ] **Step 4: `settings/expenses/page.tsx`**

Replace the back-button + heading row:

```tsx
<div className="flex items-center gap-2">
  <Link
    href="/settings"
    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-white/10"
    aria-label="Back to your account"
  >
    <ChevronLeft size={18} />
  </Link>
  <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Your spending</h1>
</div>
```

Replace the approximate-total line:

```tsx
<p className="text-sm text-slate-600 dark:text-slate-300">
  ≈{' '}
  <strong className="font-medium text-slate-900 dark:text-slate-50">
    {formatMoney(overview.convertedTotalAllTime.amount, overview.convertedTotalAllTime.currency)}
  </strong>{' '}
  total in {overview.convertedTotalAllTime.currency}
  {overview.convertedTotalAllTime.partial ? ' (some currencies not converted)' : ''} —
  approximate, based on today&apos;s exchange rates
</p>
```

Replace the local `Stat` component (identical shape to Task 6's, separate copy in this file):

```tsx
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{value}</p>
    </div>
  );
}
```

- [ ] **Step 5: `SpendingCharts.tsx`**

Replace `CategoryBarChart`'s label and track/fill:

```tsx
<div className="w-32 shrink-0 truncate text-sm text-slate-700 dark:text-slate-300">
  {CATEGORY_EMOJI[d.category]} {CATEGORY_LABEL[d.category]}
</div>
<svg
  viewBox="0 0 100 10"
  preserveAspectRatio="none"
  className="h-3 flex-1 overflow-visible"
  role="img"
  aria-label={`${CATEGORY_LABEL[d.category]}: ${formatMoney(d.total, currency)}`}
>
  <rect x="0" y="0" width="100" height="10" rx="5" className="fill-slate-100 dark:fill-white/8" />
  <rect x="0" y="0" width={(d.total / max) * 100} height="10" rx="5" className="fill-brand-500 dark:fill-brand-400" />
</svg>
<div className="w-24 shrink-0 text-right text-sm font-medium text-slate-900 dark:text-slate-50">
  {formatMoney(d.total, currency)}
</div>
```

Replace `MonthBarChart`'s bar fill, axis line, and labels:

```tsx
<rect
  key={d.key}
  x={x}
  y={54 - height}
  width={barWidth}
  height={height}
  rx="2"
  className={d.total > 0 ? 'fill-brand-500 dark:fill-brand-400' : 'fill-slate-100 dark:fill-white/8'}
>
  <title>{`${d.label}: ${formatMoney(d.total, currency)}`}</title>
</rect>
```

```tsx
<line x1="0" y1="54" x2="100" y2="54" className="stroke-slate-200 dark:stroke-white/10" strokeWidth="0.5" />
```

```tsx
<div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
  {data.map((d) => (
    <div key={d.key} className="text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{d.label}</p>
      <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">{formatMoney(d.total, currency)}</p>
    </div>
  ))}
</div>
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 7: Visual check**

Dev server, Playwright, screenshot `/settings` and `/settings/expenses` in light and dark. Confirm: profile card, delete-account danger card, and both charts (bars + labels + axis line) are all legible in dark mode — SVG `fill`/`stroke` utility classes are easy to miss, double check the bars are actually visible against the dark card background, not just the text. Zero new console errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/AccountSettings.tsx "src/app/(app)/settings/page.tsx" \
  "src/app/(app)/settings/expenses/page.tsx" src/components/groups/SpendingCharts.tsx
git commit -m "style: dark mode pass for settings and personal spending charts"
```

---

### Task 9: Modals + global search overlay

**Files:**
- Modify: `src/components/AddExpenseButton.tsx`
- Modify: `src/components/groups/CreateGroupForm.tsx`
- Modify: `src/components/groups/InviteFriendsModal.tsx`
- Modify: `src/components/groups/InvitePanel.tsx`
- Modify: `src/components/search/GlobalSearchOverlay.tsx`

**Interfaces:** none new. All three dialog panels already use `.card` (glass, from Task 1) — this task's job is the scrim (must stay flat, no blur, per the spec's no-nested-blur rule — it's already `bg-ink/40` with no backdrop-filter, so no change needed there) plus the text/icon colors inside each panel.

- [ ] **Step 1: `AddExpenseButton.tsx`**

Replace the modal header and close button:

```tsx
<div className="flex items-start justify-between">
  <p id="add-expense-title" className="font-medium text-slate-900 dark:text-slate-50">Add an expense</p>
  <button
    onClick={() => setOpen(false)}
    className="rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
    aria-label="Cancel"
  >
    <X size={18} />
  </button>
</div>
```

Replace the no-groups fallback text and the closing helper text:

```tsx
<p className="text-sm text-slate-600 dark:text-slate-300">
  You don&apos;t have any groups yet — create one first to add an expense.
</p>
```

```tsx
<p className="text-xs text-slate-500 dark:text-slate-400">
  Splits equally among everyone in the group, with you as the payer.
</p>
```

- [ ] **Step 2: `CreateGroupForm.tsx`**

Replace the modal header/close and helper text:

```tsx
<div className="flex items-start justify-between">
  <div>
    <p id="create-group-title" className="font-medium text-slate-900 dark:text-slate-50">Create a group</p>
    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
      Name it now, or leave it blank and rename it once people join.
    </p>
  </div>
  <button
    onClick={() => setOpen(false)}
    className="rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
    aria-label="Cancel"
  >
    <X size={18} />
  </button>
</div>
```

```tsx
<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Fixed once the group is created.</p>
```

- [ ] **Step 3: `InviteFriendsModal.tsx`**

Replace the header block and empty-friends fallback:

```tsx
<div className="flex items-start justify-between gap-3">
  <div>
    <p id="invite-friends-title" className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-50">
      <PartyPopper size={18} className="text-brand-600 dark:text-brand-400" /> {groupName} is ready
    </p>
    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Bring people in now, or skip and do it later.</p>
  </div>
  <button onClick={close} className="rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Close">
    <X size={18} />
  </button>
</div>
```

```tsx
<ul className="mt-4 divide-y divide-slate-100 dark:divide-white/8 rounded-xl border border-slate-200 dark:border-white/10">
```

```tsx
<span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-slate-50">
  {friend.display_name}
</span>
```

```tsx
<p className="mt-4 rounded-xl border border-dashed border-slate-300 dark:border-white/15 px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
  You don&apos;t have any friends added yet — share the link below instead.
</p>
```

- [ ] **Step 4: `InvitePanel.tsx`**

Replace the header text and the QR box:

```tsx
<div>
  <p className="font-medium text-slate-900 dark:text-slate-50">Invite people</p>
  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
    Share this link or let them scan the code. They&apos;ll need to accept before they join.
  </p>
</div>
```

```tsx
{showQr ? (
  <div
    className="flex justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-white p-4"
    dangerouslySetInnerHTML={{ __html: qrSvg }}
  />
) : null}
```

(the QR box keeps a solid `bg-white` in both themes — deliberately, since the SVG QR code itself is drawn with black modules on a white background baked into the generated SVG (`qrcode` package output) and would become unreadable/low-contrast on a dark fill without also regenerating the SVG's own colors, which is out of scope for this visual-only pass.)

- [ ] **Step 5: `GlobalSearchOverlay.tsx`**

Replace the overlay's root and header bar:

```tsx
<div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-night">
  <div className="border-b border-slate-200 dark:border-white/10 px-4 pb-3 pt-4">
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search groups, friends, expenses, activity…"
          className="input pl-9"
        />
      </div>
      <button
        onClick={onClose}
        aria-label="Close search"
        className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
      >
        <X size={20} />
      </button>
    </div>
    <div className="mt-3 flex gap-1.5 overflow-x-auto">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setFilter(key)}
          className={cn(
            'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
            filter === key ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-white/8 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/12',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  </div>
```

Replace the three "no results" style states and every result row's text colors:

```tsx
<p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
  Search across your groups, friends, expenses and activity.
</p>
```

(same class change applies to the "Searching…" and "No results" paragraphs right below it — three near-identical `<p className="mt-8 text-center text-sm text-slate-500">` occurrences in this file, all get `dark:text-slate-400`.)

```tsx
function ResultSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{title}</p>
      <ul className="card divide-y divide-slate-100 dark:divide-white/8 overflow-hidden">{children}</ul>
    </div>
  );
}

function ResultRow({ href, onNavigate, children }: { href: string; onNavigate: () => void; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
      >
        {children}
      </Link>
    </li>
  );
}
```

Every `text-sm font-medium text-slate-900` and `text-xs text-slate-500` inside the four result maps (groups, friends, expenses, activity) gets the same `dark:text-slate-50` / `dark:text-slate-400` pair — four near-identical occurrences each, same substitution as everywhere else in this task. The activity row's `text-sm text-slate-800` gets `dark:text-slate-200`. The expense-icon circle `bg-brand-50 text-brand-700` gets `dark:bg-brand-500/15 dark:text-brand-400`.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 7: Visual check**

Dev server, Playwright, in light and dark: open the add-expense modal (top nav "+"), the create-group modal (Groups page "New group"), the invite-friends modal (create a group with `?welcome=1`, or trigger via the existing welcome flow), and the search overlay (dock search icon, type a query with results). Confirm every panel's text is legible, the scrim stays a flat dark tint (not blurred) behind the already-blurred panel, and the QR code image is still crisp. Zero new console errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/AddExpenseButton.tsx src/components/groups/CreateGroupForm.tsx \
  src/components/groups/InviteFriendsModal.tsx src/components/groups/InvitePanel.tsx src/components/search/GlobalSearchOverlay.tsx
git commit -m "style: dark mode pass for add-expense, create-group, invite, and search modals"
```

---

### Task 10: Shared UI primitives dark pass

**Files:**
- Modify: `src/components/ui/Alert.tsx`
- Modify: `src/components/ui/Button.tsx`
- Modify: `src/components/ui/EmptyState.tsx`
- Modify: `src/components/ui/Skeleton.tsx`

**Interfaces:** none new — these are consumed by nearly every screen already touched in Tasks 5-9, so this task closes the remaining gaps (tone-based Alert banners, the `secondary`/`ghost` button variants, EmptyState, and skeleton loading states, which appear on routes not otherwise touched by this plan, e.g. `activity`, `members`, `recurring`, `settle`).

- [ ] **Step 1: `Alert.tsx`**

Replace the `tones` map:

```ts
const tones = {
  info: 'bg-slate-100 dark:bg-white/8 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10',
  error: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-900/50',
  success: 'bg-brand-50 dark:bg-brand-950/40 text-brand-800 dark:text-brand-200 border-brand-200 dark:border-brand-900/50',
  warning: 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-900/50',
} as const;
```

- [ ] **Step 2: `Button.tsx`**

Replace the `secondary` and `ghost` variants (`primary` and `danger` need no change, per the Global Constraints table):

```ts
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-600',
  secondary:
    'bg-white dark:bg-brand-950 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-white/15 hover:bg-slate-50 dark:hover:bg-white/5 focus-visible:ring-slate-400',
  ghost: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 focus-visible:ring-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-600',
};
```

- [ ] **Step 3: `EmptyState.tsx`**

```tsx
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ink/20 dark:border-white/15 bg-receipt dark:bg-white/5 px-6 py-12 text-center">
      <p className="font-medium text-slate-800 dark:text-slate-100">{title}</p>
      {description ? <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
      {action}
    </div>
  );
}
```

- [ ] **Step 4: `Skeleton.tsx`**

```tsx
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-slate-200 dark:bg-white/10', className)} />;
}
```

```tsx
export function SkeletonRows({
  count = 3,
  avatarClassName = 'h-11 w-11',
}: {
  count?: number;
  avatarClassName?: string;
}) {
  return (
    <ul className="card divide-y divide-slate-100 dark:divide-white/8 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 p-4">
          <Skeleton className={cn('shrink-0 rounded-full', avatarClassName)} />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-14" />
        </li>
      ))}
    </ul>
  );
}
```

(`SkeletonField` needs no change — it only composes `Skeleton`, already covered.)

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Visual check**

Dev server, Playwright, in light and dark: trigger an error Alert (e.g. wrong password on `/login`), a success Alert (sign up with the password form), an EmptyState (a fresh account's `/friends` or `/groups` before adding anything), and a loading skeleton (throttle network in devtools, navigate to any group page and catch the `loading.tsx` frame). Confirm all four are legible in dark mode. Zero new console errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/Alert.tsx src/components/ui/Button.tsx src/components/ui/EmptyState.tsx src/components/ui/Skeleton.tsx
git commit -m "style: dark mode pass for shared Alert, Button, EmptyState, and Skeleton primitives"
```

---

### Task 11: Full-app verification and gate

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all existing tests pass, unchanged (no logic was touched in this plan).

- [ ] **Step 2: Run the full gate**

Stop any running `next dev` first (`netstat -ano | grep 3000`, kill if present — the gate's `next build` conflicts with a live dev server sharing `.next`). Then:

Run: `npm run gate`
Expected: unit tests, `tsc --noEmit`, `next build`, and the stub scan all pass clean.

- [ ] **Step 3: Full manual walkthrough, both themes**

Start `npm run dev`, log in via Playwright (`admin@abonoshare.app` / `adminadmin`), and click through every route this plan touched, in both light and dark (`prefers-color-scheme` emulation): `/`, `/login`, `/signup`, `/groups`, a group overview page, `/friends`, `/notifications`, `/settings`, `/settings/expenses`, the add-expense modal, the create-group modal, the invite-friends modal, and the global search overlay. For each: confirm no invisible text (the failure mode this whole dark-mode pass exists to catch), confirm exactly one blurred surface per glass element (open devtools, inspect a `.card` inside another `.card` if any exist — there should be none; inputs/buttons inside cards should show no `backdrop-filter` in computed styles), and confirm zero new console errors across the whole walkthrough.

- [ ] **Step 4: Fix anything found, otherwise done**

If Step 3 surfaces a missed spot (a stray `text-slate-900` with no dark: companion, a nested blur, a per-row card that should be consolidated), fix it in the relevant file, re-run `npm run typecheck`, and commit as a small follow-up:

```bash
git add <fixed files>
git commit -m "fix: address dark-mode/glass gaps found in full walkthrough"
```

If nothing is found, this task needs no commit — the plan is complete as of Task 10's commit.
