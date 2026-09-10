-- ============================================================================
-- AbonoShare — let friend-request counterparts see each other's profile
--
-- Found via a real two-account browser test: the only existing profiles
-- SELECT policies are "read own profile" and "read profiles of co-members"
-- (shared group). Two people who aren't in a group together yet — the
-- entire point of a pending or just-accepted friend request — couldn't see
-- each other's display_name/avatar at all, so getIncomingFriendRequests()
-- silently dropped every request (it joins profiles, RLS returned nothing,
-- and the code filters out rows with no matching profile).
-- ============================================================================
create policy "read profiles of friend-request counterparts"
  on profiles for select using (
    exists (
      select 1 from friend_requests fr
      where (fr.from_user_id = auth.uid() and fr.to_user_id = profiles.id)
         or (fr.to_user_id = auth.uid() and fr.from_user_id = profiles.id)
    )
    or exists (
      select 1 from friendships f
      where (f.user_a_id = auth.uid() and f.user_b_id = profiles.id)
         or (f.user_b_id = auth.uid() and f.user_a_id = profiles.id)
    )
  );
