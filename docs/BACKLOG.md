# Backlog

What the closed loop should work through next. Anything here is a real gap, not
a stub — the gate refuses stubs, so nothing half-written ships.

Add a test alongside each item. If a change can't be checked by
`npm run gate -- --check`, write the check first.

## Correctness and safety

- [ ] **RLS integration tests.** The policies in `0002_rls.sql` are the real
      permission layer, and nothing currently proves them. Stand up a local
      Supabase (`supabase start`), seed two users in two groups, and assert from
      a *client* session that: a non-member reads zero rows; a member cannot
      rename a group; a third party cannot fetch a settlement proof; a removed
      member loses access. This is the highest-value item on the list.
- [ ] **`group_net_positions` vs the TypeScript engine.** Both compute the same
      formula and could drift. Generate a few hundred random ledgers, run them
      through both, and assert they agree to the centavo.
- [ ] **Concurrent settlement confirmation.** Two tabs confirming the same
      pending settlement should not double-credit. Add a guard and a test.

## Product gaps

- [ ] **Auto-generate the group name as members join.** `suggestGroupName()`
      exists and is used at creation time only. Once a second person accepts an
      invite, a still-unnamed group should become "Clethers & John". Track
      whether the owner has renamed it so a manual name is never overwritten.
- [ ] **Password reset.** Email/password sign-in works but there is no
      "forgot password" flow.
- [ ] **Pagination.** Expenses and activity load in full. Fine for a road trip,
      not for a household two years in. Paginate both, keeping filters working.
- [ ] **Receipt thumbnails.** Receipts open in a new tab via a signed URL; an
      inline preview on the expense page would be better.

## Nice to have

- [ ] Realtime balance updates via Supabase channels, so a settlement confirmed
      on someone else's phone updates your dashboard without a refresh.
- [ ] Export a group's expenses to CSV.
- [ ] A per-group spending breakdown by category.

## Explicitly out of scope

Multi-currency, payment processing (GCash/Maya/bank APIs), AI receipt
processing, percentage or share-based splitting, custom categories, a formal
dispute workflow, offline mode, native apps, push and email notifications.
Requirement 35 parks all of these on purpose — don't let a loop wander into them.
