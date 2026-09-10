# Friends / 1:1 balances outside groups — design

## Context

Third of five Splitwise-parity sub-projects (see
`docs/superpowers/specs/2026-09-06-percentage-splitting-design.md` for the
roadmap and session-split agreement). This is the most architecturally
disruptive: it reverses PRD requirement 2 ("everything belongs to a group;
no person-to-person mode"). Approved via brainstorm with these resolved
forks: friend relationships are explicit (request/accept, not implicit from
shared groups); a 1:1 expense reuses the existing `expenses` table with a
nullable `group_id`, not a parallel table; a friend's shown balance reflects
only direct (groupless) activity, never an aggregate with shared-group
balances; friend discovery is by exact email match (existing users only).

## Design

### 1. Data model

```sql
create type friend_request_status as enum ('pending', 'accepted', 'declined');

create table friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references profiles(id),
  to_user_id uuid not null references profiles(id),
  status friend_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_request_not_self check (from_user_id <> to_user_id)
);

-- Materialized accepted relation. Canonical ordering (user_a_id < user_b_id)
-- avoids storing both a→b and b→a for the same pair.
create table friendships (
  user_a_id uuid not null references profiles(id),
  user_b_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  primary key (user_a_id, user_b_id),
  constraint friendship_ordered check (user_a_id < user_b_id)
);
```

Mirrors the existing `group_invites` (lifecycle) / `group_members`
(materialized fast lookup) split exactly.

`expenses.group_id` and `settlements.group_id` both become **nullable**. A
direct (1:1) expense/settlement is simply one with `group_id = null`.
Everything else — split modes (including percentage from sub-project 1),
categories, the balance engine — is reused unchanged.

### 2. RLS helper functions

Following this codebase's established pattern (every cross-table visibility
check goes through a `SECURITY DEFINER` helper, never a raw subquery inline
in a policy — this is *why* `is_group_member`/`is_group_owner`/`expense_group`
exist as functions rather than inline `exists(...)` clauses: a raw subquery
inside a policy is itself subject to that table's RLS, which silently
mis-evaluates self-referential checks):

```sql
create or replace function are_friends(uid1 uuid, uid2 uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where user_a_id = least(uid1, uid2) and user_b_id = greatest(uid1, uid2)
  );
$$;

create or replace function is_expense_participant(eid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from expense_participants where expense_id = eid and user_id = uid);
$$;
```

**Found during implementation, corrected here**: an earlier version of this
helper (`can_access_direct_expense`) re-queried `expenses` from inside a
policy defined *on* `expenses`. That self-reference breaks specifically for
`INSERT ... RETURNING` (what `.select().single()` after an insert compiles
to): the inner query doesn't see the row the outer INSERT is still adding,
in the same command, so a real insert would succeed but its own
RETURNING-phase visibility check would fail with a 42501. `expenses`
policies must reference the row's own columns directly (`created_by =
auth.uid()`) and only query the genuinely different `expense_participants`
table via a helper. `expense_participants`'s own policies remain free to
query `expenses`, since the expense row is already committed by the time
participants are inserted in a separate, later statement.

### 3. RLS policies (additive — existing group policies untouched)

Postgres OR's multiple permissive policies for the same command together, so
these are new policies alongside the existing group-scoped ones, not
replacements:

```sql
create policy "friends read direct expenses" on expenses for select using (
  group_id is null and (created_by = auth.uid() or is_expense_participant(id)));
create policy "friends create direct expenses" on expenses for insert with check (
  group_id is null and created_by = auth.uid());
create policy "friends edit direct expenses" on expenses for update using (
  group_id is null and (created_by = auth.uid() or is_expense_participant(id)))
  with check (group_id is null and (created_by = auth.uid() or is_expense_participant(id)));

create policy "friends read direct participants" on expense_participants for select using (
  expense_group(expense_id) is null and (
    exists (select 1 from expenses e where e.id = expense_participants.expense_id and e.created_by = auth.uid())
    or is_expense_participant(expense_id)
  ));
create policy "friends write direct participants" on expense_participants for insert with check (
  expense_group(expense_id) is null and (
    exists (select 1 from expenses e where e.id = expense_participants.expense_id and e.created_by = auth.uid())
    or is_expense_participant(expense_id)
  ));

create policy "friends read direct settlements" on settlements for select using (
  group_id is null and auth.uid() in (from_user_id, to_user_id));
create policy "friends create direct settlements" on settlements for insert with check (
  group_id is null and from_user_id = auth.uid() and are_friends(from_user_id, to_user_id));
create policy "friends respond to direct settlements" on settlements for update using (
  group_id is null and ((to_user_id = auth.uid()) or (from_user_id = auth.uid() and status = 'pending')))
  with check (group_id is null and ((to_user_id = auth.uid()) or (from_user_id = auth.uid() and status = 'pending')));

alter table friend_requests enable row level security;
alter table friendships enable row level security;

create policy "see requests you sent or received" on friend_requests for select using (
  from_user_id = auth.uid() or to_user_id = auth.uid());
create policy "see your own friendships" on friendships for select using (
  user_a_id = auth.uid() or user_b_id = auth.uid());
```

**No insert/update/delete policies on `friend_requests`/`friendships`** —
every write to these two tables goes through the `SECURITY DEFINER` RPCs
below (which bypass RLS internally, same as `accept_invite()` does for
`group_members`). With no permissive policy for those commands, RLS denies
them outright to any direct PostgREST write — exactly the intended
behavior, since there is no legitimate direct-write path for these tables.

`settlements` can validate friendship declaratively at insert time (both
parties are named directly in the row). `expenses` cannot — its participants
live in a separate table populated by a second, later statement, so
insert-time RLS on `expenses` alone can't see who the other participant is
yet. That's what the trigger below is for.

### 4. Friendship-enforcement trigger

```sql
create or replace function enforce_direct_expense_friendship()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  gid uuid;
  creator uuid;
  participant_count integer;
  other_user uuid;
begin
  select group_id, created_by into gid, creator from expenses where id = new.expense_id;
  if gid is not null then return new; end if;

  select count(*) into participant_count from expense_participants where expense_id = new.expense_id;
  if participant_count > 2 then
    raise exception 'A direct (non-group) expense can have at most 2 participants.';
  end if;

  select user_id into other_user from expense_participants
   where expense_id = new.expense_id and user_id <> creator limit 1;

  if other_user is not null and not are_friends(creator, other_user) then
    raise exception 'You can only split a direct expense with a friend.';
  end if;

  return new;
end;
$$;

create trigger expense_participants_enforce_friendship
  after insert on expense_participants
  for each row execute function enforce_direct_expense_friendship();
```

`AFTER ROW` triggers within one multi-row `INSERT` see earlier sibling rows
of the same statement (standard Postgres behavior), so by the second
participant row's trigger firing, both rows are visible and the check is
complete — and if it fails, the whole statement (both rows, and the parent
`expenses` insert if run in the same transaction) rolls back atomically.

### 5. Direct balance computation

```sql
create or replace function direct_net_position(other_user_id uuid, uid uuid default auth.uid())
returns bigint
language sql stable security definer set search_path = public as $$
  with relevant as (
    select e.id, e.payer_id, e.amount_centavos from expenses e
    where e.group_id is null and e.deleted_at is null
      and exists (select 1 from expense_participants ep where ep.expense_id = e.id and ep.user_id = uid)
      and exists (select 1 from expense_participants ep where ep.expense_id = e.id and ep.user_id = other_user_id)
  ),
  paid as (select coalesce(sum(amount_centavos), 0)::bigint as amount from relevant where payer_id = uid),
  owed as (
    select coalesce(sum(ep.share_centavos), 0)::bigint as amount
    from expense_participants ep join relevant r on r.id = ep.expense_id
    where ep.user_id = uid
  ),
  paid_out as (
    select coalesce(sum(amount_centavos), 0)::bigint as amount from settlements
    where group_id is null and status = 'confirmed' and deleted_at is null
      and from_user_id = uid and to_user_id = other_user_id
  ),
  received as (
    select coalesce(sum(amount_centavos), 0)::bigint as amount from settlements
    where group_id is null and status = 'confirmed' and deleted_at is null
      and from_user_id = other_user_id and to_user_id = uid
  )
  select (paid.amount - owed.amount + paid_out.amount - received.amount)::bigint
  from paid, owed, paid_out, received;
$$;
```

Mirrors `group_net_positions()`'s structure exactly, scoped to `group_id is
null` and one specific pair instead of one group's active members.

### 6. RPCs

- `search_user_by_email(target_email text) returns table(id uuid, display_name text)` — exact match only, excludes the caller, returns at most one row. Deliberately narrow (id + display_name only, never email/avatar/etc.) so it can't be used as a general profile-lookup oracle.
- `send_friend_request(target_user_id uuid) returns uuid` — rejects self-friending and already-friends; if the target already sent *you* a pending request, auto-accepts it instead of creating a duplicate; otherwise inserts a `friend_requests` row and a notification (`group_id = null` — already-supported per existing `notifications` RLS).
- `accept_friend_request(request_id uuid)` / `decline_friend_request(request_id uuid) returns void` — validate the request is addressed to the caller and still pending.
- `remove_friend(friend_user_id uuid) returns void` — refuses if `direct_net_position <> 0` (mirrors `leave_group`'s "settle up first" guard).

### 7. Backend data/action layer

New files (not the existing `expenses.ts`/`settlements.ts` — kept separate
per "design for isolation": retrofitting group-coupled functions full of
`groupId`-scoped activity logging and `revalidatePath('/groups/...')` calls
would add branching throughout already-nontrivial code for a fundamentally
different flow):

- `src/lib/data/friends.ts` — `getMyFriends()` (friend list + each one's `direct_net_position`), `getIncomingFriendRequests()`, `getFriendBundle(friendUserId)` (that friend's direct expenses/settlements + a `Ledger` built via the *existing, unchanged* `buildLedger()` from `src/lib/balance`, called with `members: [me, friend]`).
- `src/lib/actions/friends.ts` — `sendFriendRequest`, `respondToFriendRequest`, `removeFriend`, `createDirectExpense`, `createDirectSettlement`, `respondToDirectSettlement`.

## Out of scope (v1)

Editing or soft-deleting a direct expense once created. Receipts, comments,
and edit-revision history on direct expenses (all exist for group expenses;
skipped here to keep an already-large feature bounded — a direct expense in
v1 is create-once, settle-up, done). `activity_log` entries for any direct
activity (its schema/RLS is entirely group-shaped; extending it is real
additional scope, deferred). Blocking/declining future requests from someone
you've unfriended (no separate "blocked" state — same as Splitwise doesn't
either).

## Interface handoff to the UI session

- A "Friends" section (this is the natural fourth nav tab from the earlier
  nav-structure discussion in this session).
- Add-friend form: email input → `sendFriendRequest`.
- Incoming-requests list: accept/decline buttons → `respondToFriendRequest`.
- Friend list: name + `direct_net_position`-derived balance per friend,
  formatted with `formatPHP`. **Ruling**: direct expenses are PHP-only in
  v1 — multi-currency (sub-project 2) was scoped to *groups specifically*
  (a group has one currency, set at creation); a groupless expense has no
  natural currency to inherit, and building currency selection for direct
  expenses too is unscoped additional work. Revisit if the user wants it
  later; not blocking for this sub-project.
- Friend detail page: expense/settlement history + "settle up" form, mirroring `SettleForm.tsx`'s existing shape but targeting a friend instead of a group member.
