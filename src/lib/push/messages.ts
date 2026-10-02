/**
 * De tekst van elke pushmelding (fase 4, besluit V26). Kort, met datum en plaats, en alleen over
 * het eigen rooster: geen namen van collega's en geen reden van afwezigheid. Een melding is ook
 * zichtbaar op het vergrendelscherm. Puur: de tekst ontstaat bij het versturen, met het rooster
 * van dat moment, en spreekt zichzelf nooit tegen (dezelfde regel als bij de mails).
 */
import { entryState, type PersonalDay, type ShiftEntry } from '../engine/schedule';
import { formatTimeRange } from '../engine/time';
import type { Group } from '../engine/types';
import { effectiveKind, formatDateList } from '../mail/messages';
import type { MailKind } from '../mail/types';

export interface PushContent {
  title: string;
  body: string;
  /** Wat een tik op de melding opent: Mijn rooster. */
  url: string;
  /** Een nieuwere melding over hetzelfde vervangt de oude op het toestel. */
  tag: string;
}

export interface ComposePushInput {
  kind: MailKind;
  /** De dagen waar de melding over gaat, met het rooster van nu. Leeg bij een testmelding. */
  days: readonly PersonalDay[];
  groups: readonly Group[];
}

const MAX_BODY = 180;

function shiftTimes(entry: ShiftEntry): string {
  return entry.working ? formatTimeRange(entry.working.start, entry.working.end) : formatTimeRange(entry.start, entry.end);
}

/**
 * Hoe één dag eruitziet, kort en op volgorde van de tijd: "Eindhoven 07:30–18:00",
 * "Backoffice 07:30–13:00, invallen in Breda 13:00–18:00" of "geen dienst".
 */
export function daySummary(day: PersonalDay, groupName: (id: string) => string): string {
  const parts = day.entries.flatMap((entry) => {
    const place = groupName(entry.groupId);
    const state = entryState(entry);
    const start = entry.working?.start ?? entry.start;
    if (entry.kind === 'substitution') return entry.working ? [{ start, text: `invallen in ${place} ${shiftTimes(entry)}` }] : [];
    if (state === 'closed') return [{ start, text: `${place} gesloten` }];
    if (state === 'working' || state === 'partly_absent') return [{ start, text: `${place} ${shiftTimes(entry)}` }];
    return [];
  });
  if (parts.length > 0) {
    return parts
      .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
      .map((part) => part.text)
      .join(', ');
  }
  return day.absences.length > 0 ? 'afwezig' : 'geen dienst';
}

function shorten(text: string): string {
  return text.length <= MAX_BODY ? text : `${text.slice(0, MAX_BODY - 1).trimEnd()}…`;
}

export function composePush(input: ComposePushInput): PushContent {
  const names = new Map(input.groups.map((group) => [group.id, group.name]));
  const groupName = (id: string) => names.get(id) ?? id;
  const dates = input.days.map((day) => day.date);
  const list = formatDateList(dates);
  const kind = effectiveKind(input.kind, input.days);
  const [only] = input.days.length === 1 ? input.days : [];
  const tag = `${kind}-${dates.join(',') || 'test'}`;

  const body = (() => {
    switch (kind) {
      case 'substitution_assigned': {
        const substitution = only?.entries.find((entry) => entry.kind === 'substitution' && entry.working);
        return substitution
          ? `Je valt in op ${list} in ${groupName(substitution.groupId)} (${shiftTimes(substitution)})`
          : `Je valt in op ${list}`;
      }
      case 'substitution_cancelled':
        return dates.length > 1 ? `Je invallen op ${list} gaan niet door` : `Je inval op ${list} gaat niet door`;
      case 'day_changed':
        return only
          ? `Je rooster voor ${list} is gewijzigd: ${daySummary(only, groupName)}`
          : `Je rooster voor ${list} is gewijzigd`;
      case 'reminder':
        return only ? `Morgen wijkt je rooster af: ${daySummary(only, groupName)}` : 'Morgen wijkt je rooster af';
      case 'test':
        return 'Testmelding: meldingen op dit toestel werken.';
    }
  })();

  return { title: 'Planbord', body: shorten(body), url: '/', tag };
}
