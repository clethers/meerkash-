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
  return new;
end;
$$;

create or replace function is_username_available(check_username text)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from profiles where lower(username) = lower(check_username)
  );
$$;

grant execute on function is_username_available(text) to anon, authenticated;
