-- ============================================================================
-- AbonoShare — check whether an email already has a confirmed account
--
-- Lets the signup/login OTP forms tell a visitor upfront "you already have
-- an account" or "no account found" before sending a code, instead of the
-- confusing bounce-back they'd otherwise see after a verify() call decides
-- what "email + shouldCreateUser" actually meant.
--
-- SECURITY DEFINER, returns only a boolean, granted to anon — same shape as
-- is_username_available() in 0014_username.sql: safe for an unauthenticated
-- visitor to call without gaining read access to profiles/auth.users.
-- Only a *confirmed* account counts as registered, matching
-- is_username_available()'s same reasoning: an unconfirmed signup that never
-- finished shouldn't block or redirect a real attempt.
-- ============================================================================

create or replace function email_has_account(check_email text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from auth.users u
     where lower(u.email) = lower(check_email)
       and u.email_confirmed_at is not null
  );
$$;

grant execute on function email_has_account(text) to anon, authenticated;
