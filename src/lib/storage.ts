import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export const AVATARS_BUCKET = 'avatars';
export const PAYMENT_QR_BUCKET = 'payment-qr';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Shared by uploadAvatar and uploadPaymentQr: both buckets are public-read,
 * 2 MB, same image types, and only differ in bucket name and path prefix.
 */
async function uploadImage(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File | null,
): Promise<{ url: string } | { error: string } | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_BYTES) return { error: 'That image is larger than 2 MB.' };
  if (file.type && !ALLOWED.has(file.type)) {
    return { error: 'Use a PNG, JPEG, WebP or GIF image.' };
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });

  if (error) return { error: 'We could not upload that image.' };

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl };
}

/**
 * Upload an avatar and return its public URL, or an error message.
 * Returns null when there is simply no file to upload.
 */
export async function uploadAvatar(
  supabase: SupabaseClient,
  scope: 'users' | 'groups',
  ownerId: string,
  file: File | null,
): Promise<{ url: string } | { error: string } | null> {
  if (!file || file.size === 0) return null;
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().slice(0, 5);
  const path = `${scope}/${ownerId}/${Date.now()}.${ext}`;
  return uploadImage(supabase, AVATARS_BUCKET, path, file);
}

/**
 * Upload a user's own payment QR code (e.g. InstaPay, GCash, bank) and
 * return its public URL, or an error message. Returns null when there is
 * simply no file to upload.
 */
export async function uploadPaymentQr(
  supabase: SupabaseClient,
  ownerId: string,
  file: File | null,
): Promise<{ url: string } | { error: string } | null> {
  if (!file || file.size === 0) return null;
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().slice(0, 5);
  const path = `users/${ownerId}/${Date.now()}.${ext}`;
  return uploadImage(supabase, PAYMENT_QR_BUCKET, path, file);
}
