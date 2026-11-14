/**
 * Binnenvallers en meldingen als Excel (fase 6, V64): de gratis versie, in de opbouw van de oude
 * bestanden. Per vestiging een tabblad. Puur: van gegevens naar rijen; het bestand maakt
 * `buildTitledWorkbook`.
 */
import { isoWeekOf, weekdayOf } from '../engine/dates';
import { weekdayShort } from '../engine/format';
import type { IsoDate } from '../engine/types';
import { formatPlate } from '../loans/plates';
import { localMoment } from '../loans/time';
import { incidentDate } from '../registrations/status';
import {
  INCIDENT_KIND_LABELS,
  MISSING_LABELS,
  type CounterGroup,
  type Incident,
  type WalkIn,
  type Workshop,
} from '../registrations/types';
import type { LoanCell } from './loans';

export interface TitledSheet {
  sheet: string;
  title: string;
  header: string[];
  rows: LoanCell[][];
  widths: number[];
}

const text = (value: string | null): LoanCell => ({ value: value || null, kind: 'text' });
const num = (value: number | null, strong = false): LoanCell => ({ value: value, kind: 'number', ...(strong ? { strong } : {}) });
const date = (value: IsoDate | null): LoanCell => ({ value, kind: 'date' });

/** "12-11-2026 13:05" */
function stamp(now: Date): string {
  const moment = localMoment(now.toISOString());
  return `${moment.date.split('-').reverse().join('-')} ${moment.time}`;
}

/**
 * Binnenvallers: per vestiging een tabblad met per dag een regel en per werkplaats een kolom, zoals
 * Binnenvallers Registratie. Alleen dagen waarop iets is ingevuld; een werkplaats die op inactief
 * staat, alleen als er cijfers zijn.
 */
export function walkInsExport(
  walkIns: readonly WalkIn[],
  context: { groups: readonly CounterGroup[]; workshops: readonly Workshop[]; now: Date },
): TitledSheet[] {
  return context.groups.map((group) => {
    const own = walkIns.filter((walkIn) => walkIn.groupId === group.id);
    const used = new Set(own.map((walkIn) => walkIn.workshopId));
    const columns = context.workshops
      .filter((workshop) => workshop.groupId === group.id && (workshop.isActive || used.has(workshop.id)))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'nl'));
    const dates = [...new Set(own.map((walkIn) => walkIn.date))].sort();
    const count = (workshopId: string, day: IsoDate) => own.find((walkIn) => walkIn.workshopId === workshopId && walkIn.date === day)?.count ?? null;
    const rows = dates.map((day) => {
      const counts = columns.map((workshop) => count(workshop.id, day));
      return [
        date(day),
        text(weekdayShort(weekdayOf(day))),
        num(isoWeekOf(day).week),
        ...counts.map((value) => num(value)),
        num(counts.reduce<number>((sum, value) => sum + (value ?? 0), 0), true),
      ];
    });
    const totals = columns.map((workshop) => own.filter((walkIn) => walkIn.workshopId === workshop.id).reduce((sum, walkIn) => sum + walkIn.count, 0));
    rows.push([
      text(null),
      { value: 'Totaal', kind: 'text', strong: true },
      text(null),
      ...totals.map((value) => num(value, true)),
      num(totals.reduce((sum, value) => sum + value, 0), true),
    ]);
    return {
      sheet: group.name.slice(0, 31),
      title: `Binnenvallers · ${group.name} · stand ${stamp(context.now)}`,
      header: ['Datum', 'Dag', 'Wk', ...columns.map((workshop) => workshop.name), 'Totaal'],
      rows,
      widths: [12, 6, 5, ...columns.map((workshop) => Math.max(10, workshop.name.length + 2)), 9],
    };
  });
}

export const INCIDENT_EXPORT_HEADER = [
  'Datum',
  'Dag',
  'Wk',
  'Werkplaats',
  'Soort melding',
  'Wat ontbrak?',
  'Tijdstip annulering',
  'Doorbelasten',
  'Kenteken',
  'Contract-/reserveringsnr',
  'Bijzonderheden',
  'Ingevuld door',
  'Doorbelast op',
  'Doorbelast door',
];
const INCIDENT_WIDTHS = [12, 6, 5, 18, 30, 16, 12, 12, 12, 16, 40, 16, 13, 16];

interface IncidentLookups {
  groups: readonly CounterGroup[];
  workshops: readonly Workshop[];
  personName: (id: string | null) => string;
  now: Date;
}

function incidentRow(incident: Incident, lookups: IncidentLookups, withGroup = false): LoanCell[] {
  const day = incidentDate(incident);
  const workshop = lookups.workshops.find((candidate) => candidate.id === incident.workshopId)?.name ?? '';
  const row = [
    date(day),
    text(weekdayShort(weekdayOf(day))),
    num(isoWeekOf(day).week),
    text(workshop),
    text(INCIDENT_KIND_LABELS[incident.kind]),
    text(incident.missing ? MISSING_LABELS[incident.missing] : null),
    text(incident.cancelledAt),
    incident.charge === null
      ? text(null)
      : { value: incident.charge ? 'Ja' : 'Nee', kind: 'text' as const, tone: incident.charge ? ('unused' as const) : undefined },
    text(incident.plate ? formatPlate(incident.plate) : null),
    text(incident.contractNumber),
    text(incident.note),
    text(incident.reportedBy ? lookups.personName(incident.reportedBy) : null),
    date(incident.chargedAt ? localMoment(incident.chargedAt).date : null),
    text(incident.chargedAt ? lookups.personName(incident.chargedBy) : null),
  ];
  if (withGroup) row.splice(3, 0, text(lookups.groups.find((group) => group.id === incident.groupId)?.name ?? incident.groupId));
  return row;
}

const byMoment = (a: Incident, b: Incident) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : a.id < b.id ? -1 : 1);

/**
 * Meldingen: per vestiging een tabblad, zoals WPL meldingen dagregistratie, met erachter wanneer en
 * door wie het is doorbelast. Een laatste tabblad Doorbelasten met alle annuleringen die doorbelast
 * moeten worden, de open bovenaan.
 */
export function incidentsExport(incidents: readonly Incident[], lookups: IncidentLookups): TitledSheet[] {
  const sorted = [...incidents].sort(byMoment);
  const perGroup = lookups.groups.map((group) => ({
    sheet: group.name.slice(0, 31),
    title: `Werkplaatsmeldingen · ${group.name} · stand ${stamp(lookups.now)}`,
    header: INCIDENT_EXPORT_HEADER,
    rows: sorted.filter((incident) => incident.groupId === group.id).map((incident) => incidentRow(incident, lookups)),
    widths: INCIDENT_WIDTHS,
  }));
  const chargeable = sorted
    .filter((incident) => incident.charge)
    .sort((a, b) => Number(Boolean(a.chargedAt)) - Number(Boolean(b.chargedAt)) || byMoment(a, b));
  const chargeHeader = [...INCIDENT_EXPORT_HEADER];
  chargeHeader.splice(3, 0, 'Vestiging');
  const chargeWidths = [...INCIDENT_WIDTHS];
  chargeWidths.splice(3, 0, 14);
  return [
    ...perGroup,
    {
      sheet: 'Doorbelasten',
      title: `Doorbelasten · annuleringen door de werkplaats · stand ${stamp(lookups.now)}`,
      header: chargeHeader,
      rows: chargeable.map((incident) => incidentRow(incident, lookups, true)),
      widths: chargeWidths,
    },
  ];
}
