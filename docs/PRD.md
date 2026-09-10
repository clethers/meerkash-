# Meerkash — product requirements

A web app for friends, families, couples, travel groups and roommates to manage
shared expenses. Someone pays → the app calculates everyone's fair share →
balances update → debts simplify → people settle up.

Built for road trips, lunches, dinners, vacations, outings, events and group
shopping. Household bills work too, but they aren't the point.

## The example the whole product hangs on

Clethers pays ₱1,000 for Clethers and John — John's share is ₱500.
Later John pays ₱600 for both — Clethers' share is ₱300.

The app does **not** show two debts. It shows one:

> **John owes Clethers ₱200.**

The user never does this arithmetic themselves.

## Requirements, and where they live

| # | Requirement | Implementation |
| - | ----------- | -------------- |
| 1 | Email/password + Google auth, profile, avatar | `src/lib/actions/auth.ts`, `src/app/(auth)/`, `0001_schema.sql` |
| 2 | Everything belongs to a group; no person-to-person mode | `groups`, `group_members` |
| 3 | Create, add members, auto name, auto avatar, custom photo | `createGroup`, `suggestGroupName`, `avatarColor`, `0005_avatars.sql` |
| 4 | Invite by shareable link and QR; invitee must accept | `group_invites`, `accept_invite()`, `InvitePanel` |
| 5 | Owner vs member permissions | `is_group_owner()`, RLS policies in `0002_rls.sql` |
| 6 | New members start at ₱0; joinable to past expenses | `computeNetPositions`, `addMemberToExpense` |
| 7 | Expense: name, amount, payer, participants, split, category, note, receipt | `expenses`, `expense_participants`, `ExpenseForm` |
| 8 | Equal split by default, exact amounts as override | `splitEqually`, `splitExactly` |
| 9 | Exclude a member from one expense | participants list — excluded people simply aren't in it |
| 10 | Nine predefined categories, optional, default Other | `src/lib/constants.ts`, `expense_category` enum |
| 11 | PHP only, one currency per group | `groups.currency` check constraint, `formatPHP` |
| 12 | Optional receipt in Supabase Storage | `receipts` bucket, `0004_storage.sql` |
| 13 | Editing preserves old values, records editor and time, notifies | `expense_revisions`, `updateExpense` |
| 14 | Soft delete; record survives in Activity | `expenses.deleted_at`, no delete policy |
| 15 | Comments, no financial effect, no dispute system | `expense_comments` |
| 16 | Automatic, deterministic balance calculation | `src/lib/balance/balances.ts` |
| 17 | Automatic debt simplification | `src/lib/balance/simplify.ts` |
| 18 | Dashboard in plain language | `BalanceSummary` |
| 19 | Settle up, pre-filled, capped at what's owed | `validateSettlement`, `SettleForm` |
| 20 | Receiver confirms/rejects; only confirmed moves balances | `settlements.status`, RLS on update |
| 21 | GCash / Maya / Bank / Cash / Other / Not specified | `payment_method` enum |
| 22 | Optional settlement note | `settlements.note` |
| 23 | Settlement proof visible only to payer and receiver | `settlement-proofs` bucket policies |
| 24 | Permanent activity/audit trail | `activity_log`, append-only |
| 25 | Cannot leave with an outstanding balance | `canLeaveGroup`, `leave_group()` |
| 26 | Ownership transfer | `transfer_ownership()` |
| 27 | Focused in-app notifications | `notifications`, `notify()` |
| 28 | Search and filter expenses | `ExpenseFilters` |
| 29 | Group overview dashboard | `src/app/(app)/groups/[groupId]/page.tsx` |
| 30 | Recurring expenses as an isolated reminder module | `recurring_templates`, `recurring_occurrences` |
| 31 | Account soft-delete / anonymisation | `delete_my_account()` |
| 32 | Row Level Security enforced in the database | `0002_rls.sql`, `0004_storage.sql`, `0005_avatars.sql` |
| 33 | Next.js + Tailwind + Supabase + Postgres | see `README.md` |
| 34 | Simple, fast, transparent, reliable — no accounting jargon | "John owes you ₱500", never "net receivable" |
| 35 | Parked features stay parked | `docs/BACKLOG.md` |

## The two rules that keep the maths honest

**Integer centavos, always.** Amounts are `bigint` centavos in Postgres and
`number` centavos in TypeScript. No floats, ever. `₱1,000 ÷ 3` becomes
`33334 / 33333 / 33333` — the remainder goes out one centavo at a time in
sorted-id order, so shares always sum back to the total and every machine
produces the same answer.

**Only confirmed settlements move money.** Pending is a claim; rejected is a
declined claim. Both stay in the history, neither touches a balance.
