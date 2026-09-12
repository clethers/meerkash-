-- ============================================================================
-- AbonoShare — personal payment QR code (e.g. InstaPay, GCash, bank QR)
--
-- A user can upload a static QR image of their own so friends can scan it to
-- pay them back directly, as an alternative to recording a cash payment.
-- Storage follows the exact same shape as 0005_avatars.sql: public-read
-- (shown to whoever is settling up with this person), writes locked to the
-- owner's own folder.
--
-- 'qr_code' is added to payment_method as the settle-up form's second option,
-- replacing the old GCash/Maya app-open buttons. The existing values
-- (gcash, maya, bank_transfer, other, unspecified) are kept — they stay
-- valid for settlements recorded before this change and still render in
-- group settlement history.
-- ============================================================================

alter type payment_method add value if not exists 'qr_code';

alter table profiles add column if not exists payment_qr_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-qr', 'payment-qr', true, 2097152,
        array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "anyone can read a payment qr code"
  on storage.objects for select
  using (bucket_id = 'payment-qr');

create policy "you write your own payment qr code"
  on storage.objects for insert
  with check (
    bucket_id = 'payment-qr'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "you replace your own payment qr code"
  on storage.objects for update
  using (bucket_id = 'payment-qr' and owner = auth.uid())
  with check (bucket_id = 'payment-qr' and owner = auth.uid());

create policy "you delete your own payment qr code"
  on storage.objects for delete
  using (bucket_id = 'payment-qr' and owner = auth.uid());
