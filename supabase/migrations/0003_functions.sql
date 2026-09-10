-- ============================================================================
-- AbonoShare — server-side operations that must not be trusted to the client.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Net positions, computed in the database.
--
-- Amount Paid − Fair Share = Net Position, plus confirmed settlements.
-- This mirrors src/lib/balance exactly. The TypeScript version renders the UI;
-- THIS version is what guards leave_group, so a malicious client cannot walk
-- away from a debt by lying about its own balance.
-- ---------------------------------------------------------------------------
create or replace function group_net_positions(gid uuid)
returns table (user_id uuid, net_centavos bigint)
language sql stable security definer set search_path = public as $$
  with members as (
    select gm.user_id from group_members gm
    where gm.group_id = gid and gm.status = 'active'
  ),
  paid as (
    select e.payer_id as user_id, sum(e.amount_centavos)::bigint as amount
    from expenses e
    where e.group_id = gid and e.deleted_at is null
    group by e.payer_id
  ),
  owed as (
    select ep.user_id, sum(ep.share_centavos)::bigint as amount
    from expense_participants ep
    join expenses e on e.id = ep.expense_id
    where e.group_id = gid and e.deleted_at is null
    group by ep.user_id
  ),
  paid_out as (
    select s.from_user_id as user_id, sum(s.amount_centavos)::bigint as amount
    from settlements s
    where s.group_id = gid and s.status = 'confirmed' and s.deleted_at is null
    group by s.from_user_id
  ),
  received as (
    select s.to_user_id as user_id, sum(s.amount_centavos)::bigint as amount
    from settlements s
    where s.group_id = gid and s.status = 'confirmed' and s.deleted_at is null
    group by s.to_user_id
  ),
  everyone as (
    select user_id from members
    union select user_id from paid
    union select user_id from owed
    union select user_id from paid_out
    union select user_id from received
  )
  select
    everyone.user_id,
    (coalesce(paid.amount, 0)
     - coalesce(owed.amount, 0)
     + coalesce(paid_out.amount, 0)
     - coalesce(received.amount, 0))::bigint
  from everyone
  left join paid     on paid.user_id     = everyone.user_id
  left join owed     on owed.user_id     = everyone.user_id
  left join paid_out on paid_out.user_id = everyone.user_id
  left join received on received.user_id = everyone.user_id;
$$;

create or replace function my_group_balance(gid uuid)
returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select net_centavos from group_net_positions(gid) where user_id = auth.uid()),
    0
  );
$$;

-- ---------------------------------------------------------------------------
-- Requirement 4: invitations. The invitee must ACCEPT before joining.
-- ---------------------------------------------------------------------------
create or replace function preview_invite(invite_token text)
returns table (group_id uuid, group_name text, avatar_url text, avatar_seed text,
               member_count integer, already_member boolean, valid boolean, reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  inv record;
  grp record;
begin
  select * into inv from group_invites gi where gi.token = invite_token;

  if inv is null then
    return query select null::uuid, null::text, null::text, null::text, 0, false, false,
                        'This invitation link is not valid.';
    return;
  end if;

  select * into grp from groups g where g.id = inv.group_id;

  if grp is null or grp.deleted_at is not null then
    return query select inv.group_id, null::text, null::text, null::text, 0, false, false,
                        'That group no longer exists.';
    return;
  end if;

  return query
  select
    grp.id,
    grp.name,
    grp.avatar_url,
    grp.avatar_seed,
    (select count(*)::integer from group_members gm
      where gm.group_id = grp.id and gm.status = 'active'),
    exists (select 1 from group_members gm
             where gm.group_id = grp.id and gm.user_id = auth.uid() and gm.status = 'active'),
    (inv.revoked_at is null
      and inv.expires_at > now()
      and (inv.max_uses is null or inv.uses < inv.max_uses)),
    case
      when inv.revoked_at is not null then 'This invitation has been revoked.'
      when inv.expires_at <= now()    then 'This invitation has expired.'
      when inv.max_uses is not null and inv.uses >= inv.max_uses
                                      then 'This invitation has already been used.'
      else null
    end;
end;
$$;

create or replace function accept_invite(invite_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv    record;
  me     uuid := auth.uid();
  existing record;
begin
  if me is null then raise exception 'You must be signed in to join a group.'; end if;

  select * into inv from group_invites gi where gi.token = invite_token for update;
  if inv is null then raise exception 'This invitation link is not valid.'; end if;
  if inv.revoked_at is not null then raise exception 'This invitation has been revoked.'; end if;
  if inv.expires_at <= now() then raise exception 'This invitation has expired.'; end if;
  if inv.max_uses is not null and inv.uses >= inv.max_uses then
    raise exception 'This invitation has already been used.';
  end if;

  select * into existing from group_members gm
   where gm.group_id = inv.group_id and gm.user_id = me;

  if existing is null then
    -- Requirement 6: a new member starts at zero and joins future expenses only.
    insert into group_members (group_id, user_id, role, status)
    values (inv.group_id, me, 'member', 'active');
  elsif existing.status <> 'active' then
    update group_members
       set status = 'active', joined_at = now(), left_at = null, removed_by = null
     where id = existing.id;
  else
    return inv.group_id; -- already in, nothing to do
  end if;

  update group_invites set uses = uses + 1 where id = inv.id;

  insert into activity_log (group_id, actor_id, action, subject_type, subject_id, metadata)
  values (inv.group_id, me, 'member.joined', 'member', me, jsonb_build_object('via', 'invite'));

  return inv.group_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Requirement 25: you cannot walk away from an outstanding balance.
-- ---------------------------------------------------------------------------
create or replace function leave_group(gid uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me      uuid := auth.uid();
  balance bigint;
  is_owner boolean;
begin
  if not is_group_member(gid, me) then raise exception 'You are not a member of this group.'; end if;

  select coalesce((select net_centavos from group_net_positions(gid) where user_id = me), 0)
    into balance;

  if balance <> 0 then
    raise exception 'Settle your outstanding balance before leaving this group.';
  end if;

  select (role = 'owner') into is_owner from group_members
   where group_id = gid and user_id = me;

  if is_owner then
    raise exception 'Transfer ownership to another member before leaving this group.';
  end if;

  update group_members
     set status = 'left', left_at = now()
   where group_id = gid and user_id = me;

  insert into activity_log (group_id, actor_id, action, subject_type, subject_id)
  values (gid, me, 'member.left', 'member', me);
end;
$$;

create or replace function remove_member(gid uuid, target uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me      uuid := auth.uid();
  balance bigint;
begin
  if not is_group_owner(gid, me) then
    raise exception 'Only the group owner can remove members.';
  end if;
  if target = me then raise exception 'Transfer ownership before removing yourself.'; end if;

  select coalesce((select net_centavos from group_net_positions(gid) where user_id = target), 0)
    into balance;
  if balance <> 0 then
    raise exception 'That member still has an outstanding balance. Settle up first.';
  end if;

  update group_members
     set status = 'removed', left_at = now(), removed_by = me
   where group_id = gid and user_id = target and status = 'active';

  insert into activity_log (group_id, actor_id, action, subject_type, subject_id)
  values (gid, me, 'member.removed', 'member', target);

  insert into notifications (user_id, group_id, type, title, body)
  select target, gid, 'member.removed', 'You were removed from a group',
         (select name from groups where id = gid);
end;
$$;

-- ---------------------------------------------------------------------------
-- Requirement 26: ownership transfer.
-- ---------------------------------------------------------------------------
create or replace function transfer_ownership(gid uuid, new_owner uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not is_group_owner(gid, me) then
    raise exception 'Only the current owner can transfer ownership.';
  end if;
  if not is_group_member(gid, new_owner) then
    raise exception 'That person is not an active member of this group.';
  end if;

  update group_members set role = 'member' where group_id = gid and user_id = me;
  update group_members set role = 'owner'  where group_id = gid and user_id = new_owner;
  update groups set owner_id = new_owner where id = gid;

  insert into activity_log (group_id, actor_id, action, subject_type, subject_id, metadata)
  values (gid, me, 'group.ownership_transferred', 'group', gid,
          jsonb_build_object('from', me, 'to', new_owner));

  insert into notifications (user_id, group_id, type, title, body)
  select gm.user_id, gid, 'group.ownership_transferred', 'Group ownership changed',
         (select name from groups where id = gid)
    from group_members gm
   where gm.group_id = gid and gm.status = 'active' and gm.user_id <> me;
end;
$$;

-- ---------------------------------------------------------------------------
-- Requirement 31: soft-delete / anonymise the account, keep the ledger intact.
-- ---------------------------------------------------------------------------
create or replace function delete_my_account()
returns void
language plpgsql security definer set search_path = public as $$
declare
  me       uuid := auth.uid();
  owing    integer;
begin
  if me is null then raise exception 'Not signed in.'; end if;

  select count(*) into owing
    from group_members gm
   where gm.user_id = me and gm.status = 'active'
     and coalesce((select net_centavos from group_net_positions(gm.group_id)
                    where user_id = me), 0) <> 0;

  if owing > 0 then
    raise exception 'Settle your outstanding balances in % group(s) before deleting your account.', owing;
  end if;

  update group_members set status = 'left', left_at = now()
   where user_id = me and status = 'active';

  -- Historical expenses, settlements and activity keep pointing at this row so
  -- group balances and history stay meaningful; the person behind it is gone.
  update profiles
     set display_name = 'Deleted user',
         avatar_url   = null,
         email        = null,
         deleted_at   = now()
   where id = me;

  delete from notifications where user_id = me;
end;
$$;

grant execute on function group_net_positions(uuid)     to authenticated;
grant execute on function my_group_balance(uuid)        to authenticated;
grant execute on function preview_invite(text)          to authenticated;
grant execute on function accept_invite(text)           to authenticated;
grant execute on function leave_group(uuid)             to authenticated;
grant execute on function remove_member(uuid, uuid)     to authenticated;
grant execute on function transfer_ownership(uuid, uuid) to authenticated;
grant execute on function delete_my_account()           to authenticated;
