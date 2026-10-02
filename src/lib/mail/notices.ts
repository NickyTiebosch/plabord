/**
 * Welke mails een actie oplevert (besluit V14). Puur: de server action geeft door wat er
 * veranderde, en krijgt per persoon hooguit één mail terug.
 */
import type { IsoDate } from '../engine/types';
import type { MailNotice, NoticeKind } from './types';

/**
 * Voegt mails per persoon samen: één mail per persoon per actie, met de dagen op volgorde.
 * Gaat het om verschillende soorten, dan wordt het "rooster gewijzigd". Dagen vóór vandaag
 * vallen weg (geen mail over het verleden), en een mail zonder dagen ook.
 */
export function mergeNotices(notices: readonly MailNotice[], today: IsoDate): MailNotice[] {
  const byEmployee = new Map<string, { kinds: Set<NoticeKind>; dates: Set<IsoDate> }>();
  for (const notice of notices) {
    const dates = notice.dates.filter((date) => date >= today);
    if (dates.length === 0) continue;
    const bucket = byEmployee.get(notice.employeeId) ?? { kinds: new Set<NoticeKind>(), dates: new Set<IsoDate>() };
    bucket.kinds.add(notice.kind);
    for (const date of dates) bucket.dates.add(date);
    byEmployee.set(notice.employeeId, bucket);
  }
  return [...byEmployee.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([employeeId, { kinds, dates }]) => {
      const [only] = kinds;
      return {
        employeeId,
        kind: kinds.size === 1 && only ? only : 'day_changed',
        dates: [...dates].sort(),
      };
    });
}

/**
 * Invallen die niet meer doorgaan: een mail aan de invaller, behalve als die die dag zelf
 * afwezig is (V14).
 */
export function cancelledSubstitutionNotices(
  cancelled: readonly { employeeId: string; date: IsoDate }[],
  isAbsent: (employeeId: string, date: IsoDate) => boolean,
): MailNotice[] {
  return cancelled
    .filter((item) => !isAbsent(item.employeeId, item.date))
    .map((item) => ({ employeeId: item.employeeId, kind: 'substitution_cancelled' as const, dates: [item.date] }));
}
