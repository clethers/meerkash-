-- ============================================================================
-- AbonoShare — avatar storage (requirements 1 and 3)
--
-- Profile pictures and custom group photos. This bucket IS public-read: an
-- avatar is shown next to a name all over the app, and signing every one of
-- them would mean a round trip per face on every page.
--
-- Writes are locked down by path:
--   avatars/users/<user_id>/…    only that user
--   avatars/groups/<group_id>/…  only that group's owner
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "anyone can read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "you write your own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and owner = auth.uid()
    and (
      ((storage.foldername(name))[1] = 'users'
        and (storage.foldername(name))[2] = auth.uid()::text)
      or
      ((storage.foldername(name))[1] = 'groups'
        and is_group_owner((storage.foldername(name))[2]::uuid))
    )
  );

create policy "you replace your own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and owner = auth.uid())
  with check (bucket_id = 'avatars' and owner = auth.uid());

create policy "you delete your own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and owner = auth.uid());
