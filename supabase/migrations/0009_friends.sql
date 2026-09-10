-- ============================================================================
-- AbonoShare — friends and direct (groupless) balances
--
-- Reverses half of requirement 2: two people can now have a direct 1:1
-- expense/settlement relationship outside any group. Friendship is explicit
-- (request/accept), mirroring the existing group_invites (lifecycle) /
-- group_members (materialized fast lookup) split.
--
-- A direct expense/settlement is simply one with group_id = null. Every
-- other mechanism (split modes, the balance engine, categories) is reused
-- unchanged.
-- ============================================================================

-- --------------------------------------------------------------- tables ---
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

create index friend_requests_to_idx on friend_requests (to_user_id) where status = 'pending';

-- Materialized accepted relation. Canonical ordering (user_a_id < user_b_id)
-- avoids storing both a->b and b->a for the same pair.
create table friendships (
  user_a_id uuid not null references profiles(id),
  user_b_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  primary key (user_a_id, user_b_id),
  constraint friendship_ordered check (user_a_id < user_b_id)
);

-- ------------------------------------------------------- nullable group ---
alter table expenses alter column group_id drop not null;
alter table settlements alter column group_id drop not null;

-- --------------------------------------------------------------- helpers --
-- SECURITY DEFINER so policies can query these tables without RLS
-- re-applying to the query inside the function (the same reason
-- is_group_member()/is_group_owner()/expense_group() are functions, not
-- inline subqueries, in 0002_rls.sql).
create or replace function are_friends(uid1 uuid, uid2 uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where user_a_id = least(uid1, uid2) and user_b_id = greatest(uid1, uid2)
  );
$$;

-- NOTE ON A REAL BUG FOUND DURING TESTING: a first version of this migration
-- had a single can_access_direct_expense(eid) helper that re-queried
-- `expenses` from inside an `expenses` policy. That self-reference breaks
-- specifically for `INSERT ... RETURNING` (what every `.select().single()`
-- call after an insert compiles to): the inner query does not see the row
-- the outer INSERT is still in the middle of adding, in the same command,
-- so the RETURNING-phase visibility check fails even though the insert
-- itself succeeded. The fix is to never have an `expenses` policy re-query
-- `expenses` — reference the row's own columns directly instead (`created_by
-- = auth.uid()`), and only query `expense_participants` (a genuinely
-- different table) via a helper. `expense_participants`'s own policies are
-- free to query `expenses`, since by the time participants are inserted (a
-- separate, later statement), the expense row is already committed.
create or replace function is_expense_participant(eid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from expense_participants where expense_id = eid and user_id = uid);
$$;

grant execute on function are_friends(uuid, uuid) to authenticated;
grant execute on function is_expense_participant(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------ RLS --
-- Additive: Postgres OR's multiple permissive policies for the same
-- command together, so these sit alongside the existing group-scoped
-- policies in 0002_rls.sql without touching them.
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
-- No insert/update/delete policies on either table on purpose: every write
-- goes through the SECURITY DEFINER RPCs below, which bypass RLS
-- internally. With no permissive policy for those commands, RLS denies
-- them outright to any direct PostgREST write attempt.

-- ------------------------------------------------- friendship enforcement -
-- settlements can validate friendship declaratively at insert time (both
-- parties are named directly in the row, see the insert policy above).
-- expenses cannot: participants live in a separate table populated by a
-- later statement, so insert-time RLS on expenses alone can't yet see who
-- the other participant is. A trigger closes that gap once both rows exist.
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

-- --------------------------------------------------------- direct ledger --
-- Mirrors group_net_positions()'s structure, scoped to group_id is null and
-- one specific pair instead of one group's active members.
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

grant execute on function direct_net_position(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------ RPCs --
create or replace function search_user_by_email(target_email text)
returns table (id uuid, display_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name from profiles p
  where p.email = target_email and p.deleted_at is null and p.id <> auth.uid()
  limit 1;
$$;

create or replace function send_friend_request(target_user_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  existing record;
  req_id uuid;
begin
  if me is null then raise exception 'You must be signed in.'; end if;
  if target_user_id = me then raise exception 'You cannot friend yourself.'; end if;
  if are_friends(me, target_user_id) then raise exception 'You are already friends.'; end if;

  select * into existing from friend_requests
   where status = 'pending'
     and ((from_user_id = me and to_user_id = target_user_id)
       or (from_user_id = target_user_id and to_user_id = me));

  if existing is not null then
    if existing.from_user_id = target_user_id then
      return accept_friend_request(existing.id);
    end if;
    raise exception 'You already sent a request to this person.';
  end if;

  insert into friend_requests (from_user_id, to_user_id) values (me, target_user_id)
  returning id into req_id;

  insert into notifications (user_id, group_id, type, title, body)
  select target_user_id, null, 'friend.requested',
         (select display_name from profiles where id = me) || ' wants to be your friend',
         null;

  return req_id;
end;
$$;

create or replace function accept_friend_request(request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  req record;
  a uuid;
  b uuid;
begin
  select * into req from friend_requests where id = request_id;
  if req is null then raise exception 'That request no longer exists.'; end if;
  if req.to_user_id <> me then raise exception 'That request was not sent to you.'; end if;
  if req.status <> 'pending' then raise exception 'That request was already answered.'; end if;

  update friend_requests set status = 'accepted', responded_at = now() where id = request_id;

  a := least(req.from_user_id, req.to_user_id);
  b := greatest(req.from_user_id, req.to_user_id);
  insert into friendships (user_a_id, user_b_id) values (a, b)
  on conflict do nothing;

  insert into notifications (user_id, group_id, type, title, body)
  select req.from_user_id, null, 'friend.accepted',
         (select display_name from profiles where id = me) || ' accepted your friend request',
         null;
end;
$$;

create or replace function decline_friend_request(request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  req record;
begin
  select * into req from friend_requests where id = request_id;
  if req is null then raise exception 'That request no longer exists.'; end if;
  if req.to_user_id <> me then raise exception 'That request was not sent to you.'; end if;
  if req.status <> 'pending' then raise exception 'That request was already answered.'; end if;

  update friend_requests set status = 'declined', responded_at = now() where id = request_id;
end;
$$;

create or replace function remove_friend(friend_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a uuid := least(me, friend_user_id);
  b uuid := greatest(me, friend_user_id);
begin
  if not are_friends(me, friend_user_id) then
    raise exception 'You are not friends with this person.';
  end if;
  if direct_net_position(friend_user_id, me) <> 0 then
    raise exception 'Settle your outstanding balance before removing this friend.';
  end if;
  delete from friendships where user_a_id = a and user_b_id = b;
end;
$$;

grant execute on function search_user_by_email(text) to authenticated;
grant execute on function send_friend_request(uuid) to authenticated;
grant execute on function accept_friend_request(uuid) to authenticated;
grant execute on function decline_friend_request(uuid) to authenticated;
grant execute on function remove_friend(uuid) to authenticated;
