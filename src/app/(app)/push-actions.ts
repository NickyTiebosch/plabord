'use server';

import { requireViewer } from '@/lib/auth/session';
import { isKnownPushEndpoint, isSubscriptionKeys } from '@/lib/push/endpoints';

/**
 * Meldingen op dit toestel aan- of uitzetten (fase 4, V25). Alleen voor jezelf: de database koppelt
 * het toestel aan de ingelogde medewerker (register_push_subscription) en RLS laat je alleen je
 * eigen toestellen verwijderen. Geen logboek: het is een instelling van je toestel (zie het plan).
 */

export type PushDeviceResult = { ok: true } | { ok: false; error: string };

interface DeviceInput {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown } | null;
}

const NOT_SAVED = 'Meldingen konden niet worden aangezet. Probeer het opnieuw.';

export async function registerPushDevice(input: DeviceInput): Promise<PushDeviceResult> {
  const { supabase } = await requireViewer();
  const endpoint = typeof input?.endpoint === 'string' ? input.endpoint : '';
  const p256dh = typeof input?.keys?.p256dh === 'string' ? input.keys.p256dh : '';
  const auth = typeof input?.keys?.auth === 'string' ? input.keys.auth : '';
  if (!isKnownPushEndpoint(endpoint) || !isSubscriptionKeys(p256dh, auth)) {
    return { ok: false, error: 'Deze browser gebruikt een pushdienst die Planbord niet kent.' };
  }
  const saved = await supabase.rpc('register_push_subscription', { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth });
  return saved.error ? { ok: false, error: NOT_SAVED } : { ok: true };
}

export async function unregisterPushDevice(endpoint: unknown): Promise<PushDeviceResult> {
  const { supabase, employeeId } = await requireViewer();
  if (typeof endpoint !== 'string' || !isKnownPushEndpoint(endpoint)) return { ok: true };
  const deleted = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('employee_id', employeeId);
  return deleted.error ? { ok: false, error: 'Meldingen konden niet worden uitgezet. Probeer het opnieuw.' } : { ok: true };
}
