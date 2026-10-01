'use server';

import { revalidatePath } from 'next/cache';
import { requireViewer } from '@/lib/auth/session';
import { createFeedToken, feedUrls } from '@/lib/feeds/token';
import { siteBaseUrl } from '@/lib/site-url';

export interface FeedLinkState {
  https?: string;
  webcal?: string;
  error?: string;
}

const KINDS = ['personal', 'location', 'absences'] as const;
type Kind = (typeof KINDS)[number];

/** Maakt een nieuwe link voor jezelf. Een bestaande link voor dezelfde feed wordt ingetrokken. */
export async function createFeedLink(_previous: FeedLinkState, formData: FormData): Promise<FeedLinkState> {
  const viewer = await requireViewer();
  const kind = String(formData.get('kind') ?? '') as Kind;
  if (!KINDS.includes(kind)) return { error: 'Onbekende agenda.' };
  const groupId = kind === 'location' ? String(formData.get('groupId') ?? '') : null;
  if (kind === 'location') {
    const group = await viewer.supabase.from('groups').select('has_counter').eq('id', groupId ?? '').maybeSingle();
    if (!group.data?.has_counter) return { error: 'Onbekende vestiging.' };
  }

  const now = new Date().toISOString();
  let revoke = viewer.supabase
    .from('calendar_feeds')
    .update({ revoked_at: now })
    .eq('employee_id', viewer.employeeId)
    .eq('kind', kind)
    .is('revoked_at', null);
  revoke = groupId ? revoke.eq('group_id', groupId) : revoke.is('group_id', null);
  const revoked = await revoke;
  if (revoked.error) return { error: 'De oude link kon niet worden ingetrokken. Probeer het opnieuw.' };

  const { token, hash } = createFeedToken();
  const inserted = await viewer.supabase
    .from('calendar_feeds')
    .insert({ employee_id: viewer.employeeId, kind, group_id: groupId, token_hash: hash });
  if (inserted.error) return { error: 'De link kon niet worden gemaakt. Probeer het opnieuw.' };

  revalidatePath('/agenda');
  return feedUrls(await siteBaseUrl(), token);
}

/** Trekt een link in. Eigenaar of beheerder; RLS controleert dat ook. */
export async function revokeFeedLink(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await viewer.supabase
    .from('calendar_feeds')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('revoked_at', null);
  revalidatePath('/agenda');
  revalidatePath('/beheer/medewerkers', 'layout');
}
