-- ============================================================================
-- AbonoShare — Row Level Security (requirement 32)
--
-- The frontend hides buttons; THIS is what actually enforces permissions.
-- Every rule below assumes an attacker with a valid anon key and a real
-- session, calling PostgREST directly.
--
-- Helper functions are SECURITY DEFINER so that a policy on group_members can
-- ask "is this person a member?" without recursing into its own policy.
-- ============================================================================

-- --------------------------------------------------------------- helpers ---
create or replace function is_group_member(gid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = uid and status = 'active'
  );
$$;

create or replace function is_group_owner(gid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = uid and status = 'active' and role = 'owner'
  );
$$;

-- "Was ever in this group" — a member who left keeps NO read access
-- (requirement 25: they lose group access completely), but historical rows
-- still reference them, which is why removal is a status change, not a delete.
create or replace function was_group_member(gid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = uid);
$$;

create or replace function expense_group(eid uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from expenses where id = eid;
$$;

grant execute on function is_group_member(uuid, uuid)  to authenticated;
grant execute on function is_group_owner(uuid, uuid)   to authenticated;
grant execute on function was_group_member(uuid, uuid) to authenticated;
grant execute on function expense_group(uuid)          to authenticated;

-- ---------------------------------------------------------- enable RLS -----
alter table profiles              enable row level security;
alter table groups                enable row level security;
alter table group_members         enable row level security;
alter table group_invites         enable row level security;
alter table expenses              enable row level security;
alter table expense_participants  enable row level security;
alter table expense_revisions     enable row level security;
alter table expense_comments      enable row level security;
alter table settlements           enable row level security;
alter table activity_log          enable row level security;
alter table notifications         enable row level security;
alter table recurring_templates   enable row level security;
alter table recurring_occurrences enable row level security;

-- -------------------------------------------------------------- profiles ---
create policy "read own profile"
  on profiles for select using (id = auth.uid());

-- You can see the profile of anyone you currently share a group with.
create policy "read profiles of co-members"
  on profiles for select using (
    exists (
      select 1
      from group_members mine
      join group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = auth.uid() and mine.status = 'active'
        and theirs.user_id = profiles.id
    )
  );

create policy "update own profile"
  on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------- groups ---
create policy "members read their groups"
  on groups for select using (is_group_member(id));

create policy "any authenticated user can create a group"
  on groups for insert with check (auth.uid() = created_by and auth.uid() = owner_id);

-- Requirement 5: only the owner renames the group / changes its photo /
-- transfers ownership.
create policy "owner updates the group"
  on groups for update using (is_group_owner(id)) with check (is_group_owner(id));

-- --------------------------------------------------------- group_members ---
create policy "members read the roster"
  on group_members for select using (is_group_member(group_id) or user_id = auth.uid());

-- Joining happens through accept_invite(); the creator's own first row is the
-- only membership a client may insert directly.
create policy "creator seeds their own membership"
  on group_members for insert with check (
    user_id = auth.uid()
    and exists (select 1 from groups g where g.id = group_id and g.created_by = auth.uid())
  );

-- Leaving (own row) or the owner removing/promoting someone.
create policy "leave or be removed"
  on group_members for update using (
    user_id = auth.uid() or is_group_owner(group_id)
  ) with check (
    user_id = auth.uid() or is_group_owner(group_id)
  );

-- --------------------------------------------------------- group_invites ---
create policy "members read invites"
  on group_invites for select using (is_group_member(group_id));

-- Requirement 5: ordinary members may invite people.
create policy "members create invites"
  on group_invites for insert with check (
    is_group_member(group_id) and created_by = auth.uid()
  );

create policy "creator or owner revokes an invite"
  on group_invites for update using (
    created_by = auth.uid() or is_group_owner(group_id)
  ) with check (
    created_by = auth.uid() or is_group_owner(group_id)
  );

-- -------------------------------------------------------------- expenses ---
create policy "members read group expenses"
  on expenses for select using (is_group_member(group_id));

create policy "members create expenses"
  on expenses for insert with check (
    is_group_member(group_id) and created_by = auth.uid()
  );

-- Requirement 13/14: any active member may edit or soft-delete; every change
-- is recorded in expense_revisions and activity_log by the server action.
create policy "members edit expenses"
  on expenses for update using (is_group_member(group_id)) with check (is_group_member(group_id));

-- Deliberately NO delete policy: expenses are soft-deleted, never removed.

-- -------------------------------------------- expense_participants + kin ---
create policy "members read participants"
  on expense_participants for select using (is_group_member(expense_group(expense_id)));

create policy "members write participants"
  on expense_participants for insert with check (is_group_member(expense_group(expense_id)));

create policy "members update participants"
  on expense_participants for update using (is_group_member(expense_group(expense_id)))
  with check (is_group_member(expense_group(expense_id)));

create policy "members remove participants"
  on expense_participants for delete using (is_group_member(expense_group(expense_id)));

create policy "members read revisions"
  on expense_revisions for select using (is_group_member(expense_group(expense_id)));

create policy "members write revisions"
  on expense_revisions for insert with check (
    is_group_member(expense_group(expense_id)) and edited_by = auth.uid()
  );

create policy "members read comments"
  on expense_comments for select using (is_group_member(expense_group(expense_id)));

create policy "members write comments"
  on expense_comments for insert with check (
    is_group_member(expense_group(expense_id)) and user_id = auth.uid()
  );

create policy "authors edit their comments"
  on expense_comments for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------- settlements ---
-- The settlement RECORD is group-visible so balances make sense to everyone;
-- the PROOF IMAGE is not (requirement 23) — that is enforced in storage RLS.
create policy "members read settlements"
  on settlements for select using (is_group_member(group_id));

create policy "the payer records a settlement"
  on settlements for insert with check (
    is_group_member(group_id) and from_user_id = auth.uid()
  );

-- Requirement 20: only the RECEIVER may confirm or reject. The payer may only
-- withdraw their own still-pending request.
create policy "receiver responds, payer withdraws"
  on settlements for update using (
    (to_user_id = auth.uid())
    or (from_user_id = auth.uid() and status = 'pending')
  ) with check (
    (to_user_id = auth.uid())
    or (from_user_id = auth.uid() and status = 'pending')
  );

-- --------------------------------------------------- activity + notifs -----
create policy "members read the audit trail"
  on activity_log for select using (is_group_member(group_id));

create policy "members append to the audit trail"
  on activity_log for insert with check (
    is_group_member(group_id) and (actor_id = auth.uid() or actor_id is null)
  );
-- No update, no delete: the audit trail is append-only by design.

create policy "read own notifications"
  on notifications for select using (user_id = auth.uid());

create policy "mark own notifications read"
  on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "members notify co-members"
  on notifications for insert with check (
    group_id is null or is_group_member(group_id)
  );

create policy "delete own notifications"
  on notifications for delete using (user_id = auth.uid());

-- ------------------------------------------------------------- recurring ---
create policy "members read templates"
  on recurring_templates for select using (is_group_member(group_id));

create policy "members create templates"
  on recurring_templates for insert with check (
    is_group_member(group_id) and created_by = auth.uid()
  );

create policy "members update templates"
  on recurring_templates for update using (is_group_member(group_id))
  with check (is_group_member(group_id));

create policy "members read occurrences"
  on recurring_occurrences for select using (
    exists (
      select 1 from recurring_templates t
      where t.id = template_id and is_group_member(t.group_id)
    )
  );

create policy "members write occurrences"
  on recurring_occurrences for insert with check (
    exists (
      select 1 from recurring_templates t
      where t.id = template_id and is_group_member(t.group_id)
    )
  );

create policy "members update occurrences"
  on recurring_occurrences for update using (
    exists (
      select 1 from recurring_templates t
      where t.id = template_id and is_group_member(t.group_id)
    )
  ) with check (
    exists (
      select 1 from recurring_templates t
      where t.id = template_id and is_group_member(t.group_id)
    )
  );
