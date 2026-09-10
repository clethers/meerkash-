import 'server-only';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/utils';
import type { GroupInvite } from '@/types/db';

/**
 * Requirement 4: one long-lived shareable link per group, plus the QR code
 * rendered from it. Idempotent — an existing usable link is reused rather than
 * piling up new tokens every time someone opens the members page.
 */
export async function getOrCreateInvite(groupId: string): Promise<GroupInvite | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from('group_invites')
    .select('*')
    .eq('group_id', groupId)
    .is('revoked_at', null)
    .is('max_uses', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as GroupInvite;

  const { data } = await supabase
    .from('group_invites')
    .insert({ group_id: groupId, created_by: user.id })
    .select('*')
    .single();

  return (data as GroupInvite | null) ?? null;
}

export function inviteUrl(token: string): string {
  return `${siteUrl()}/join/${token}`;
}

/** An inline SVG so the QR needs no client-side library and no network. */
export async function inviteQrSvg(token: string): Promise<string> {
  return QRCode.toString(inviteUrl(token), {
    type: 'svg',
    margin: 1,
    width: 220,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}
