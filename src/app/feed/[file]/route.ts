import { createAdminClient } from '@/lib/db/admin';
import { loadPlanningSnapshot } from '@/lib/db/queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { buildFeed, feedRange, type FeedKind } from '@/lib/ics/feeds';
import { hashFeedToken, tokenFromFileName } from '@/lib/feeds/token';

export const dynamic = 'force-dynamic';

function notFound() {
  return new Response('Niet gevonden', {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

/**
 * De agendafeed. Geen inloggen: het geheime token in de URL geeft toegang. We slaan alleen de
 * hash op, zoeken daarop en serveren met de secret key (RLS kan hier niet, er is geen sessie).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const token = tokenFromFileName(file);
  if (!token) return notFound();

  const admin = createAdminClient();
  const feed = await admin
    .from('calendar_feeds')
    .select('employee_id, kind, group_id')
    .eq('token_hash', hashFeedToken(token))
    .is('revoked_at', null)
    .maybeSingle();
  if (feed.error || !feed.data) return notFound();

  const owner = await admin.from('employees').select('is_active').eq('id', feed.data.employee_id).maybeSingle();
  if (!owner.data?.is_active) return notFound();

  const today = todayInAmsterdam(new Date());
  const snapshot = await loadPlanningSnapshot(admin, feedRange(today));
  const ics = buildFeed(
    snapshot,
    { kind: feed.data.kind as FeedKind, employeeId: feed.data.employee_id, groupId: feed.data.group_id },
    today,
  );

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="planbord.ics"',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
