# Honey Neutral UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give AbonoShare's already-functional UI a considered "warm & friendly" visual identity (palette name: Honey Neutral), applied as shared design tokens plus a full layout pass on the three highest-traffic screens (group dashboard, expense form, settle up).

**Architecture:** Presentation-only change. Introduce CSS-variable-backed Tailwind color tokens (`bg`, `surface`, `surface-border`, `ink`, `ink-muted`, `honey`) that automatically flip between light and dark values via `prefers-color-scheme`, so most components need zero `dark:` classes — only spots using raw Tailwind palette colors (`rose-*`, `amber-*`, `brand-100/800`) get explicit `dark:` variants. Update shared primitives once (cascades to every page), then do a bespoke layout pass on the three key screens.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS 3, `next/font/google`, React 19 (Server Components + a few `'use client'` forms already in place). No new dependencies.

**Spec:** [docs/superpowers/specs/2026-09-06-ui-ux-redesign-design.md](../specs/2026-09-06-ui-ux-redesign-design.md)

## Global Constraints

- No changes to server actions, data fetching, RLS, or the balance engine — every task is JSX structure and Tailwind classes only.
- Money is never touched: don't change any `formatPHP`/centavo logic.
- `npm run gate -- --check` (unit tests, `tsc --noEmit`, `next build`, stub scan) must stay green after every task — this is the pass/fail bar, run it as each task's verification step instead of a unit test (there's no component-rendering test setup in this repo — `vitest.config.ts` runs `environment: 'node'` against `tests/**/*.test.ts` only, and no `@testing-library/react` is installed; adding that harness is out of scope for a presentation-only pass).
- Color token mapping used throughout (apply with `replace_all` within each file being edited — these are exact, mechanical swaps, not approximations):
  - `text-slate-900` → `text-ink`
  - `text-slate-800` → `text-ink`
  - `text-slate-700` → `text-ink-muted`
  - `text-slate-600` → `text-ink-muted`
  - `text-slate-500` → `text-ink-muted`
  - `text-slate-400` → `text-ink-muted`
  - `bg-white` → `bg-surface`
  - `bg-slate-50` (page/section backgrounds, not `.card`) → `bg-bg`
  - `border-slate-200` → `border-surface-border`
  - `border-slate-300` → `border-surface-border`
  - `divide-slate-100` → `divide-surface-border`
  - `hover:bg-slate-50` → `hover:bg-surface-border/30`
  - `hover:bg-slate-100` → `hover:bg-surface-border/40`
  - `hover:text-slate-800` → `hover:text-ink`
  - `focus:ring-slate-400` / `focus-visible:ring-slate-400` → `focus-visible:ring-surface-border`
  - Tokens are CSS variables (see Task 1), so classes built from them (`bg-surface`, `text-ink`, `border-surface-border`, `bg-bg`, `text-honey`, `bg-honey`) never need a paired `dark:` class — they flip automatically. Only raw Tailwind palette colors that remain in the file (`rose-*`, `amber-*`, `brand-100`, `brand-800`) need an explicit `dark:` variant added alongside them, called out per-task below.

---

## Task 1: Design tokens — Tailwind colors, CSS variables, Nunito font

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: Tailwind color utilities `bg-bg`, `bg-surface`, `border-surface-border`, `text-ink`, `text-ink-muted`, `text-honey`/`bg-honey`, and font utility `font-display` (Nunito) — every later task consumes these.

- [ ] **Step 1: Replace `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefbf4', 100: '#d6f5e3', 200: '#b0e9cb', 300: '#7dd7ad',
          400: '#47bd8b', 500: '#22a170', 600: '#15825a', 700: '#12684a',
          800: '#12523c', 900: '#104433', 950: '#06261d',
        },
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-border': 'var(--color-surface-border)',
        ink: 'var(--color-ink)',
        'ink-muted': 'var(--color-ink-muted)',
        honey: 'var(--color-honey)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 2: Replace `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-sans: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --color-bg: #FAF8F4;
  --color-surface: #FFFDF9;
  --color-surface-border: #EEE6D6;
  --color-ink: #3A342A;
  --color-ink-muted: #8A8070;
  --color-honey: #E8B94A;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #1F1B14;
    --color-surface: #2A251C;
    --color-surface-border: #3A3326;
    --color-ink: #F5EFE2;
    --color-ink-muted: #B8AD94;
    --color-honey: #F0C868;
  }
}

html { -webkit-text-size-adjust: 100%; }

body {
  @apply bg-bg text-ink antialiased;
}

@layer components {
  .card {
    @apply rounded-2xl border border-surface-border bg-surface shadow-sm;
  }
  .label {
    @apply block text-sm font-medium text-ink;
  }
  .input {
    @apply block w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-ink
           placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2
           focus:ring-brand-500/20 disabled:bg-surface-border/40 disabled:text-ink-muted;
  }
  .money-positive { @apply text-brand-600 dark:text-brand-400; }
  .money-negative { @apply text-rose-600 dark:text-rose-400; }
}

/* Keep long tables and wide content inside their own scroller. */
.scroll-x { @apply overflow-x-auto; }
```

- [ ] **Step 3: Wire up Nunito in `src/app/layout.tsx`**

Add the import and font instance, and put the font's CSS variable on `<html>`:

```tsx
import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';
import { SetupNotice } from '@/components/SetupNotice';
import { supabaseConfigured } from '@/lib/env';

const nunito = Nunito({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'AbonoShare — split group expenses fairly',
  description:
    'Someone pays, everyone gets their fair share worked out automatically, and the app tells you exactly who owes whom.',
};

export const viewport: Viewport = {
  themeColor: '#15825a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body>{supabaseConfigured ? children : <SetupNotice />}</body>
    </html>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run gate -- --check`
Expected: `GATE GREEN` (the font fetch happens during `next build`, which the gate already runs — confirms Nunito downloads and the config is valid).

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts src/app/globals.css src/app/layout.tsx
git commit -m "design: add Honey Neutral color tokens and Nunito display font"
```

---

## Task 2: Restyle shared primitives (Button, Alert, EmptyState)

**Files:**
- Modify: `src/components/ui/Button.tsx`
- Modify: `src/components/ui/Alert.tsx`
- Modify: `src/components/ui/EmptyState.tsx`

**Interfaces:**
- Consumes: tokens from Task 1 (`bg-surface`, `border-surface-border`, `text-ink`, `text-ink-muted`).
- No prop/API changes to any of the three components — pure class-value edits.

- [ ] **Step 1: Update `Button.tsx`'s `VARIANTS`**

Replace:
```ts
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-600',
  secondary:
    'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-600',
};
```
with:
```ts
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-600',
  secondary:
    'bg-surface text-ink border border-surface-border hover:bg-surface-border/30 focus-visible:ring-surface-border',
  ghost: 'text-ink-muted hover:bg-surface-border/30 focus-visible:ring-surface-border',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-600',
};
```

- [ ] **Step 2: Update `Alert.tsx`'s `tones`**

Replace:
```ts
  const tones = {
    info: 'bg-slate-100 text-slate-700 border-slate-200',
    error: 'bg-rose-50 text-rose-800 border-rose-200',
    success: 'bg-brand-50 text-brand-800 border-brand-200',
    warning: 'bg-amber-50 text-amber-900 border-amber-200',
  } as const;
```
with:
```ts
  const tones = {
    info: 'bg-surface-border/30 text-ink border-surface-border',
    error: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
    success: 'bg-brand-50 text-brand-800 border-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-900',
    warning: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900',
  } as const;
```

- [ ] **Step 3: Update `EmptyState.tsx`**

Replace the returned JSX:
```tsx
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {description ? <p className="max-w-sm text-sm text-slate-500">{description}</p> : null}
      {action}
    </div>
```
with:
```tsx
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-surface-border bg-surface px-6 py-12 text-center">
      <p className="font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action}
    </div>
```

- [ ] **Step 4: Verify**

Run: `npm run gate -- --check`
Expected: `GATE GREEN`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/Alert.tsx src/components/ui/EmptyState.tsx
git commit -m "design: retone Button, Alert, EmptyState to Honey Neutral tokens"
```

---

## Task 3: GroupHeader — member avatar stack + retoned tabs

**Files:**
- Modify: `src/components/groups/GroupHeader.tsx`
- Modify: `src/app/(app)/groups/[groupId]/page.tsx`
- Modify: `src/app/(app)/groups/[groupId]/settings/page.tsx`
- Modify: `src/app/(app)/groups/[groupId]/recurring/page.tsx`
- Modify: `src/app/(app)/groups/[groupId]/members/page.tsx`
- Modify: `src/app/(app)/groups/[groupId]/activity/page.tsx`

**Interfaces:**
- Produces: `GroupHeader` gains a new required prop `members: GroupHeaderMember[]` where `GroupHeaderMember = { id: string; name: string; avatarUrl: string | null }` (exported from `GroupHeader.tsx`). All 5 call sites (dashboard, settings, recurring, members, activity — `settle/page.tsx` imports `GroupHeader` but never renders it, so it's untouched) must pass it.
- Consumes: `bundle.activeMembers` (type `MemberWithProfile[]`, already in scope at every call site) and each member's `.profile?.display_name` / `.profile?.avatar_url`.

- [ ] **Step 1: Replace `src/components/groups/GroupHeader.tsx`**

```tsx
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import type { Group } from '@/types/db';

const TABS = [
  { href: '', label: 'Overview' },
  { href: '/activity', label: 'Activity' },
  { href: '/members', label: 'Members' },
  { href: '/recurring', label: 'Recurring' },
  { href: '/settings', label: 'Settings' },
] as const;

export interface GroupHeaderMember {
  id: string;
  name: string;
  avatarUrl: string | null;
}

const MAX_AVATARS = 5;

export function GroupHeader({
  group,
  memberCount,
  members,
  current = '',
}: {
  group: Group;
  memberCount: number;
  members: GroupHeaderMember[];
  current?: string;
}) {
  const shown = members.slice(0, MAX_AVATARS);
  const overflow = members.length - shown.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar name={group.name} src={group.avatar_url} seed={group.avatar_seed} size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-extrabold tracking-tight text-ink">
            {group.name}
          </h1>
          <p className="text-sm text-ink-muted">
            {memberCount} {memberCount === 1 ? 'member' : 'members'} · Philippine Peso
          </p>
        </div>
      </div>

      {shown.length > 0 ? (
        <div className="flex items-center" aria-label="Group members">
          {shown.map((member, i) => (
            <Avatar
              key={member.id}
              name={member.name}
              src={member.avatarUrl}
              size={30}
              className={`ring-2 ring-bg ${i > 0 ? '-ml-2' : ''}`}
            />
          ))}
          {overflow > 0 ? (
            <span
              className="-ml-2 inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-surface-border text-[11px] font-semibold text-ink ring-2 ring-bg"
              aria-hidden
            >
              +{overflow}
            </span>
          ) : null}
        </div>
      ) : null}

      <nav className="scroll-x -mx-1 flex gap-1 border-b border-surface-border pb-px">
        {TABS.map((tab) => {
          const active = current === tab.href;
          return (
            <Link
              key={tab.href}
              href={`/groups/${group.id}${tab.href}`}
              className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400'
                  : 'border-b-2 border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Update the 5 call sites to pass `members`**

In `src/app/(app)/groups/[groupId]/page.tsx`, replace:
```tsx
      <GroupHeader group={bundle.group} memberCount={bundle.activeMembers.length} />
```
with:
```tsx
      <GroupHeader
        group={bundle.group}
        memberCount={bundle.activeMembers.length}
        members={bundle.activeMembers.map((m) => ({
          id: m.user_id,
          name: m.profile?.display_name ?? 'Member',
          avatarUrl: m.profile?.avatar_url ?? null,
        }))}
      />
```

In `src/app/(app)/groups/[groupId]/settings/page.tsx`, replace:
```tsx
      <GroupHeader
        group={bundle.group}
        memberCount={bundle.activeMembers.length}
        current="/settings"
      />
```
with:
```tsx
      <GroupHeader
        group={bundle.group}
        memberCount={bundle.activeMembers.length}
        members={bundle.activeMembers.map((m) => ({
          id: m.user_id,
          name: m.profile?.display_name ?? 'Member',
          avatarUrl: m.profile?.avatar_url ?? null,
        }))}
        current="/settings"
      />
```

In `src/app/(app)/groups/[groupId]/recurring/page.tsx`, replace:
```tsx
      <GroupHeader
        group={bundle.group}
        memberCount={bundle.activeMembers.length}
        current="/recurring"
      />
```
with:
```tsx
      <GroupHeader
        group={bundle.group}
        memberCount={bundle.activeMembers.length}
        members={bundle.activeMembers.map((m) => ({
          id: m.user_id,
          name: m.profile?.display_name ?? 'Member',
          avatarUrl: m.profile?.avatar_url ?? null,
        }))}
        current="/recurring"
      />
```

In `src/app/(app)/groups/[groupId]/members/page.tsx`, replace:
```tsx
      <GroupHeader
        group={bundle.group}
        memberCount={bundle.activeMembers.length}
        current="/members"
      />
```
with:
```tsx
      <GroupHeader
        group={bundle.group}
        memberCount={bundle.activeMembers.length}
        members={bundle.activeMembers.map((m) => ({
          id: m.user_id,
          name: m.profile?.display_name ?? 'Member',
          avatarUrl: m.profile?.avatar_url ?? null,
        }))}
        current="/members"
      />
```

In `src/app/(app)/groups/[groupId]/activity/page.tsx`, replace:
```tsx
      <GroupHeader
        group={bundle.group}
        memberCount={bundle.activeMembers.length}
        current="/activity"
      />
```
with:
```tsx
      <GroupHeader
        group={bundle.group}
        memberCount={bundle.activeMembers.length}
        members={bundle.activeMembers.map((m) => ({
          id: m.user_id,
          name: m.profile?.display_name ?? 'Member',
          avatarUrl: m.profile?.avatar_url ?? null,
        }))}
        current="/activity"
      />
```

- [ ] **Step 3: Verify**

Run: `npm run gate -- --check`
Expected: `GATE GREEN` (`tsc --noEmit` specifically confirms the new required prop is satisfied everywhere `GroupHeader` is rendered).

- [ ] **Step 4: Commit**

```bash
git add src/components/groups/GroupHeader.tsx "src/app/(app)/groups/[groupId]/page.tsx" "src/app/(app)/groups/[groupId]/settings/page.tsx" "src/app/(app)/groups/[groupId]/recurring/page.tsx" "src/app/(app)/groups/[groupId]/members/page.tsx" "src/app/(app)/groups/[groupId]/activity/page.tsx"
git commit -m "design: add member avatar stack to GroupHeader, retone tabs"
```

---

## Task 4: BalanceSummary + NudgeButton restyle

**Files:**
- Modify: `src/components/groups/BalanceSummary.tsx`
- Modify: `src/components/groups/NudgeButton.tsx`

**Interfaces:** No prop changes to either component.

- [ ] **Step 1: Update `BalanceSummary.tsx`**

Replace the settled-up branch:
```tsx
  if (summary.settledUp) {
    return (
      <div className="card p-5">
        <p className="text-lg font-semibold text-slate-900">You are all settled up</p>
        <p className="mt-1 text-sm text-slate-600">
          Nobody owes you anything in this group, and you owe nothing.
        </p>
      </div>
    );
  }
```
with:
```tsx
  if (summary.settledUp) {
    return (
      <div className="card p-5">
        <p className="font-display text-lg font-extrabold text-ink">You are all settled up</p>
        <p className="mt-1 text-sm text-ink-muted">
          Nobody owes you anything in this group, and you owe nothing.
        </p>
      </div>
    );
  }
```

Replace the balance header block:
```tsx
      <div className={`px-5 py-4 ${owedMode ? 'bg-brand-50' : 'bg-rose-50'}`}>
        <p className="text-sm text-slate-600">{owedMode ? 'You are owed' : 'You owe'}</p>
        <p
          className={`text-3xl font-semibold tracking-tight ${
            owedMode ? 'money-positive' : 'money-negative'
          }`}
        >
          {formatPHP(Math.abs(summary.net))}
        </p>
      </div>
```
with:
```tsx
      <div
        className={`px-5 py-4 ${
          owedMode
            ? 'bg-brand-50 dark:bg-brand-950/40'
            : 'bg-rose-50 dark:bg-rose-950/40'
        }`}
      >
        <p className="text-sm text-ink-muted">{owedMode ? 'You are owed' : 'You owe'}</p>
        <p
          className={`font-display text-3xl font-extrabold tracking-tight ${
            owedMode ? 'money-positive' : 'money-negative'
          }`}
        >
          {formatPHP(Math.abs(summary.net))}
        </p>
      </div>
```

Replace the two list rows (there are two `<li>` blocks — apply to both). First:
```tsx
          <li key={line.userId} className="flex items-center gap-3 px-5 py-3">
            <Avatar name={nameOf(line.userId)} src={avatarOf(line.userId)} size={34} />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
              <strong className="font-medium text-slate-900">{nameOf(line.userId)}</strong> owes you
            </span>
            <span className="font-semibold money-positive">{formatPHP(line.amount)}</span>
```
with:
```tsx
          <li key={line.userId} className="flex items-center gap-3 px-5 py-3">
            <Avatar name={nameOf(line.userId)} src={avatarOf(line.userId)} size={34} />
            <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
              <strong className="font-medium text-ink">{nameOf(line.userId)}</strong> owes you
            </span>
            <span className="font-semibold money-positive">{formatPHP(line.amount)}</span>
```

Second:
```tsx
          <li key={line.userId} className="flex items-center gap-3 px-5 py-3">
            <Avatar name={nameOf(line.userId)} src={avatarOf(line.userId)} size={34} />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
              You owe <strong className="font-medium text-slate-900">{nameOf(line.userId)}</strong>
            </span>
            <span className="font-semibold money-negative">{formatPHP(line.amount)}</span>
```
with:
```tsx
          <li key={line.userId} className="flex items-center gap-3 px-5 py-3">
            <Avatar name={nameOf(line.userId)} src={avatarOf(line.userId)} size={34} />
            <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
              You owe <strong className="font-medium text-ink">{nameOf(line.userId)}</strong>
            </span>
            <span className="font-semibold money-negative">{formatPHP(line.amount)}</span>
```

Replace `divide-slate-100` (once) and the "Settle" link's classes:
```tsx
      <ul className="divide-y divide-slate-100">
```
with:
```tsx
      <ul className="divide-y divide-surface-border">
```

```tsx
            <Link
              href={`/groups/${groupId}/settle/${line.userId}`}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            >
```
This link's classes are unchanged (brand-600/700 already work in both modes) — no edit needed here.

- [ ] **Step 2: Update `NudgeButton.tsx`**

Replace:
```tsx
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
```
with:
```tsx
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-border/30 disabled:opacity-60"
```

- [ ] **Step 3: Verify**

Run: `npm run gate -- --check`
Expected: `GATE GREEN`.

- [ ] **Step 4: Commit**

```bash
git add src/components/groups/BalanceSummary.tsx src/components/groups/NudgeButton.tsx
git commit -m "design: retone BalanceSummary and NudgeButton, Nunito for the balance number"
```

---

## Task 5: Dashboard page + ExpenseRow + ExpenseFilters restyle

**Files:**
- Modify: `src/app/(app)/groups/[groupId]/page.tsx`
- Modify: `src/components/expenses/ExpenseRow.tsx`
- Modify: `src/components/expenses/ExpenseFilters.tsx`

**Interfaces:** No prop changes to any of the three.

- [ ] **Step 1: Update `src/app/(app)/groups/[groupId]/page.tsx`**

Replace the pending-settlement banner:
```tsx
        <Link
          href={`/groups/${groupId}/settle`}
          className="card flex items-center gap-3 border-amber-300 bg-amber-50 p-4 hover:border-amber-400"
        >
          <Wallet size={18} className="text-amber-700" />
          <span className="flex-1 text-sm text-amber-900">
```
with:
```tsx
        <Link
          href={`/groups/${groupId}/settle`}
          className="card flex items-center gap-3 border-amber-300 bg-amber-50 p-4 hover:border-amber-400 dark:border-amber-800 dark:bg-amber-950/40 dark:hover:border-amber-700"
        >
          <Wallet size={18} className="text-amber-700 dark:text-amber-400" />
          <span className="flex-1 text-sm text-amber-900 dark:text-amber-200">
```
and:
```tsx
          <ArrowRight size={16} className="text-amber-700" />
```
with:
```tsx
          <ArrowRight size={16} className="text-amber-700 dark:text-amber-400" />
```

Replace the section headings (there are two identical-pattern headings — "Expenses" and "Recent settlements"):
```tsx
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Expenses</h2>
```
with:
```tsx
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Expenses</h2>
```
```tsx
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recent settlements
          </h2>
```
with:
```tsx
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Recent settlements
          </h2>
```

Replace the recent-settlements list:
```tsx
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {recentSettlements.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1 text-slate-700">
                  <strong className="font-medium text-slate-900">
                    {s.from_user_id === bundle.me.id ? 'You' : bundle.nameOf(s.from_user_id)}
                  </strong>{' '}
                  paid{' '}
                  <strong className="font-medium text-slate-900">
                    {s.to_user_id === bundle.me.id ? 'you' : bundle.nameOf(s.to_user_id)}
                  </strong>{' '}
                  {formatPHP(s.amount_centavos)}
                </span>
                <StatusPill status={s.status} />
                <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">
                  {relativeTime(s.created_at)}
                </span>
              </li>
            ))}
          </ul>
```
with:
```tsx
          <ul className="card divide-y divide-surface-border overflow-hidden">
            {recentSettlements.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1 text-ink-muted">
                  <strong className="font-medium text-ink">
                    {s.from_user_id === bundle.me.id ? 'You' : bundle.nameOf(s.from_user_id)}
                  </strong>{' '}
                  paid{' '}
                  <strong className="font-medium text-ink">
                    {s.to_user_id === bundle.me.id ? 'you' : bundle.nameOf(s.to_user_id)}
                  </strong>{' '}
                  {formatPHP(s.amount_centavos)}
                </span>
                <StatusPill status={s.status} />
                <span className="hidden shrink-0 text-xs text-ink-muted sm:inline">
                  {relativeTime(s.created_at)}
                </span>
              </li>
            ))}
          </ul>
```

Replace the `Stat` helper component:
```tsx
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
```
with:
```tsx
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}
```

Replace the `StatusPill` helper component:
```tsx
function StatusPill({ status }: { status: 'pending' | 'confirmed' | 'rejected' }) {
  const styles = {
    pending: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-brand-100 text-brand-800',
    rejected: 'bg-slate-200 text-slate-600',
  } as const;
```
with:
```tsx
function StatusPill({ status }: { status: 'pending' | 'confirmed' | 'rejected' }) {
  const styles = {
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    confirmed: 'bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300',
    rejected: 'bg-surface-border text-ink-muted',
  } as const;
```

- [ ] **Step 2: Update `ExpenseRow.tsx`**

Replace:
```tsx
      className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${
        deleted ? 'opacity-60' : ''
      }`}
```
with:
```tsx
      className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-border/30 ${
        deleted ? 'opacity-60' : ''
      }`}
```

Replace:
```tsx
        <p
          className={`truncate font-medium text-slate-900 ${deleted ? 'line-through' : ''}`}
        >
          {expense.description}
        </p>
        <p className="truncate text-xs text-slate-500">
```
with:
```tsx
        <p
          className={`truncate font-medium text-ink ${deleted ? 'line-through' : ''}`}
        >
          {expense.description}
        </p>
        <p className="truncate text-xs text-ink-muted">
```

Replace:
```tsx
        {deleted || delta === 0 ? (
          <span className="text-xs text-slate-400">no effect</span>
        ) : (
          <>
            <p className="text-[11px] text-slate-500">{delta > 0 ? 'you lent' : 'you borrowed'}</p>
```
with:
```tsx
        {deleted || delta === 0 ? (
          <span className="text-xs text-ink-muted">no effect</span>
        ) : (
          <>
            <p className="text-[11px] text-ink-muted">{delta > 0 ? 'you lent' : 'you borrowed'}</p>
```

- [ ] **Step 3: Update `ExpenseFilters.tsx`**

Replace:
```tsx
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
```
with:
```tsx
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
```

Replace:
```tsx
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
```
with:
```tsx
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface px-3 text-sm font-medium text-ink-muted hover:bg-surface-border/30"
        >
```

Replace:
```tsx
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
```
with:
```tsx
          <label className="flex items-center gap-2 text-sm text-ink-muted sm:col-span-2">
```

Replace both occurrences of:
```tsx
        <ul className="card divide-y divide-slate-100 overflow-hidden">
```
with (only one occurs in this file, inside the `filtered.map` branch):
```tsx
        <ul className="card divide-y divide-surface-border overflow-hidden">
```

- [ ] **Step 4: Verify**

Run: `npm run gate -- --check`
Expected: `GATE GREEN`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/groups/[groupId]/page.tsx" src/components/expenses/ExpenseRow.tsx src/components/expenses/ExpenseFilters.tsx
git commit -m "design: retone dashboard, expense list, and filters to Honey Neutral"
```

---

## Task 6: ExpenseForm — retone + category chips

**Files:**
- Modify: `src/components/expenses/ExpenseForm.tsx`

**Interfaces:** No prop changes to `ExpenseForm`. Internal: adds a `category` piece of state (`ExpenseCategory`), replacing the uncontrolled `<select name="category">` with a hidden input of the same name plus a chip picker — the form's submitted field name (`category`) is unchanged, so `src/lib/actions/expenses.ts` (`formData.get('category')`) needs no change.

- [ ] **Step 1: Add `category` state**

Replace:
```tsx
  const [amount, setAmount] = useState(initial.amount);
  const [payerId, setPayerId] = useState(initial.payerId);
  const [participants, setParticipants] = useState<string[]>(initial.participants);
  const [splitMode, setSplitMode] = useState<SplitModeDb>(initial.splitMode);
  const [exact, setExact] = useState<Record<string, string>>(initial.exactShares);
```
with:
```tsx
  const [amount, setAmount] = useState(initial.amount);
  const [payerId, setPayerId] = useState(initial.payerId);
  const [participants, setParticipants] = useState<string[]>(initial.participants);
  const [splitMode, setSplitMode] = useState<SplitModeDb>(initial.splitMode);
  const [exact, setExact] = useState<Record<string, string>>(initial.exactShares);
  const [category, setCategory] = useState<ExpenseCategory>(initial.category);
```

- [ ] **Step 2: Replace the category `<select>` with chips**

Replace:
```tsx
        <div>
          <label className="label" htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={initial.category} className="input mt-1.5">
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>
```
with:
```tsx
        <div>
          <label className="label">Category</label>
          <input type="hidden" name="category" value={category} />
          <div className="mt-1.5 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const active = category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'border-honey bg-honey/20 text-ink'
                      : 'border-surface-border bg-surface text-ink-muted hover:border-honey/60'
                  }`}
                >
                  <span aria-hidden>{c.emoji}</span> {c.label}
                </button>
              );
            })}
          </div>
        </div>
```

- [ ] **Step 3: Retone remaining classes**

Replace:
```tsx
          <label className="label" htmlFor="description">What was it for?</label>
```
(no change — `.label` class already retoned in Task 1; skip.)

Replace:
```tsx
            <p className="font-medium text-slate-900">Split between</p>
            <p className="text-sm text-slate-600">
              Untick anyone who wasn&apos;t there — they won&apos;t be charged.
            </p>
          </div>
          <div className="flex rounded-lg border border-slate-300 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setSplitMode('equal')}
              className={`rounded-md px-3 py-1.5 font-medium ${splitMode === 'equal' ? 'bg-brand-600 text-white' : 'text-slate-600'}`}
            >
              Equally
            </button>
            <button
              type="button"
              onClick={() => { setSplitMode('exact'); splitEvenlyIntoExact(); }}
              className={`rounded-md px-3 py-1.5 font-medium ${splitMode === 'exact' ? 'bg-brand-600 text-white' : 'text-slate-600'}`}
            >
              Exact amounts
            </button>
          </div>
```
with:
```tsx
            <p className="font-medium text-ink">Split between</p>
            <p className="text-sm text-ink-muted">
              Untick anyone who wasn&apos;t there — they won&apos;t be charged.
            </p>
          </div>
          <div className="flex rounded-lg border border-surface-border p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setSplitMode('equal')}
              className={`rounded-md px-3 py-1.5 font-medium ${splitMode === 'equal' ? 'bg-brand-600 text-white' : 'text-ink-muted'}`}
            >
              Equally
            </button>
            <button
              type="button"
              onClick={() => { setSplitMode('exact'); splitEvenlyIntoExact(); }}
              className={`rounded-md px-3 py-1.5 font-medium ${splitMode === 'exact' ? 'bg-brand-600 text-white' : 'text-ink-muted'}`}
            >
              Exact amounts
            </button>
          </div>
```

Replace:
```tsx
        <ul className="divide-y divide-slate-100">
```
with:
```tsx
        <ul className="divide-y divide-surface-border">
```

Replace:
```tsx
                <input
                  type="checkbox"
                  id={`p-${member.id}`}
                  checked={checked}
                  onChange={() => toggleParticipant(member.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                {checked ? <input type="hidden" name="participants" value={member.id} /> : null}
                <Avatar name={member.name} src={member.avatarUrl} size={32} />
                <label htmlFor={`p-${member.id}`} className="min-w-0 flex-1 truncate text-sm text-slate-800">
```
with:
```tsx
                <input
                  type="checkbox"
                  id={`p-${member.id}`}
                  checked={checked}
                  onChange={() => toggleParticipant(member.id)}
                  className="h-4 w-4 rounded border-surface-border text-brand-600 focus:ring-brand-500"
                />
                {checked ? <input type="hidden" name="participants" value={member.id} /> : null}
                <Avatar name={member.name} src={member.avatarUrl} size={32} />
                <label htmlFor={`p-${member.id}`} className="min-w-0 flex-1 truncate text-sm text-ink">
```

Replace:
```tsx
                ) : checked && preview?.shares ? (
                  <span className="text-sm font-medium text-slate-700">
                    {formatPHP(preview.shares[member.id] ?? 0)}
                  </span>
                ) : null}
```
with:
```tsx
                ) : checked && preview?.shares ? (
                  <span className="text-sm font-medium text-ink-muted">
                    {formatPHP(preview.shares[member.id] ?? 0)}
                  </span>
                ) : null}
```

Replace:
```tsx
          <input
            id="receipt"
            name="receipt"
            type="file"
            accept="image/*,application/pdf"
            className="mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          <p className="mt-1 text-xs text-slate-500">
            Everyone in the group can see receipts. Up to 10 MB.
          </p>
```
with:
```tsx
          <input
            id="receipt"
            name="receipt"
            type="file"
            accept="image/*,application/pdf"
            className="mt-1.5 block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-border/50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-surface-border"
          />
          <p className="mt-1 text-xs text-ink-muted">
            Everyone in the group can see receipts. Up to 10 MB.
          </p>
```

- [ ] **Step 4: Verify**

Run: `npm run gate -- --check`
Expected: `GATE GREEN` — `tsc --noEmit` confirms `category` state is typed `ExpenseCategory` and matches the hidden input's `value`.

Manual check: run `npm run dev`, open a group's "Add expense" page, click through the category chips and confirm the selected one visibly highlights and the form still submits with the right category (check the created expense's category matches what was clicked).

- [ ] **Step 5: Commit**

```bash
git add src/components/expenses/ExpenseForm.tsx
git commit -m "design: retone ExpenseForm and replace category select with honey-accented chips"
```

---

## Task 7: SettleForm + settle pages restyle

**Files:**
- Modify: `src/components/settlements/SettleForm.tsx`
- Modify: `src/app/(app)/groups/[groupId]/settle/page.tsx`
- Modify: `src/app/(app)/groups/[groupId]/settle/[userId]/page.tsx`

**Interfaces:** No prop changes. `SettlementResponse.tsx` (confirm/reject) needs no edit — it already uses the `Button` primary/secondary variants retoned in Task 2, which already makes confirm (primary/brand) visually dominant over reject (secondary/outline).

- [ ] **Step 1: Update `SettleForm.tsx`**

Replace:
```tsx
          <div>
            <p className="font-medium text-slate-900">You owe {recipient.name}</p>
            <p className="text-2xl font-semibold money-negative">{formatPHP(maxCentavos)}</p>
          </div>
```
with:
```tsx
          <div>
            <p className="font-medium text-ink">You owe {recipient.name}</p>
            <p className="font-display text-2xl font-extrabold money-negative">{formatPHP(maxCentavos)}</p>
          </div>
```

Replace:
```tsx
          <p className="mt-1 text-xs text-slate-500">
            Paying less than the full amount is fine. You cannot enter more than{' '}
            {formatPHP(maxCentavos)}.
          </p>
```
with:
```tsx
          <p className="mt-1 text-xs text-ink-muted">
            Paying less than the full amount is fine. You cannot enter more than{' '}
            {formatPHP(maxCentavos)}.
          </p>
```

Replace:
```tsx
          <p className="mt-1 text-xs text-slate-500">
            A GCash, Maya or bank screenshot. Only you and {recipient.name} can see it — nobody else
            in the group can.
          </p>
```
with:
```tsx
          <p className="mt-1 text-xs text-ink-muted">
            A GCash, Maya or bank screenshot. Only you and {recipient.name} can see it — nobody else
            in the group can.
          </p>
```

Replace the file-input classes (same pattern as `ExpenseForm.tsx`):
```tsx
            className="mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
```
with:
```tsx
            className="mt-1.5 block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-border/50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-surface-border"
```

- [ ] **Step 2: Update `settle/page.tsx`**

Replace:
```tsx
      <Link
        href={`/groups/${groupId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> {bundle.group.name}
      </Link>

      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Settle up</h1>
```
with:
```tsx
      <Link
        href={`/groups/${groupId}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={16} /> {bundle.group.name}
      </Link>

      <h1 className="font-display text-xl font-extrabold tracking-tight text-ink">Settle up</h1>
```

Replace all four section headings in this file (each follows the same `<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">` pattern):
```tsx
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Waiting for you
          </h2>
```
with:
```tsx
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Waiting for you
          </h2>
```
```tsx
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          What you owe
        </h2>
```
with:
```tsx
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          What you owe
        </h2>
```
```tsx
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Owed to you
          </h2>
```
with:
```tsx
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Owed to you
          </h2>
```
```tsx
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Your settlement history
          </h2>
```
with:
```tsx
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Your settlement history
          </h2>
```

Replace the "waiting for you" card body:
```tsx
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">
                      <strong className="font-medium">{bundle.nameOf(s.from_user_id)}</strong> says
                      they paid you {formatPHP(s.amount_centavos)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {PAYMENT_METHOD_LABEL[s.method]} · {formatDateTime(s.created_at)}
                      {s.note ? ` · "${s.note}"` : ''}
                    </p>
                  </div>
```
with:
```tsx
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      <strong className="font-medium">{bundle.nameOf(s.from_user_id)}</strong> says
                      they paid you {formatPHP(s.amount_centavos)}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {PAYMENT_METHOD_LABEL[s.method]} · {formatDateTime(s.created_at)}
                      {s.note ? ` · "${s.note}"` : ''}
                    </p>
                  </div>
```

Replace all three `divide-slate-100` occurrences in this file (three separate `<ul className="card divide-y divide-slate-100 overflow-hidden">` blocks):
```tsx
          <ul className="card divide-y divide-slate-100 overflow-hidden">
```
→ (apply to all three occurrences)
```tsx
          <ul className="card divide-y divide-surface-border overflow-hidden">
```

Replace the "what you owe" row text and the "owed to you" row text:
```tsx
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                    {bundle.nameOf(line.userId)}
                  </span>
                  <span className="font-semibold money-negative">{formatPHP(line.amount)}</span>
                  <ArrowRight size={16} className="text-slate-300" />
```
with:
```tsx
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {bundle.nameOf(line.userId)}
                  </span>
                  <span className="font-semibold money-negative">{formatPHP(line.amount)}</span>
                  <ArrowRight size={16} className="text-ink-muted" />
```

```tsx
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                  {bundle.nameOf(line.userId)}
                </span>
                <span className="font-semibold money-positive">{formatPHP(line.amount)}</span>
```
with:
```tsx
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {bundle.nameOf(line.userId)}
                </span>
                <span className="font-semibold money-positive">{formatPHP(line.amount)}</span>
```

Replace the settlement-history row and status pill:
```tsx
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 text-slate-700">
                  {s.from_user_id === bundle.me.id
                    ? `You paid ${bundle.nameOf(s.to_user_id)}`
                    : `${bundle.nameOf(s.from_user_id)} paid you`}{' '}
                  <strong className="font-medium text-slate-900">
                    {formatPHP(s.amount_centavos)}
                  </strong>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.status === 'confirmed'
                      ? 'bg-brand-100 text-brand-800'
                      : s.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {s.status}
                </span>
              </li>
```
with:
```tsx
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 text-ink-muted">
                  {s.from_user_id === bundle.me.id
                    ? `You paid ${bundle.nameOf(s.to_user_id)}`
                    : `${bundle.nameOf(s.from_user_id)} paid you`}{' '}
                  <strong className="font-medium text-ink">
                    {formatPHP(s.amount_centavos)}
                  </strong>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.status === 'confirmed'
                      ? 'bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300'
                      : s.status === 'pending'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                        : 'bg-surface-border text-ink-muted'
                  }`}
                >
                  {s.status}
                </span>
              </li>
```

- [ ] **Step 3: Update `settle/[userId]/page.tsx`**

Replace:
```tsx
      <Link
        href={`/groups/${groupId}/settle`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Settle up
      </Link>

      <h1 className="text-xl font-semibold tracking-tight text-slate-900">
        Record a payment
      </h1>
```
with:
```tsx
      <Link
        href={`/groups/${groupId}/settle`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={16} /> Settle up
      </Link>

      <h1 className="font-display text-xl font-extrabold tracking-tight text-ink">
        Record a payment
      </h1>
```

- [ ] **Step 4: Verify**

Run: `npm run gate -- --check`
Expected: `GATE GREEN`.

Manual check: run `npm run dev`, open a group with an outstanding balance, go to Settle Up, confirm the confirm/reject buttons on an incoming pending settlement are visually distinct (green solid vs. outline), and the amounts render correctly.

- [ ] **Step 5: Commit**

```bash
git add src/components/settlements/SettleForm.tsx "src/app/(app)/groups/[groupId]/settle/page.tsx" "src/app/(app)/groups/[groupId]/settle/[userId]/page.tsx"
git commit -m "design: retone settle up screens to Honey Neutral"
```

---

## Task 8: Final verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full gate**

Run: `npm run gate -- --check`
Expected: `GATE GREEN — tests, types, build and stub scan all pass.`

- [ ] **Step 2: Manual click-through in light mode**

Run: `npm run dev`, open `http://localhost:3000`, sign in (or use an existing seeded account), and open a group with at least 2 members and a mix of settled/unsettled balances. Confirm:
- Group dashboard shows the member avatar stack, the tab strip, and the balance line in Nunito.
- Add-expense form shows category chips (not a dropdown) and the selected chip is visibly highlighted.
- Settle Up shows a clear green "Confirm" vs. outline "Reject" on any pending incoming settlement.

- [ ] **Step 3: Manual click-through in dark mode**

Switch the OS/browser to dark mode (`prefers-color-scheme: dark`) — no in-app toggle exists, this is OS-level. Reload the same three screens and confirm text stays readable (no dark text on dark background, no white-on-white), and the balance/status colors (green/rose/amber) still read clearly.

- [ ] **Step 4: Report**

If everything in Steps 2–3 looks right, the redesign pass is done — no commit needed for this task (it's verification only). If something looks wrong, note which screen/mode and fix it in the relevant earlier task's files before considering the plan complete.
