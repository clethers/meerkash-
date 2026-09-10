'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/data/groups';
import type { AppNotification } from '@/types/db';
import { fail, ok, readableError, type ActionResult } from './shared';

export async function getNotifications(limit = 40): Promise<AppNotification[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as AppNotification[];
}

export async function getUnreadCount(): Promise<number> {
  const user = await getAuthUser();
  if (!user) return 0;
  const supabase = await createClient();

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);

  return count ?? 0;
}

export async function markAllRead(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('You are not signed in.');

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) return fail(readableError(error, 'Could not update your notifications.'));
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
  return ok();
}

export async function markRead(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return fail(readableError(error, 'Could not update that notification.'));
  revalidatePath('/notifications');
  return ok();
}
