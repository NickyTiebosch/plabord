/**
 * "Nog te regelen" en "Let op" (fase 2): de gaten in de komende weken met voorstellen, en de
 * invallen die aandacht nodig hebben. Puur en los te testen; de pagina's tonen alleen wat hier staat.
 */
import { evaluateCandidates, PROPOSAL_COUNT, type Candidate, type Exclusion } from '../engine/candidates';
import { addDays, dayOfMonth, isoWeekKey, isoWeekOf, maxDate, minDate, startOfIsoWeek, weekdayOf } from '../engine/dates';
import { formatDateRange, formatDayShort, weekdayShort } from '../engine/format';
import { findGaps, type Gap } from '../engine/gaps';
import { DAY_PART_LABELS } from '../engine/labels';
import type { AbsenceImpact } from '../engine/impact';
import type { ReviewChange } from '../engine/review';
import { createScheduleContext, type ScheduleContext } from '../engine/schedule';
import { createNormLookup, staffingOf, type NormLookup } from '../engine/staffing';
import type { DayPart, GapDismissal, IsoDate, PlanningSnapshot, Substitution } from '../engine/types';
import { groupSlug } from '../views/tabs';

/** De periode van "Nog te regelen": vanaf vandaag zoveel weken vooruit als ingesteld. */
export function planningWindow(today: IsoDate, lookaheadWeeks: number): { from: IsoDate; to: IsoDate } {
  return { from: today, to: addDays(today, Math.max(1, lookaheadWeeks) * 7 - 1) };
}

/** "ochtend", "middag" of "ochtend en middag". */
export function dayPartsLabel(parts: readonly DayPart[]): string {
  return parts.map((part) => DAY_PART_LABELS[part]).join(' en ');
}

export interface GapView {
  key: string;
  date: IsoDate;
  dateLabel: string;
  groupId: string;
  groupName: string;
  /** Per dagdeel met een tekort, bijvoorbeeld "ochtend 1/2". */
  parts: { dayPart: DayPart; label: string; shortage: number }[];
  dayParts: DayPart[];
  /** De eerste drie kandidaten voor alle dagdelen met een tekort. */
  proposals: Candidate[];
  candidateCount: number;
  /** De pagina met alle keuzes voor dit gat. */
  href: string;
}

function gapView(context: ScheduleContext, normOf: NormLookup, substitutions: readonly Substitution[], gap: Gap): GapView {
  const dayParts = gap.parts.map((part) => part.dayPart);
  const candidates = evaluateCandidates(context, normOf, substitutions, { date: gap.date, groupId: gap.groupId, dayParts }).candidates;
  return {
    key: `${gap.groupId}|${gap.date}`,
    date: gap.date,
    dateLabel: formatDayShort(gap.date),
    groupId: gap.groupId,
    groupName: context.groupsById.get(gap.groupId)?.name ?? gap.groupId,
    parts: gap.parts.map((part) => ({
      dayPart: part.dayPart,
      label: `${DAY_PART_LABELS[part.dayPart]} ${part.count}/${part.norm}`,
      shortage: part.shortage,
    })),
    dayParts,
    proposals: candidates.slice(0, PROPOSAL_COUNT),
    candidateCount: candidates.length,
    href: `/beheer/regelen/${groupSlug(gap.groupId)}/${gap.date}`,
  };
}

/** Alle gaten in de periode, met voorstellen; en de genegeerde apart. */
export function buildGapViews(
  snapshot: PlanningSnapshot,
  window: { from: IsoDate; to: IsoDate },
  dismissals: readonly GapDismissal[],
): { gaps: GapView[]; ignored: GapView[] } {
  const context = createScheduleContext(snapshot);
  const normOf = createNormLookup(snapshot.staffingNorms);
  const scan = findGaps(context, normOf, window.from, window.to, dismissals);
  return {
    gaps: scan.gaps.map((gap) => gapView(context, normOf, snapshot.substitutions, gap)),
    ignored: scan.ignored.map((gap) => gapView(context, normOf, snapshot.substitutions, gap)),
  };
}

/** Eén week in het overzicht van Nog te regelen (V34). */
export interface GapWeek<T> {
  /** De weeksleutel, zoals '2026-W42'. Het anker op de pagina is `week-2026-W42`. */
  key: string;
  week: number;
  /** Het deel van de week dat in de periode valt. */
  from: IsoDate;
  to: IsoDate;
  /** '12–18 okt' */
  rangeLabel: string;
  /** De dagen met een gat, kort: 'di 13', 'do 15'. */
  dayLabels: string[];
  gaps: T[];
}

/**
 * De gaten per week (V34): elke ISO-week in de periode, ook als er niets te regelen is, op volgorde.
 * Binnen een week blijven de gaten in de volgorde waarin ze binnenkomen.
 */
export function gapWeeks<T extends { date: IsoDate }>(gaps: readonly T[], window: { from: IsoDate; to: IsoDate }): GapWeek<T>[] {
  const weeks: GapWeek<T>[] = [];
  for (let monday = startOfIsoWeek(window.from); monday <= window.to; monday = addDays(monday, 7)) {
    const from = maxDate(monday, window.from);
    const to = minDate(addDays(monday, 6), window.to);
    const inWeek = gaps.filter((gap) => gap.date >= from && gap.date <= to);
    const dates = [...new Set(inWeek.map((gap) => gap.date))].sort();
    weeks.push({
      key: isoWeekKey(monday),
      week: isoWeekOf(monday).week,
      from,
      to,
      rangeLabel: formatDateRange(from, to),
      dayLabels: dates.map((date) => `${weekdayShort(weekdayOf(date))} ${dayOfMonth(date)}`),
      gaps: inWeek,
    });
  }
  return weeks;
}

export interface GapOption {
  dayParts: DayPart[];
  label: string;
  candidates: Candidate[];
  excluded: Exclusion[];
}

export interface GapDetail {
  date: IsoDate;
  dateLabel: string;
  groupId: string;
  groupName: string;
  closed: boolean;
  /** Beide dagdelen, ook als er geen tekort is. */
  staffing: { dayPart: DayPart; label: string; short: boolean }[];
  /** De dagdelen met een tekort. */
  shortParts: DayPart[];
  /** Is (een deel van) dit gat genegeerd? */
  ignored: boolean;
  /** Keuzes: eerst het hele gat, dan per dagdeel. */
  options: GapOption[];
}

/** Alles voor de pagina van één gat: bezetting, keuzes per dagdeel en wie waarom afvalt. */
export function buildGapDetail(
  snapshot: PlanningSnapshot,
  date: IsoDate,
  groupId: string,
  dismissals: readonly GapDismissal[],
): GapDetail | null {
  const context = createScheduleContext(snapshot);
  const group = context.groupsById.get(groupId);
  if (!group?.hasCounter) return null;
  const normOf = createNormLookup(snapshot.staffingNorms);
  const entries = context.entriesOn(date);
  const staffing = staffingOf(context, normOf, date, groupId, entries);
  const shortParts = staffing.parts.filter((part) => part.shortage > 0).map((part) => part.dayPart);
  const choices: DayPart[][] = shortParts.length > 1 ? [shortParts, ...shortParts.map((part) => [part])] : shortParts.length === 1 ? [shortParts] : [];
  return {
    date,
    dateLabel: formatDayShort(date),
    groupId,
    groupName: group.name,
    closed: staffing.closed,
    staffing: staffing.parts.map((part) => ({
      dayPart: part.dayPart,
      label: `${DAY_PART_LABELS[part.dayPart]} ${part.count}/${part.norm}`,
      short: part.shortage > 0,
    })),
    shortParts,
    ignored: dismissals.some(
      (item) =>
        item.groupId === groupId &&
        item.date === date &&
        staffing.parts.some((part) => part.dayPart === item.dayPart && part.shortage > 0 && part.shortage <= item.shortage),
    ),
    options: choices.map((dayParts) => {
      const result = evaluateCandidates(context, normOf, snapshot.substitutions, { date, groupId, dayParts }, entries);
      return { dayParts, label: dayPartsLabel(dayParts), candidates: result.candidates, excluded: result.excluded };
    }),
  };
}

export interface AttentionItem {
  substitutionId: string;
  status: 'not_needed' | 'reschedule';
  date: IsoDate;
  text: string;
}

/**
 * Hoe het staat met de mail aan de invaller over een vervallen inval (fase 3). Is hij verstuurd,
 * dan is de inval vanzelf afgehandeld (V19) en staat hij hier niet meer.
 */
export type AttentionMailState = 'pending' | 'failed' | 'off' | 'no-address';

const ATTENTION_MAIL_NOTES: Record<AttentionMailState, string> = {
  pending: 'De mail aan de invaller wordt nog verstuurd.',
  failed: 'De mail aan de invaller is niet gelukt; laat het hem zelf weten.',
  off: 'Mails staan uit; laat het de invaller weten.',
  'no-address': 'De invaller heeft geen werkmail; laat het hem zelf weten.',
};

/** Vervallen invallen die de beheerder nog moet afhandelen (besluit V10). */
export function attentionItems(
  substitutions: readonly Substitution[],
  names: ReadonlyMap<string, string>,
  groupNames: ReadonlyMap<string, string>,
  mailState: (employeeId: string, date: IsoDate) => AttentionMailState | null = () => null,
): AttentionItem[] {
  return substitutions
    .filter((sub): sub is Substitution & { status: 'not_needed' | 'reschedule' } => sub.status !== 'active' && !sub.handledAt)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1))
    .map((sub) => {
      const name = names.get(sub.employeeId) ?? 'Een collega';
      const where = `${groupNames.get(sub.groupId) ?? sub.groupId}, ${formatDayShort(sub.date)}, ${dayPartsLabel(sub.dayParts)}`;
      const state = mailState(sub.employeeId, sub.date);
      const note = state ? ` ${ATTENTION_MAIL_NOTES[state]}` : sub.status === 'not_needed' ? ' Laat het de invaller weten.' : '';
      return {
        substitutionId: sub.id,
        status: sub.status,
        date: sub.date,
        text:
          sub.status === 'not_needed'
            ? `Niet meer nodig: ${name} (${where}).${note}`
            : `Opnieuw regelen: ${name} kan niet invallen (${where}). Het gat staat weer bij Nog te regelen.${note}`,
      };
    });
}

/** Invallen die niet meer kloppen, bijvoorbeeld na een nieuwe vaste dienst of sluitingsdag. */
export function warningTexts(
  changes: readonly ReviewChange[],
  names: ReadonlyMap<string, string>,
  groupNames: ReadonlyMap<string, string>,
): string[] {
  return changes.map((change) => {
    const name = names.get(change.employeeId) ?? 'Een collega';
    const where = `${groupNames.get(change.groupId) ?? change.groupId}, ${formatDayShort(change.date)}`;
    const outcome = change.status === 'not_needed' ? 'niet meer nodig' : 'opnieuw regelen';
    return `De inval van ${name} (${where}) klopt niet meer: ${change.reason}. Wordt: ${outcome}.`;
  });
}

/** Hooguit zoveel regels in de impactcheck; de rest staat als "en nog …". */
export const IMPACT_MAX_LINES = 8;

/** De impactcheck in gewone zinnen: per vestiging per dag de dagdelen onder de norm, en vervallen invallen. */
export function impactLines(
  impact: AbsenceImpact,
  names: ReadonlyMap<string, string>,
  groupNames: ReadonlyMap<string, string>,
): string[] {
  const byDay = new Map<string, AbsenceImpact['parts']>();
  for (const part of impact.parts) {
    const key = `${part.date}|${part.groupId}`;
    byDay.set(key, [...(byDay.get(key) ?? []), part]);
  }
  const lines: string[] = [];
  for (const parts of byDay.values()) {
    const first = parts[0];
    if (!first) continue;
    const counts = parts.map((part) => `${DAY_PART_LABELS[part.dayPart]} ${part.after}/${part.norm}`).join(', ');
    const proposals = [...new Set(parts.map((part) => part.proposal))];
    const proposal =
      proposals.length === 1 && proposals[0] ? `voorstel: ${proposals[0]}` : proposals.every((item) => !item) ? 'geen voorstel' : `voorstel: ${proposals.filter(Boolean).join(' of ')}`;
    lines.push(`${groupNames.get(first.groupId) ?? first.groupId}, ${formatDayShort(first.date)}: ${counts} · ${proposal}.`);
  }
  for (const change of impact.changes) {
    const name = names.get(change.employeeId) ?? 'een collega';
    const where = `${groupNames.get(change.groupId) ?? change.groupId} op ${formatDayShort(change.date)}`;
    lines.push(
      change.status === 'reschedule'
        ? `De inval van ${name} in ${where} moet opnieuw geregeld worden (${change.reason}).`
        : `De inval van ${name} in ${where} is dan niet meer nodig.`,
    );
  }
  if (lines.length <= IMPACT_MAX_LINES) return lines;
  return [...lines.slice(0, IMPACT_MAX_LINES), `En nog ${lines.length - IMPACT_MAX_LINES} gevolg(en).`];
}

/** Een veilige terugweg binnen de app, voor een redirect na een actie. Anders de standaard. */
export function safeReturnPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  return /^\/(beheer|rooster)(\/[A-Za-z0-9_\-/]*)?(\?[A-Za-z0-9_=&\-%]*)?$/.test(value) && !value.includes('//') ? value : fallback;
}

/**
 * Zet `?melding=…` op een pad (vervangt een bestaande melding), en met fase 3 ook `?mail=…`:
 * hoe het met de mails ging. Zonder mail verdwijnt een oude `mail` van het pad.
 */
export function withNotice(path: string, code: string, mail?: string | null): string {
  const [base = path, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set('melding', code);
  if (mail) params.set('mail', mail);
  else params.delete('mail');
  return `${base}?${params.toString()}`;
}

/** "1 inval is niet meer nodig; 1 moet opnieuw geregeld worden." of een lege tekst. */
export function reviewSummary(changes: readonly ReviewChange[]): string {
  const notNeeded = changes.filter((change) => change.status === 'not_needed').length;
  const reschedule = changes.length - notNeeded;
  const parts = [
    notNeeded > 0 ? `${notNeeded} ${notNeeded === 1 ? 'inval is' : 'invallen zijn'} niet meer nodig` : null,
    reschedule > 0 ? `${reschedule} ${reschedule === 1 ? 'inval moet' : 'invallen moeten'} opnieuw geregeld worden` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `${parts.join('; ')}. Zie "Let op" op het overzicht.` : '';
}

export interface SubstitutionItem {
  id: string;
  date: IsoDate;
  title: string;
  detail: string;
  status: Substitution['status'];
  statusLabel: string;
  /** Kan nog worden ingetrokken: gaat door en is niet voorbij. */
  canWithdraw: boolean;
  /** Vervallen en nog niet afgehandeld. */
  needsHandling: boolean;
}

const STATUS_LABELS: Record<Substitution['status'], string> = {
  active: 'gaat door',
  not_needed: 'niet meer nodig',
  reschedule: 'opnieuw regelen',
};

/** De invallen als lijst, op datum (nieuwste dag eerst bij gelijke datum op naam). */
export function substitutionItems(
  substitutions: readonly Substitution[],
  names: ReadonlyMap<string, string>,
  groupNames: ReadonlyMap<string, string>,
  today: IsoDate,
): SubstitutionItem[] {
  return [...substitutions]
    .map((sub) => ({ sub, name: names.get(sub.employeeId) ?? 'Onbekend' }))
    .sort((a, b) => (a.sub.date < b.sub.date ? -1 : a.sub.date > b.sub.date ? 1 : a.name.localeCompare(b.name, 'nl') || (a.sub.id < b.sub.id ? -1 : 1)))
    .map(({ sub, name }) => ({
      id: sub.id,
      date: sub.date,
      title: `${name} → ${groupNames.get(sub.groupId) ?? sub.groupId}`,
      detail: `${formatDayShort(sub.date)} · ${dayPartsLabel(sub.dayParts)}`,
      status: sub.status,
      statusLabel: STATUS_LABELS[sub.status],
      canWithdraw: sub.status === 'active' && sub.date >= today,
      needsHandling: sub.status !== 'active' && !sub.handledAt,
    }));
}
