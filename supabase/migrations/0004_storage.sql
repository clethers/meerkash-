-- ============================================================================
-- AbonoShare — Supabase Storage (requirements 12 and 23)
--
-- Two private buckets. Neither is public; the app serves files through signed
-- URLs, and these policies decide who may ask for one.
--
--   receipts/<group_id>/<expense_id>/<filename>
--     Visible to every ACTIVE member of the group (receipt visibility follows
--     expense participation rules — group members see the group's expenses).
--
--   settlement-proofs/<settlement_id>/<filename>
--     Visible ONLY to the two people in the settlement. Other members of the
--     group cannot see it, no matter what the UI does.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('receipts', 'receipts', false, 10485760,
   array['image/png','image/jpeg','image/webp','image/heic','application/pdf']),
  ('settlement-proofs', 'settlement-proofs', false, 10485760,
   array['image/png','image/jpeg','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

-- --------------------------------------------------------------- receipts ---
create policy "members read group receipts"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and is_group_member((storage.foldername(name))[1]::uuid)
  );

create policy "members upload group receipts"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and is_group_member((storage.foldername(name))[1]::uuid)
    and owner = auth.uid()
  );

create policy "uploader replaces their receipt"
  on storage.objects for update
  using (bucket_id = 'receipts' and owner = auth.uid())
  with check (bucket_id = 'receipts' and owner = auth.uid());

create policy "uploader removes their receipt"
  on storage.objects for delete
  using (bucket_id = 'receipts' and owner = auth.uid());

-- ------------------------------------------------------ settlement proofs ---
-- The private one. Membership is NOT enough — you must be one of the two
-- people named on the settlement.
create policy "only the two parties read a settlement proof"
  on storage.objects for select
  using (
    bucket_id = 'settlement-proofs'
    and exists (
      select 1 from settlements s
      where s.id = (storage.foldername(name))[1]::uuid
        and auth.uid() in (s.from_user_id, s.to_user_id)
    )
  );

create policy "the payer uploads the proof"
  on storage.objects for insert
  with check (
    bucket_id = 'settlement-proofs'
    and owner = auth.uid()
    and exists (
      select 1 from settlements s
      where s.id = (storage.foldername(name))[1]::uuid
        and s.from_user_id = auth.uid()
    )
  );

create policy "the payer replaces their own proof"
  on storage.objects for update
  using (bucket_id = 'settlement-proofs' and owner = auth.uid())
  with check (bucket_id = 'settlement-proofs' and owner = auth.uid());

create policy "the payer deletes their own proof"
  on storage.objects for delete
  using (bucket_id = 'settlement-proofs' and owner = auth.uid());
