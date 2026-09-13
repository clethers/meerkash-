# Group Tab Data-Fetching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the 6 group-tab pages (Overview/Activity/Spending/Members/Recurring/Settings) from each fetching the full expense+settlement+ledger dataset on every click, when 4 of the 6 never use it.

**Architecture:** Add two new, additive data-layer functions in `src/lib/data/groups.ts` — `getGroupCore` (group+members+role, cheap, used by all 6 tabs) and `getGroupLedger` (expenses+settlements+ledger, used only by Overview and Members). Add a `[groupId]/layout.tsx` that centralizes the "not a member → 404" guard via `getGroupCore`. Migrate each of the 6 tab pages off `getGroupBundle` onto the narrower functions. `getGroupBundle` itself is untouched — its other 12 callers (server actions, `spending.ts`, `friends.ts`, non-tab group pages) are out of scope.

**Tech Stack:** Next.js 15 App Router (Server Components), Supabase (`@supabase/ssr`), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-group-tab-perf-design.md`

## Global Constraints

- `getGroupBundle`, `toExpenseInput`, `toSettlementInput` in `src/lib/data/groups.ts` are not modified — only added to.
- No rendered page's visual output or behavior changes. Every task is a data-source swap behind identical props.
- Expenses query in `getGroupLedger` must **not** filter `deleted_at` — `src/components/expenses/ExpenseFilters.tsx`'s `includeDeleted` toggle (lines 33, 43) needs deleted rows present.
- Settlements query in `getGroupLedger` **does** filter `deleted_at is null` server-side — nothing in the codebase reads a deleted settlement.
- After every task: `npm run typecheck` and `npm run test` must both pass before committing.

---

### Task 1: Add `getGroupCore` and `getGroupLedger` to the data layer

**Files:**
- Modify: `src/lib/data/groups.ts` (insert after `getGroupBundle`, before `toExpenseInput`)

**Interfaces:**
- Produces: `getGroupCore(groupId: string): Promise<GroupCore | null>` where `GroupCore = { group: Group; me: Profile; myRole: 'owner' | 'member'; members: MemberWithProfile[]; activeMembers: MemberWithProfile[]; nameOf: (userId: string) => string }`
- Produces: `getGroupLedger(groupId: string): Promise<GroupLedgerData>` where `GroupLedgerData = { expenses: ExpenseWithDetail[]; settlements: Settlement[]; ledger: Ledger }`
- Consumes: `getCurrentUser`, `buildLedger`, `toExpenseInput`, `toSettlementInput` (all already in this file), `MemberWithProfile`/`ExpenseWithDetail` (already defined above in this file)

- [ ] **Step 1: Insert the two functions**

Insert this block into `src/lib/data/groups.ts` immediately after the closing `});` of `getGroupBundle` (line 136) and before `export function toExpenseInput`:

```ts
/**
 * The part of a group page every tab needs: group row, membership, role,
 * and the roster with profiles. No expense/settlement fetch, no ledger
 * computation — those are getGroupLedger's job, for the two tabs that
 * actually show balances.
 * Returns null under the same conditions getGroupBundle does: group
 * missing/deleted, or the viewer isn't an active member.
 */
export interface GroupCore {
  group: Group;
  me: Profile;
  myRole: 'owner' | 'member';
  members: MemberWithProfile[];
  activeMembers: MemberWithProfile[];
  nameOf: (userId: string) => string;
}

export const getGroupCore = cache(async (groupId: string): Promise<GroupCore | null> => {
  const supabase = await createClient();

  const [me, groupResult, memberResult] = await Promise.all([
    getCurrentUser(),
    supabase.from('groups').select('*').eq('id', groupId).is('deleted_at', null).maybeSingle(),
    supabase
      .from('group_members')
      .select('*, profile:profiles!group_members_user_id_fkey(*)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true }),
  ]);

  if (!me) return null;
  const group = groupResult.data;
  if (!group) return null;

  const members = (memberResult.data ?? []) as unknown as MemberWithProfile[];
  const mine = members.find((m) => m.user_id === me.id && m.status === 'active');
  if (!mine) return null;

  const activeMembers = members.filter((m) => m.status === 'active');
  const names = new Map(members.map((m) => [m.user_id, m.profile?.display_name ?? 'Member']));

  return {
    group: group as Group,
    me,
    myRole: mine.role,
    members,
    activeMembers,
    nameOf: (userId: string) => names.get(userId) ?? 'Former member',
  };
});

/**
 * Expenses, settlements, and the computed ledger — only for tabs that show
 * balances (Overview, Members). Rows capped like getActivity's limit.
 * Expenses deliberately keep deleted rows: ExpenseFilters' "show deleted"
 * toggle needs them. Settlements are filtered to non-deleted server-side —
 * nothing in the app reads a deleted settlement.
 * Assumes the caller already confirmed membership (via getGroupCore / the
 * [groupId] layout) — no independent not-found case.
 */
export interface GroupLedgerData {
  expenses: ExpenseWithDetail[];
  settlements: Settlement[];
  ledger: Ledger;
}

const MAX_LEDGER_ROWS = 500;

export const getGroupLedger = cache(async (groupId: string): Promise<GroupLedgerData> => {
  const supabase = await createClient();

  const [core, expenseResult, settlementResult] = await Promise.all([
    getGroupCore(groupId),
    supabase
      .from('expenses')
      .select('*, participants:expense_participants(*)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(MAX_LEDGER_ROWS),
    supabase
      .from('settlements')
      .select('*')
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(MAX_LEDGER_ROWS),
  ]);

  const expenses = (expenseResult.data ?? []) as unknown as ExpenseWithDetail[];
  const settlements = (settlementResult.data ?? []) as Settlement[];

  const ledger = buildLedger({
    members: (core?.activeMembers ?? []).map((m) => m.user_id),
    expenses: expenses.map(toExpenseInput),
    settlements: settlements.map(toSettlementInput),
  });

  return { expenses, settlements, ledger };
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Run test suite**

Run: `npm run test`
Expected: all existing tests still pass (this is a pure addition, nothing existing references these new exports yet).

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/groups.ts
git commit -m "feat: add getGroupCore and getGroupLedger data fetchers"
```

---

### Task 2: Add `[groupId]/layout.tsx`

**Files:**
- Create: `src/app/(app)/groups/[groupId]/layout.tsx`

**Interfaces:**
- Consumes: `getGroupCore(groupId: string): Promise<GroupCore | null>` from Task 1

- [ ] **Step 1: Write the layout**

```tsx
import { notFound } from 'next/navigation';
import { getGroupCore } from '@/lib/data/groups';

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const core = await getGroupCore(groupId);
  if (!core) notFound();

  return <>{children}</>;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual check**

Start the app (`npm run dev`), visit a group you're an active member of — page loads normally (this layout is additive; the pages underneath still use `getGroupBundle` until later tasks, so nothing else should change yet). Then visit `/groups/<some-fake-or-foreign-id>` — should 404.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/groups/[groupId]/layout.tsx"
git commit -m "feat: add group layout centralizing the membership guard"
```

---

### Task 3: Migrate Settings page to `getGroupCore`

**Files:**
- Modify: `src/app/(app)/groups/[groupId]/settings/page.tsx`

**Interfaces:**
- Consumes: `getGroupCore` from Task 1

- [ ] **Step 1: Replace the full file**

```tsx
import { notFound } from 'next/navigation';
import { GroupHeader } from '@/components/groups/GroupHeader';
import { GroupSettingsForm } from '@/components/groups/GroupSettingsForm';
import { Alert } from '@/components/ui/Alert';
import { getGroupCore } from '@/lib/data/groups';
import { CURRENCY_LABEL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const core = await getGroupCore(groupId);
  if (!core) notFound();

  return (
    <div className="space-y-6">
      <GroupHeader
        group={core.group}
        memberCount={core.activeMembers.length}
        current="/settings"
      />

      <GroupSettingsForm
        groupId={groupId}
        name={core.group.name}
        avatarUrl={core.group.avatar_url}
        defaultSplitMode={core.group.default_split_mode}
        canEdit={core.myRole === 'owner'}
      />

      <Alert tone="info">
        This group tracks amounts in {CURRENCY_LABEL[core.group.currency]}. One currency per
        group.
      </Alert>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual check**

Visit `/groups/<id>/settings` — renders identically to before (group name/avatar in the form, currency alert, owner-only edit access unchanged).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/groups/[groupId]/settings/page.tsx"
git commit -m "perf: settings tab no longer fetches expense/settlement data"
```

---

### Task 4: Migrate Recurring page to `getGroupCore`

**Files:**
- Modify: `src/app/(app)/groups/[groupId]/recurring/page.tsx`

**Interfaces:**
- Consumes: `getGroupCore` from Task 1

- [ ] **Step 1: Replace the full file**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GroupHeader } from '@/components/groups/GroupHeader';
import {
  NewTemplateForm,
  OccurrenceActions,
  RemoveTemplateButton,
} from '@/components/groups/RecurringForms';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { getGroupCore } from '@/lib/data/groups';
import { listDueOccurrences, listTemplates } from '@/lib/actions/recurring';
import { isDue } from '@/lib/recurring';
import { CATEGORY_EMOJI } from '@/lib/constants';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function RecurringPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const core = await getGroupCore(groupId);
  if (!core) notFound();

  const [templates, occurrences] = await Promise.all([
    listTemplates(groupId),
    listDueOccurrences(groupId),
  ]);

  const templateById = new Map(templates.map((t) => [t.id, t]));
  const due = occurrences.filter((o) => isDue(o.due_on));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <GroupHeader
        group={core.group}
        memberCount={core.activeMembers.length}
        current="/recurring"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionLabel>Recurring reminders</SectionLabel>
          <p className="mt-1 max-w-lg text-sm text-slate-600">
            A separate module from your day-to-day expenses. These are reminders, not charges —
            record the real amount when it actually happens.
          </p>
        </div>
        <NewTemplateForm
          groupId={groupId}
          today={today}
          currency={core.group.currency}
          members={core.activeMembers.map((m) => ({
            id: m.user_id,
            name: m.profile?.display_name ?? 'Member',
          }))}
        />
      </div>

      {due.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel as="h3">Due now</SectionLabel>
          <ul className="space-y-2">
            {due.map((occurrence) => {
              const template = templateById.get(occurrence.template_id);
              if (!template) return null;
              return (
                <li key={occurrence.id} className="card space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl" aria-hidden>{CATEGORY_EMOJI[template.category]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{template.name}</p>
                      <p className="text-sm text-slate-500">
                        Due {occurrence.due_on}
                        {template.amount_centavos
                          ? ` · usually ${formatMoney(template.amount_centavos, core.group.currency)}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ButtonLink
                      href={`/groups/${groupId}/expenses/new?template=${template.id}`}
                      size="sm"
                    >
                      Record it as an expense
                    </ButtonLink>
                    <OccurrenceActions groupId={groupId} occurrenceId={occurrence.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionLabel as="h3">All reminders</SectionLabel>
        {templates.length === 0 ? (
          <EmptyState
            title="No recurring reminders"
            description="Set one up for something that happens on a schedule, like a daily lunch or a monthly bill."
          />
        ) : (
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {templates.map((template) => (
              <li key={template.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg" aria-hidden>{CATEGORY_EMOJI[template.category]}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{template.name}</p>
                  <p className="text-xs text-slate-500">
                    {template.frequency} · next {template.next_due_on}
                    {template.amount_centavos ? ` · ${formatMoney(template.amount_centavos, core.group.currency)}` : ''}
                  </p>
                </div>
                <RemoveTemplateButton groupId={groupId} templateId={template.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Alert tone="info">
        Each occurrence you record becomes a normal expense, splittable and editable like any other.{' '}
        <Link href={`/groups/${groupId}`} className="font-medium underline">
          Back to the group
        </Link>
      </Alert>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual check**

Visit `/groups/<id>/recurring` — due/all reminders lists, new-template form's member picker, and currency formatting all unchanged.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/groups/[groupId]/recurring/page.tsx"
git commit -m "perf: recurring tab no longer fetches expense/settlement data"
```

---

### Task 5: Migrate Activity page to `getGroupCore`

**Files:**
- Modify: `src/app/(app)/groups/[groupId]/activity/page.tsx`

**Interfaces:**
- Consumes: `getGroupCore` from Task 1

- [ ] **Step 1: Replace the full file**

```tsx
import { notFound } from 'next/navigation';
import { GroupHeader } from '@/components/groups/GroupHeader';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { describeActivity } from '@/lib/activity';
import { getActivity, getGroupCore } from '@/lib/data/groups';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const core = await getGroupCore(groupId);
  if (!core) notFound();

  const entries = await getActivity(groupId, 200);

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <GroupHeader
        group={core.group}
        memberCount={core.activeMembers.length}
        current="/activity"
      />

      <div>
        <SectionLabel>Everything that happened</SectionLabel>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          A permanent record, including expenses that were edited or deleted.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState title="Nothing has happened yet" description="Add an expense to get started." />
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100 dark:divide-white/10 overflow-hidden">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-3 px-4 py-3">
              <Avatar
                name={core.nameOf(entry.actor_id ?? '')}
                src={core.members.find((m) => m.user_id === entry.actor_id)?.profile?.avatar_url}
                size={30}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800 dark:text-slate-100">{describeActivity(entry, core.nameOf, core.group.currency)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(entry.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual check**

Visit `/groups/<id>/activity` — feed entries, actor avatars/names, and descriptions unchanged.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/groups/[groupId]/activity/page.tsx"
git commit -m "perf: activity tab no longer fetches expense/settlement data"
```

---

### Task 6: Migrate Spending page to `getGroupCore`

**Files:**
- Modify: `src/app/(app)/groups/[groupId]/spending/page.tsx`

**Interfaces:**
- Consumes: `getGroupCore` from Task 1

- [ ] **Step 1: Replace the full file**

```tsx
import { notFound } from 'next/navigation';
import { GroupHeader } from '@/components/groups/GroupHeader';
import { CategoryBarChart, MonthBarChart } from '@/components/groups/SpendingCharts';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { getGroupCore } from '@/lib/data/groups';
import { getSpendingSummary } from '@/lib/data/spending';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function SpendingPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const core = await getGroupCore(groupId);
  if (!core) notFound();

  const summary = await getSpendingSummary(groupId);
  if (!summary) notFound();

  const hasSpending = summary.totalAllTime > 0;

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <GroupHeader
        group={core.group}
        memberCount={core.activeMembers.length}
        current="/spending"
      />

      {!hasSpending ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            title="No spending yet"
            description="Add an expense to see totals and trends for this group."
          />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Total spent (all time)" value={formatMoney(summary.totalAllTime, summary.currency)} />
            <Stat label="Spent this month" value={formatMoney(summary.totalThisMonth, summary.currency)} />
          </div>

          <section className="card space-y-4 p-4">
            <SectionLabel>Spend by category</SectionLabel>
            <CategoryBarChart data={summary.byCategory} currency={summary.currency} />
          </section>

          <section className="card space-y-4 p-4">
            <SectionLabel>Spend by month</SectionLabel>
            <MonthBarChart data={summary.byMonth} currency={summary.currency} />
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual check**

Visit `/groups/<id>/spending` — totals and both charts unchanged (this page's chart data already came from `getSpendingSummary`, not the bundle, so only the header source changes).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/groups/[groupId]/spending/page.tsx"
git commit -m "perf: spending tab no longer fetches expense/settlement data"
```

---

### Task 7: Migrate Members page to `getGroupCore` + `getGroupLedger`

**Files:**
- Modify: `src/app/(app)/groups/[groupId]/members/page.tsx`

**Interfaces:**
- Consumes: `getGroupCore`, `getGroupLedger` from Task 1

- [ ] **Step 1: Replace the full file**

```tsx
import { notFound } from 'next/navigation';
import { GroupHeader } from '@/components/groups/GroupHeader';
import { InvitePanel } from '@/components/groups/InvitePanel';
import { LeaveGroupButton, OwnerMemberActions } from '@/components/groups/MemberActions';
import { Avatar } from '@/components/ui/Avatar';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { getGroupCore, getGroupLedger } from '@/lib/data/groups';
import { getOrCreateInvite, inviteQrSvg, inviteUrl } from '@/lib/data/invites';
import { canLeaveGroup, netFor } from '@/lib/balance';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function MembersPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const [core, ledgerData] = await Promise.all([getGroupCore(groupId), getGroupLedger(groupId)]);
  if (!core) notFound();

  const invite = await getOrCreateInvite(groupId);
  const qrSvg = invite ? await inviteQrSvg(invite.token) : '';
  const isOwner = core.myRole === 'owner';
  const leaveCheck = canLeaveGroup(ledgerData.ledger, core.me.id);
  const former = core.members.filter((m) => m.status !== 'active');

  return (
    <div className="space-y-6">
      <GroupHeader
        group={core.group}
        memberCount={core.activeMembers.length}
        current="/members"
      />

      {invite ? (
        <InvitePanel
          url={inviteUrl(invite.token)}
          qrSvg={qrSvg}
          inviteId={invite.id}
          groupId={groupId}
        />
      ) : null}

      <section className="space-y-3">
        <SectionLabel>Members ({core.activeMembers.length})</SectionLabel>
        <ul className="card divide-y divide-slate-100 overflow-hidden">
          {core.activeMembers.map((member) => {
            const net = netFor(ledgerData.ledger.net, member.user_id);
            const isMe = member.user_id === core.me.id;
            return (
              <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar
                  name={member.profile?.display_name ?? 'Member'}
                  src={member.profile?.avatar_url}
                  size={38}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">
                    {member.profile?.display_name ?? 'Member'}
                    {isMe ? ' (you)' : ''}
                    {member.role === 'owner' ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        owner
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {net === 0
                      ? 'settled up'
                      : net > 0
                        ? `is owed ${formatMoney(net, core.group.currency)}`
                        : `owes ${formatMoney(Math.abs(net), core.group.currency)}`}
                  </p>
                </div>

                {isOwner && !isMe ? (
                  <OwnerMemberActions
                    groupId={groupId}
                    userId={member.user_id}
                    name={member.profile?.display_name ?? 'this member'}
                    settled={net === 0}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {former.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel>No longer in this group</SectionLabel>
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {former.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar
                  name={member.profile?.display_name ?? 'Member'}
                  src={member.profile?.avatar_url}
                  size={32}
                  className="opacity-60"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                  {member.profile?.display_name ?? 'Member'}
                </span>
                <span className="text-xs text-slate-400">
                  {member.status === 'removed' ? 'removed' : 'left'}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            Their name stays on the expenses and settlements they were part of.
          </p>
        </section>
      ) : null}

      <section className="space-y-3 border-t border-slate-200 pt-6">
        <LeaveGroupButton
          groupId={groupId}
          blockedReason={leaveCheck.allowed ? null : (leaveCheck.reason ?? null)}
        />
        {isOwner && core.activeMembers.length > 1 ? (
          <p className="text-xs text-slate-500">
            As the owner, transfer ownership to someone else before you leave.
          </p>
        ) : null}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual check**

Visit `/groups/<id>/members` — net balances per member, owner badge, leave-group blocked-reason logic, invite panel all unchanged.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/groups/[groupId]/members/page.tsx"
git commit -m "perf: members tab uses getGroupCore + getGroupLedger instead of the full bundle"
```

---

### Task 8: Migrate Overview page to `getGroupCore` + `getGroupLedger`

**Files:**
- Modify: `src/app/(app)/groups/[groupId]/page.tsx`

**Interfaces:**
- Consumes: `getGroupCore`, `getGroupLedger` from Task 1

- [ ] **Step 1: Replace the full file**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Plus, Wallet } from 'lucide-react';
import { GroupHeader } from '@/components/groups/GroupHeader';
import { BalanceSummary } from '@/components/groups/BalanceSummary';
import { InviteFriendsModal } from '@/components/groups/InviteFriendsModal';
import { ExpenseFilters } from '@/components/expenses/ExpenseFilters';
import { ButtonLink } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { getGroupCore, getGroupLedger } from '@/lib/data/groups';
import { getMyFriends } from '@/lib/data/friends';
import { getOrCreateInvite, inviteQrSvg, inviteUrl } from '@/lib/data/invites';
import { summarizeForUser } from '@/lib/balance';
import { formatMoney } from '@/lib/money';
import { relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { groupId } = await params;
  const { welcome } = await searchParams;
  const [core, ledgerData] = await Promise.all([getGroupCore(groupId), getGroupLedger(groupId)]);
  if (!core) notFound();

  let welcomeInvite: { url: string; qrSvg: string; inviteId: string; friends: typeof core.members[number]['profile'][] } | null = null;
  if (welcome === '1') {
    const memberIds = new Set(core.activeMembers.map((m) => m.user_id));
    const [friends, invite] = await Promise.all([getMyFriends(), getOrCreateInvite(groupId)]);
    if (invite) {
      welcomeInvite = {
        url: inviteUrl(invite.token),
        qrSvg: await inviteQrSvg(invite.token),
        inviteId: invite.id,
        friends: friends.filter((f) => !memberIds.has(f.profile.id)).map((f) => f.profile),
      };
    }
  }

  const summary = summarizeForUser(ledgerData.ledger, core.me.id);
  const avatarOf = (id: string) =>
    core.members.find((m) => m.user_id === id)?.profile?.avatar_url ?? null;

  const pendingForMe = ledgerData.settlements.filter(
    (s) => s.status === 'pending' && s.to_user_id === core.me.id,
  );
  const recentSettlements = ledgerData.settlements.slice(0, 4);

  return (
    <div className="space-y-6">
      {welcomeInvite ? (
        <InviteFriendsModal
          groupId={groupId}
          groupName={core.group.name}
          friends={welcomeInvite.friends}
          inviteUrl={welcomeInvite.url}
          qrSvg={welcomeInvite.qrSvg}
          inviteId={welcomeInvite.inviteId}
        />
      ) : null}
      <GroupHeader group={core.group} memberCount={core.activeMembers.length} />

      {pendingForMe.length > 0 ? (
        <Link
          href={`/groups/${groupId}/settle`}
          className="card flex items-center gap-3 border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 hover:border-amber-400 dark:hover:border-amber-500/50"
        >
          <Wallet size={18} className="text-amber-700 dark:text-amber-400" />
          <span className="flex-1 text-sm text-amber-900 dark:text-amber-200">
            {pendingForMe.length === 1
              ? `${core.nameOf(pendingForMe[0].from_user_id)} says they paid you ${formatMoney(pendingForMe[0].amount_centavos, core.group.currency)}.`
              : `${pendingForMe.length} payments are waiting for you to confirm.`}
          </span>
          <ArrowRight size={16} className="text-amber-700 dark:text-amber-400" />
        </Link>
      ) : null}

      <BalanceSummary
        summary={summary}
        groupId={groupId}
        nameOf={core.nameOf}
        avatarOf={avatarOf}
        currency={core.group.currency}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total group spending" value={formatMoney(ledgerData.ledger.totalSpent, core.group.currency)} />
        <Stat
          label="Expenses recorded"
          value={String(ledgerData.expenses.filter((e) => !e.deleted_at).length)}
        />
        <Stat
          label="Payments settled"
          value={String(ledgerData.settlements.filter((s) => s.status === 'confirmed').length)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/groups/${groupId}/expenses/new`}>
          <Plus size={16} /> Add expense
        </ButtonLink>
        <ButtonLink href={`/groups/${groupId}/settle`} variant="secondary">
          <Wallet size={16} /> Settle up
        </ButtonLink>
      </div>

      <section className="space-y-3">
        <SectionLabel>Expenses</SectionLabel>
        <ExpenseFilters
          expenses={ledgerData.expenses}
          groupId={groupId}
          viewerId={core.me.id}
          members={core.members.map((m) => ({
            id: m.user_id,
            name: m.profile?.display_name ?? 'Member',
          }))}
          currency={core.group.currency}
        />
      </section>

      {recentSettlements.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel>Recent settlements</SectionLabel>
          <ul className="card divide-y divide-slate-100 dark:divide-white/10 overflow-hidden">
            {recentSettlements.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1 text-slate-700 dark:text-slate-300">
                  <strong className="font-medium text-slate-900 dark:text-slate-50">
                    {s.from_user_id === core.me.id ? 'You' : core.nameOf(s.from_user_id)}
                  </strong>{' '}
                  paid{' '}
                  <strong className="font-medium text-slate-900 dark:text-slate-50">
                    {s.to_user_id === core.me.id ? 'you' : core.nameOf(s.to_user_id)}
                  </strong>{' '}
                  {formatMoney(s.amount_centavos, core.group.currency)}
                </span>
                <StatusPill status={s.status} />
                <span className="hidden shrink-0 text-xs text-slate-400 dark:text-slate-500 sm:inline">
                  {relativeTime(s.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{value}</p>
    </div>
  );
}

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

Note: `pendingForMe` and `recentSettlements` drop their `!s.deleted_at` checks — `ledgerData.settlements` is already filtered to non-deleted server-side (Task 1), so the JS-side check is now redundant. `Stat`'s "Expenses recorded" count keeps its `.filter((e) => !e.deleted_at)` since `ledgerData.expenses` deliberately still includes deleted rows.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual check**

Visit `/groups/<id>` (Overview) — balance summary, stats, expense list (including the "show deleted" toggle in `ExpenseFilters` — verify it still reveals deleted expenses when checked), recent settlements, and the welcome-invite flow (`?welcome=1` after creating a group) all unchanged.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/groups/[groupId]/page.tsx"
git commit -m "perf: overview tab uses getGroupCore + getGroupLedger instead of the full bundle"
```

---

## Self-Review Notes

- **Spec coverage:** `getGroupCore`/`getGroupLedger` (Task 1), layout (Task 2), all 6 pages migrated (Tasks 3–8), settlements-only `deleted_at` filter + row caps (Task 1) — all spec sections have a task.
- **Type consistency:** `GroupCore`/`GroupLedgerData` field names are used identically across Tasks 1, 7, 8 (`core.group`, `core.activeMembers`, `core.myRole`, `core.me`, `core.members`, `core.nameOf`; `ledgerData.expenses`, `ledgerData.settlements`, `ledgerData.ledger`).
- **Scope:** confirmed no task touches `getGroupBundle` or any of its other 12 callers.
