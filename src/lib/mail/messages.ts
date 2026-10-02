/**
 * De tekst van elke mail (fase 3). Puur: de app maakt de tekst pas bij het versturen, met het
 * rooster van dat moment. Alleen het eigen rooster van de ontvanger: geen namen van collega's,
 * geen reden van afwezigheid en geen e-mailadressen. Geen plaatjes of trackers.
 */
import { formatDayShort } from '../engine/format';
import { computePersonalSchedule, type PersonalDay } from '../engine/schedule';
import type { Group, IsoDate, PlanningSnapshot } from '../engine/types';
import { buildMySchedule, type MyScheduleDay } from '../views/my-schedule';
import type { MailContent, MailKind } from './types';

export interface ComposeInput {
  kind: MailKind;
  /** Naam van de ontvanger. De mail gebruikt alleen de voornaam. */
  name: string;
  /** De dagen waar de mail over gaat, met het rooster van nu. Leeg bij een testmail. */
  days: readonly PersonalDay[];
  groups: readonly Group[];
  /** Link naar Mijn rooster, of `null` als het adres van de app niet bekend is. */
  appUrl: string | null;
}

/** "wo 14 okt", "ma 12 okt en wo 14 okt" of "ma 12 okt, di 13 okt en wo 14 okt". */
export function formatDateList(dates: readonly IsoDate[]): string {
  const labels = dates.map((date) => formatDayShort(date));
  const last = labels.pop();
  if (last === undefined) return '';
  return labels.length === 0 ? last : `${labels.join(', ')} en ${last}`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Het rooster van één persoon op een paar losse dagen, op volgorde. */
export function personalDaysFor(snapshot: PlanningSnapshot, employeeId: string, dates: readonly IsoDate[]): PersonalDay[] {
  return [...new Set(dates)].sort().flatMap((date) => computePersonalSchedule(snapshot, employeeId, date, date));
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * Klopt de soort nog met het rooster van nu? Een mail "je valt in" zonder inval, of "je inval gaat
 * niet door" terwijl er wel een inval staat (bijvoorbeeld als iets intussen weer is veranderd),
 * wordt een algemene mail "je rooster is gewijzigd". Zo spreekt een mail zichzelf nooit tegen.
 */
export function effectiveKind(kind: MailKind, days: readonly PersonalDay[]): MailKind {
  const hasSubstitution = days.some((day) => day.entries.some((entry) => entry.kind === 'substitution'));
  if (kind === 'substitution_assigned' && !hasSubstitution) return 'day_changed';
  if (kind === 'substitution_cancelled' && hasSubstitution) return 'day_changed';
  return kind;
}

function headings(kind: MailKind, dates: readonly IsoDate[]): { subject: string; headline: string } {
  const list = formatDateList(dates);
  switch (kind) {
    case 'substitution_assigned':
      return { subject: `Planbord: je valt in op ${list}`, headline: `Je valt in op ${list}.` };
    case 'substitution_cancelled':
      return dates.length > 1
        ? { subject: `Planbord: je invallen op ${list} gaan niet door`, headline: `Je invallen op ${list} gaan niet door.` }
        : { subject: `Planbord: je inval op ${list} gaat niet door`, headline: `Je inval op ${list} gaat niet door.` };
    case 'day_changed':
      return { subject: `Planbord: je rooster voor ${list} is gewijzigd`, headline: `Je rooster voor ${list} is gewijzigd.` };
    case 'reminder':
      return {
        subject: `Planbord: morgen (${list}) wijkt je rooster af`,
        headline: `Morgen, ${list}, wijkt je rooster af van je vaste rooster.`,
      };
    case 'test':
      return {
        subject: 'Planbord: testmail',
        headline: 'Dit is een testmail van Planbord. Komt hij aan, dan werkt het versturen van mails.',
      };
  }
}

/** De regels van één dag, zoals in Mijn rooster: "Invallen in Eindhoven · balie · 13:00–18:00". */
function dayLines(day: MyScheduleDay): string[] {
  const lines = day.lines.map((line) => `${line.title}${line.detail ? ` · ${line.detail}` : ''}${line.note ? ` (${line.note})` : ''}`);
  if (day.absence) lines.push(day.absence.label);
  return lines.length > 0 ? lines : ['Geen dienst'];
}

const FOOTER = 'Deze mail komt van Planbord, de planning van het verhuurteam.';

export function composeMail(input: ComposeInput): MailContent {
  const dates = input.days.map((day) => day.date);
  const kind = effectiveKind(input.kind, input.days);
  const { subject, headline } = headings(kind, dates);
  const greeting = `Hoi ${firstName(input.name)},`;
  const scheduleDays = buildMySchedule(input.days, input.groups, '').flatMap((week) => week.days);

  const text = [
    greeting,
    '',
    headline,
    ...(scheduleDays.length > 0
      ? ['', 'Zo ziet je rooster er nu uit:', ...scheduleDays.flatMap((day) => ['', day.label, ...dayLines(day).map((line) => `- ${line}`)])]
      : []),
    ...(input.appUrl ? ['', `Bekijk je rooster in Planbord: ${input.appUrl}`] : []),
    '',
    FOOTER,
    '',
  ].join('\n');

  const paragraph = (content: string) => `<p style="margin:0 0 12px">${content}</p>`;
  const html = [
    '<!doctype html><html lang="nl"><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#0f172a">',
    paragraph(escapeHtml(greeting)),
    paragraph(escapeHtml(headline)),
    ...(scheduleDays.length > 0
      ? [
          paragraph('Zo ziet je rooster er nu uit:'),
          ...scheduleDays.map(
            (day) =>
              `<p style="margin:0"><strong>${escapeHtml(day.label)}</strong></p><ul style="margin:0 0 12px;padding-left:20px">${dayLines(day)
                .map((line) => `<li>${escapeHtml(line)}</li>`)
                .join('')}</ul>`,
          ),
        ]
      : []),
    ...(input.appUrl
      ? [paragraph(`<a href="${escapeHtml(input.appUrl)}">Bekijk je rooster in Planbord</a>`)]
      : []),
    `<p style="margin:16px 0 0;font-size:13px;color:#64748b">${escapeHtml(FOOTER)}</p>`,
    '</body></html>',
  ].join('');

  return { subject, text, html };
}
