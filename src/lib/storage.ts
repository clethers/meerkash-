import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export const AVATARS_BUCKET = 'avatars';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_BYTES = 2 * 1024 * 1024;

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
  if (file.size > MAX_BYTES) return { error: 'That image is larger than 2 MB.' };
  if (file.type && !ALLOWED.has(file.type)) {
    return { error: 'Use a PNG, JPEG, WebP or GIF image.' };
  }

  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().slice(0, 5);
  const path = `${scope}/${ownerId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });

  if (error) return { error: 'We could not upload that image.' };

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
