-- ============================================================================
-- AbonoShare — RLS security fixes
--
-- 1. group_members: the "leave or be removed" UPDATE policy only checked
--    `user_id = auth.uid()`, not which columns changed. Any member could call
--    PostgREST directly and set their own role to 'owner', or flip their own
--    status back to 'active' after being removed. Fix: drop the policy — every
--    legitimate membership change already goes through the SECURITY DEFINER
--    functions below (leave_group, remove_member, transfer_ownership), which
--    run as the table owner and are exempt from RLS. The only direct client
--    write to this table is the creator's own INSERT, covered by the existing
--    "creator seeds their own membership" policy. No client code performs a
--    direct UPDATE on group_members, so removing this policy closes the hole
--    without breaking anything.
-- ============================================================================
drop policy if exists "leave or be removed" on group_members;

-- ============================================================================
-- 2. group_invites: the update policy (used directly by revokeInvite()) let
--    an invite's own creator repoint its group_id to an arbitrary group,
--    since neither USING nor WITH CHECK constrained which columns changed.
--    accept_invite() trusts group_id unconditionally, so this let anyone who
--    could create an invite for one group redeem it into a different group
--    they have no relationship to. RLS's WITH CHECK can't compare old vs new
--    values directly, so this is enforced with a trigger instead.
-- ============================================================================
create or replace function forbid_group_invite_regroup()
returns trigger
language plpgsql as $$
begin
  if new.group_id <> old.group_id then
    raise exception 'An invite''s group cannot be changed.';
  end if;
  return new;
end;
$$;

drop trigger if exists group_invites_forbid_regroup on group_invites;
create trigger group_invites_forbid_regroup
  before update on group_invites
  for each row execute function forbid_group_invite_regroup();
