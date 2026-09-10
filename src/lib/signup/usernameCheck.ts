import type { SupabaseClient } from '@supabase/supabase-js';

export async function checkUsernameAvailable(
  supabase: SupabaseClient,
  username: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_username_available', {
    check_username: username,
  });
  if (error) throw error;
  return Boolean(data);
}
