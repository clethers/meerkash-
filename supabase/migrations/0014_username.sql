-- ============================================================================
-- AbonoShare — add profiles.username
--
-- Adds a public handle used by the new "smart" signup form. The column is
-- nullable at the DB level only so pre-existing rows (created before this
-- migration) don't need a backfill — the signup form itself requires it for
-- every *new* account, enforced in src/lib/actions/auth.ts.
--
-- is_username_available() is SECURITY DEFINER and returns only a boolean so
-- an anonymous visitor typing a username during signup can check it without
-- gaining read access to the profiles table itself (no RLS change here).
-- ============================================================================

alter table profiles add column username text;

create unique index profiles_username_lower_idx on profiles (lower(username));

alter table profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.profiles (id, display_name, avatar_url, email, username)
    values (
      new.id,
      coalesce(
        nullif(new.raw_user_meta_data->>'full_name', ''),
        nullif(new.raw_user_meta_data->>'name', ''),
        split_part(coalesce(new.email, 'member'), '@', 1)
      ),
      new.raw_user_meta_data->>'avatar_url',
      new.email,
      nullif(new.raw_user_meta_data->>'username', '')
    )
    on conflict (id) do nothing;
  exception when unique_violation then
    -- The chosen username collided with a concurrent signup for the same
    -- handle (is_username_available() narrows this window right before
    -- signUp() is called, but can't close it entirely). Degrade gracefully:
    -- create the account without the username rather than aborting the
    -- whole auth.users insert and surfacing an opaque GoTrue error.
    insert into public.profiles (id, display_name, avatar_url, email, username)
    values (
      new.id,
      coalesce(
        nullif(new.raw_user_meta_data->>'full_name', ''),
        nullif(new.raw_user_meta_data->>'name', ''),
        split_part(coalesce(new.email, 'member'), '@', 1)
      ),
      new.raw_user_meta_data->>'avatar_url',
      new.email,
      null
    )
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

-- Only a *confirmed* account's username counts as taken — otherwise an
-- unconfirmed signup (e.g. one whose confirmation email never arrived)
-- permanently squats its chosen handle and blocks the same person from
-- retrying with it. profiles is schema-qualified as public.profiles because
-- this is SECURITY DEFINER with set search_path = public, which does not
-- exclude pg_temp from relation lookup — an unqualified reference is a
-- latent risk of being shadowed by a temp table of the same name.
create or replace function is_username_available(check_username text)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1
      from public.profiles p
      join auth.users u on u.id = p.id
     where lower(p.username) = lower(check_username)
       and u.email_confirmed_at is not null
  );
$$;

grant execute on function is_username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Requirement 31 (extended): also scrub the username added in this migration
-- — delete_my_account() predates the username column; without this, a
-- deleted user's handle would be retained forever and block reuse.
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
         username     = null,
         deleted_at   = now()
   where id = me;

  delete from notifications where user_id = me;
end;
$$;
