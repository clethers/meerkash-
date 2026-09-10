import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Set on success when the caller should navigate somewhere. */
  redirectTo?: string;
  /** Free-form payload (an id, a token) for the calling component. */
  data?: Record<string, unknown>;
}

export const ok = (data?: Record<string, unknown>, redirectTo?: string): ActionResult => ({
  ok: true,
  ...(data ? { data } : {}),
  ...(redirectTo ? { redirectTo } : {}),
});

export const fail = (error: string): ActionResult => ({ ok: false, error });

export function readableError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    // Postgres raises come through with a prefix we do not want to show.
    return error.message.replace(/^.*?:\s*/, '').trim() || fallback;
  }
  return fallback;
}

export async function logActivity(
  supabase: SupabaseClient,
  entry: {
    groupId: string;
    actorId: string;
    action: string;
    subjectType: string;
    subjectId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from('activity_log').insert({
    group_id: entry.groupId,
    actor_id: entry.actorId,
    action: entry.action,
    subject_type: entry.subjectType,
    subject_id: entry.subjectId ?? null,
    metadata: entry.metadata ?? {},
  });
}

/**
 * Requirement 27: notify people only when something touches their balance,
 * participation, permissions or access. `recipients` is filtered here so no
 * caller can accidentally spam the whole group.
 */
export async function notify(
  supabase: SupabaseClient,
  params: {
    recipients: string[];
    exclude?: string;
    groupId: string | null;
    type: string;
    title: string;
    body?: string;
    link?: string;
  },
) {
  const targets = Array.from(new Set(params.recipients)).filter(
    (id) => id && id !== params.exclude,
  );
  if (targets.length === 0) return;

  await supabase.from('notifications').insert(
    targets.map((user_id) => ({
      user_id,
      group_id: params.groupId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    })),
  );
}
