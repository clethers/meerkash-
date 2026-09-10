# App UI Consistency Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the visual gap between the newly-redesigned landing/auth pages and the plain-Tailwind interior app screens, without touching layout, structure, or body-text color — a palette + label-casing pass only.

**Architecture:** Two independent, additive changes: (1) three new Tailwind color tokens reusing the landing page's exact hex values, applied at the two single-definition sites that control every screen's canvas and card background (`globals.css`'s `body` and `.card` rules), and (2) a new shared `SectionLabel` component replacing the repeated `uppercase tracking-wide` className string at its ~19 call sites, so the "shouty eyebrow label" pattern is replaced with a quieter sentence-case treatment everywhere at once.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS, TypeScript. No new dependencies.

**Spec:** This plan was scoped directly from an in-chat UI/UX audit (frontend-design skill) rather than a separate written spec — see the audit findings in conversation. Summary of what's in/out of scope below stands in for a spec document.

## Global Constraints

- No structural, layout, or information-architecture changes — this is a restyle only.
- Do NOT change `text-slate-900` / `text-slate-600` body-text colors anywhere — explicitly out of scope.
- Reuse the exact hex values already established on the landing page (`src/app/landing.module.css`): paper `#eef2ee`, receipt `#fbfbf8`. Do not invent new colors.
- Every existing heading tag (`h2` vs `h3`) must stay the same tag after the label refactor — only the CSS class changes, not the semantic heading level.
- `npm run typecheck` must stay clean after every task. Do not run `npm run gate` / `next build` while a `next dev` server is running (shared `.next` directory corrupts) — check `netstat -ano | grep 3000` first if unsure.
- Verify visually with Playwright against the running dev server (login: `admin@abonoshare.app` / `adminadmin`) — screenshot before/after, confirm zero new console errors. Delete scratch verification scripts when done.

---

## File Structure

- **Modify `tailwind.config.ts`**: add `paper` and `receipt` color tokens.
- **Modify `src/app/globals.css`**: repoint `body` background and `.card` background/border at the new tokens. This is the single highest-leverage change — every screen and every card recolors from these two rules.
- **Create `src/components/ui/SectionLabel.tsx`**: one small component replacing the repeated all-caps className string.
- **Modify 11 page/component files**: swap the raw `uppercase tracking-wide` heading markup for `<SectionLabel>` (19 call sites total).
- **Modify 2 files** (`src/app/(app)/groups/[groupId]/page.tsx`, `src/app/(app)/groups/[groupId]/spending/page.tsx`): drop the same all-caps treatment from their local `Stat` mini-label `<p>` tags (different shape, not worth a shared component for 2 sites).

Explicitly NOT touched: `src/components/auth/AuthForms.tsx`'s "or" divider (a divider label, not a section-eyebrow — different role, leave as-is).

---

### Task 1: Palette tokens + canvas/card retint

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: Tailwind utility classes `bg-paper`, `text-paper`, `border-paper` (and `/opacity` variants), `bg-receipt` etc., available to every file in `src/` from this point on.

- [ ] **Step 1: Add the two color tokens**

In `tailwind.config.ts`, add `paper` and `receipt` alongside the existing `brand` scale:

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
        paper: '#eef2ee',
        receipt: '#fbfbf8',
        ink: '#10241c',
      },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
```

(`ink` is added now even though this task is the only consumer, so the border in Step 2 can use `border-ink/15` — a soft, warm-toned line instead of Tailwind's default cool-gray `slate-200`, matching the landing page's `rgba(16, 36, 28, 0.16)` rule color almost exactly.)

- [ ] **Step 2: Repoint the canvas and card styles**

In `src/app/globals.css`, change:

```css
body {
  @apply bg-slate-50 text-slate-900 antialiased;
}

@layer components {
  .card {
    @apply rounded-2xl border border-slate-200 bg-white shadow-sm;
  }
```

to:

```css
body {
  @apply bg-paper text-slate-900 antialiased;
}

@layer components {
  .card {
    @apply rounded-2xl border border-ink/15 bg-receipt shadow-sm;
  }
```

Leave every other rule in the file (`.label`, `.input`, `.money-positive`, `.money-negative`, `.scroll-x`) untouched — `text-slate-900` in `body` stays exactly as it is per the Global Constraints.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: clean, no errors (this is a CSS/config-only change, nothing to typecheck against, but confirms nothing else broke).

- [ ] **Step 4: Visual check**

With the dev server running (`npm run dev`, or reuse an already-running one on port 3000), use Playwright to log in (`admin@abonoshare.app` / `adminadmin`) and screenshot `/groups` and any group's overview page. Confirm: page background reads as a soft warm paper tone (not the previous cool gray), every card has a slightly warm off-white fill with a soft warm-toned border, and text is still clearly readable (no contrast regression — `text-slate-900` on `#eef2ee` remains very high contrast). Confirm zero new console errors.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts src/app/globals.css
git commit -m "style: apply landing page's paper/receipt palette to app canvas and cards"
```

(If this repo has no git remote/history yet, skip the commit and just leave the change staged — check `git status` first; do not initialize git yourself.)

---

### Task 2: Shared SectionLabel component

**Files:**
- Create: `src/components/ui/SectionLabel.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils` (signature: `cn(...inputs: ClassValue[]): string`, already used identically in `src/components/ui/Avatar.tsx`).
- Produces: `SectionLabel` component — `{ as?: 'h2' | 'h3'; children: React.ReactNode; className?: string }`, default `as="h2"`. Tasks 3 and 4 both import this from `@/components/ui/SectionLabel`.

- [ ] **Step 1: Create the component**

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SectionLabel({
  as: Tag = 'h2',
  children,
  className,
}: {
  as?: 'h2' | 'h3';
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag className={cn('text-sm font-semibold text-slate-700', className)}>
      {children}
    </Tag>
  );
}
```

This replaces `text-sm font-semibold uppercase tracking-wide text-slate-500` (shouty, all-caps, lighter gray) with `text-sm font-semibold text-slate-700` (sentence case as already written in each call site's JSX, slightly darker for hierarchy since caps is no longer doing that job). No copy changes needed anywhere — every existing call site already writes its label text in sentence case (e.g. `>Expenses<`, not `>EXPENSES<`); only the CSS `text-transform: uppercase` was forcing the visual caps, so removing the class is sufficient.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/SectionLabel.tsx
git commit -m "feat: add SectionLabel component to replace all-caps section headings"
```

---

### Task 3: Replace the 19 heading call sites

**Files:**
- Modify: `src/app/(app)/groups/[groupId]/activity/page.tsx:32-34`
- Modify: `src/app/(app)/groups/[groupId]/members/page.tsx:46-48` and `:95-97`
- Modify: `src/app/(app)/friends/[friendId]/page.tsx:91-93` and `:118`
- Modify: `src/app/(app)/groups/[groupId]/recurring/page.tsx:48-50`, `:69`, and `:105-107`
- Modify: `src/app/(app)/groups/[groupId]/spending/page.tsx:46-48` and `:53-55`
- Modify: `src/app/(app)/groups/[groupId]/settle/page.tsx:46-48`, `:81-83`, `:120-122`, and `:147-149`
- Modify: `src/app/(app)/groups/[groupId]/page.tsx:78`
- Modify: `src/app/(app)/groups/[groupId]/expenses/[expenseId]/page.tsx:146-148` and `:188-190`
- Modify: `src/components/friends/FriendRequestsList.tsx:31-33`
- Modify: `src/app/(app)/groups/[groupId]/page.tsx:93-95`

**Interfaces:**
- Consumes: `SectionLabel` from Task 2 (`import { SectionLabel } from '@/components/ui/SectionLabel';`).

Every site follows the same mechanical transform. Two shapes appear:

**Shape A** (most common) — multi-line `h2`:
```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
  Some Label
</h2>
```
becomes:
```tsx
<SectionLabel>
  Some Label
</SectionLabel>
```

**Shape B** (a few single-line ones — only `page.tsx:78` ("Expenses") and `friends/[friendId]/page.tsx:118` ("History") are actually one-liners; every other site is Shape A) — one-line `h2`/`h3`:
```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Expenses</h2>
```
becomes:
```tsx
<SectionLabel>Expenses</SectionLabel>
```

Two sites use `h3` instead of `h2` (`recurring/page.tsx:69` and `:105`) — pass `as="h3"`:
```tsx
<h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Due now</h3>
```
becomes:
```tsx
<SectionLabel as="h3">Due now</SectionLabel>
```

- [ ] **Step 1: `src/app/(app)/groups/[groupId]/activity/page.tsx`**

Add the import (`import { SectionLabel } from '@/components/ui/SectionLabel';`) near the other component imports. Replace:
```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
  Everything that happened
</h2>
```
with:
```tsx
<SectionLabel>Everything that happened</SectionLabel>
```

- [ ] **Step 2: `src/app/(app)/groups/[groupId]/members/page.tsx`** (2 sites)

Add the import. Replace the `:46-48` block:
```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
  Members ({bundle.activeMembers.length})
</h2>
```
with:
```tsx
<SectionLabel>Members ({bundle.activeMembers.length})</SectionLabel>
```
And the `:95-97` block:
```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
  No longer in this group
</h2>
```
with:
```tsx
<SectionLabel>No longer in this group</SectionLabel>
```

- [ ] **Step 3: `src/app/(app)/friends/[friendId]/page.tsx`** (2 sites)

Add the import. Replace `:91-93`:
```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
  Waiting for you
</h2>
```
with:
```tsx
<SectionLabel>Waiting for you</SectionLabel>
```
And `:118`:
```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">History</h2>
```
with:
```tsx
<SectionLabel>History</SectionLabel>
```

- [ ] **Step 4: `src/app/(app)/groups/[groupId]/recurring/page.tsx`** (3 sites, 2 of them `h3`)

Add the import. Replace `:48-50`:
```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
  Recurring reminders
</h2>
```
with:
```tsx
<SectionLabel>Recurring reminders</SectionLabel>
```
Replace `:69`:
```tsx
<h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Due now</h3>
```
with:
```tsx
<SectionLabel as="h3">Due now</SectionLabel>
```
Replace `:105-107`:
```tsx
<h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
  All reminders
</h3>
```
with:
```tsx
<SectionLabel as="h3">All reminders</SectionLabel>
```

- [ ] **Step 5: `src/app/(app)/groups/[groupId]/spending/page.tsx`** (2 sites)

Add the import. Replace `:46-48`:
```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
  Spend by category
</h2>
```
with:
```tsx
<SectionLabel>Spend by category</SectionLabel>
```
Replace `:53-55`:
```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
  Spend by month
</h2>
```
with:
```tsx
<SectionLabel>Spend by month</SectionLabel>
```

(Do not touch line 67's `<p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>` here — that's a different shape, handled in Task 4.)

- [ ] **Step 6: `src/app/(app)/groups/[groupId]/settle/page.tsx`** (4 sites)

Add the import. Replace each of the four identically-shaped blocks (`:46-48` "Waiting for you", `:81-83` "What you owe", `:120-122` "Owed to you", `:147-149` "Your settlement history") from:
```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
  <!-- label text -->
</h2>
```
to:
```tsx
<SectionLabel><!-- label text --></SectionLabel>
```
Concretely:
```tsx
<SectionLabel>Waiting for you</SectionLabel>
```
```tsx
<SectionLabel>What you owe</SectionLabel>
```
```tsx
<SectionLabel>Owed to you</SectionLabel>
```
```tsx
<SectionLabel>Your settlement history</SectionLabel>
```

- [ ] **Step 7: `src/app/(app)/groups/[groupId]/page.tsx`** (2 heading sites — NOT the `Stat` label at line 125, that's Task 4)

Add the import. Replace `:78`:
```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Expenses</h2>
```
with:
```tsx
<SectionLabel>Expenses</SectionLabel>
```
Replace `:93-95`:
```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
  Recent settlements
</h2>
```
with:
```tsx
<SectionLabel>Recent settlements</SectionLabel>
```

- [ ] **Step 8: `src/app/(app)/groups/[groupId]/expenses/[expenseId]/page.tsx`** (2 sites)

Add the import. Replace `:146-148`:
```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
  Edit history
</h2>
```
with:
```tsx
<SectionLabel>Edit history</SectionLabel>
```
Replace `:188-190`:
```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
  Comments {comments.length > 0 ? `(${comments.length})` : ''}
</h2>
```
with:
```tsx
<SectionLabel>Comments {comments.length > 0 ? `(${comments.length})` : ''}</SectionLabel>
```

- [ ] **Step 9: `src/components/friends/FriendRequestsList.tsx`**

Add the import. Replace `:31-33`:
```tsx
<p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
  Friend requests
</p>
```
with:
```tsx
<SectionLabel as="h2">Friend requests</SectionLabel>
```
(This one was a `<p>`, not a heading tag, in the original — promoting it to `SectionLabel`'s default `h2` is correct here since it functions as a section title exactly like the others; check the surrounding JSX isn't already inside another `<h2>`/heading context that would make a nested `h2` invalid — it's a standalone card section, so this is safe.)

- [ ] **Step 10: Run typecheck**

Run: `npm run typecheck`
Expected: clean. If any file reports an unused-import or missing-import error, fix that specific import line.

- [ ] **Step 11: Visual check**

Use Playwright (logged in as `admin@abonoshare.app` / `adminadmin`) to screenshot at least 4 of the changed pages (e.g. `/groups/<id>`, `/groups/<id>/members`, `/groups/<id>/spending`, `/friends/<id>`). Confirm every former all-caps label now reads in sentence case, no layout shift/overlap, zero new console errors.

- [ ] **Step 12: Commit**

```bash
git add src/app/'(app)'/groups src/app/'(app)'/friends src/components/friends/FriendRequestsList.tsx
git commit -m "style: replace all-caps section headings with SectionLabel across the app"
```

---

### Task 4: Fix the two stat-card mini-labels

**Files:**
- Modify: `src/app/(app)/groups/[groupId]/page.tsx:125`
- Modify: `src/app/(app)/groups/[groupId]/spending/page.tsx:67`

**Interfaces:**
- None — these are direct inline className edits, no new shared component (only 2 sites, and their shape — a `<p>` caption tightly stacked above a `<p>` value inside a `Stat` helper — is different enough from the section-heading role that reusing `SectionLabel` isn't a clean fit).

- [ ] **Step 1: `src/app/(app)/groups/[groupId]/page.tsx`**

Replace:
```tsx
<p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
```
with:
```tsx
<p className="text-xs font-medium text-slate-500">{label}</p>
```
(Added `font-medium` so the caption still reads as a distinct label now that caps isn't doing that work — it sits directly above a `text-lg font-semibold` value, so a lighter weight differentiation is enough at this small size.)

- [ ] **Step 2: `src/app/(app)/groups/[groupId]/spending/page.tsx`**

Same replacement at line 67:
```tsx
<p className="text-xs font-medium text-slate-500">{label}</p>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Visual check**

Screenshot `/groups/<id>` (overview stat cards: "Total group spending", "Expenses recorded", "Payments settled") and `/groups/<id>/spending` (stat cards: "Total spent (all time)", "Spent this month"). Confirm labels read in sentence case and are still legibly distinct from the big value below them.

- [ ] **Step 5: Commit**

```bash
git add src/app/'(app)'/groups
git commit -m "style: sentence-case the stat-card mini-labels"
```

---

### Task 5: Full-app verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: clean (ignore any errors from `agentic-awesome-skills-main/` if that unrelated directory is still present in the project root — those are pre-existing and out of scope for this plan; flag it to the user separately rather than fixing it here).

- [ ] **Step 2: Full unit suite**

Run: `npm run test`
Expected: all existing tests still pass (this plan touches no logic, only JSX/CSS, so no test should be affected — a failure here would indicate an accidental structural change and should be investigated before continuing).

- [ ] **Step 3: Re-run the original audit screenshot set**

Using Playwright, log in as `admin@abonoshare.app` / `adminadmin` and re-capture the same 9 screens from the original audit: `/groups`, a group's overview, `expenses/new`, group `settings`, `spending`, `members`, `activity`, `/friends`, and `/settings`. Confirm: paper/receipt palette applied consistently, every former all-caps label now sentence-case, zero console errors across all 9, no visual regression (nothing overlapping, nothing unreadable).

- [ ] **Step 4: Report**

Summarize what changed, attach or describe the before/after screenshots, and confirm the three explicit exclusions held: no layout/structural changes, no body-text color changes (`text-slate-900`/`text-slate-600` untouched), and the "or" divider in `AuthForms.tsx` was left alone.

---

## Self-Review Notes

- **Spec coverage**: canvas/card retint (Task 1) ✓, shared label component (Task 2) ✓, all 19 heading sites (Task 3, verified against the grep that found exactly 19 `h2`/`h3` matches + `FriendRequestsList.tsx`'s `p`) ✓, the 2 stat-label sites (Task 4) ✓, explicit exclusion of the `AuthForms.tsx` divider and of body-text color ✓.
- **Placeholder scan**: every step shows the literal before/after code, not a description — no TBDs.
- **Type consistency**: `SectionLabel`'s prop shape (`as`, `children`, `className`) is defined once in Task 2 and used identically (default omitted, or `as="h3"`) in every Task 3 call site — checked against each site's original tag.
