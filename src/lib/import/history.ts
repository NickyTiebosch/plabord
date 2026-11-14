/**
 * De historie van binnenvallers en meldingen inlezen (fase 6, V63): de twee oude Excel-bestanden,
 * één keer. Puur: van tabbladen naar een plan voor `import_registrations`. Herkent per tabblad zelf
 * welk bestand het is, aan de kopregel.
 *
 * - Binnenvallers Registratie: per vestiging een tabblad (Den Bosch, Eindhoven, Breda) met de koppen
 *   Datum, Dag, Wk, de werkplaatsen en Totaal. Een leeg vak is niets ingevuld; `x` is 0.
 * - WPL meldingen dagregistratie: per vestiging een tabblad met de koppen Datum, Dag, Wk, Werkplaats,
 *   Soort melding, Wat ontbrak?, Tijdstip annulering, Doorbelasten, Kenteken, Contract-/
 *   reserveringsnr, Bijzonderheden en Ingevuld door.
 *
 * Andere tabbladen (Dashboard, Lijsten, Uitleg) worden overgeslagen.
 */
import type { IsoDate, TimeOfDay } from '../engine/types';
import { normalizePlate } from '../loans/plates';
import { amsterdamInstant } from '../loans/time';
import { shouldCharge } from '../registrations/status';
import type { CounterGroup, IncidentKind, Missing, Workshop } from '../registrations/types';
import { cellText, isEmptyCell, parseDateCell, parseTimeCell, type CellValue } from './cells';
import type { ImportIssue, RawSheet } from './workbook';

export interface HistoryWalkIn {
  workshop_id: string;
  date: IsoDate;
  count: number;
}

export interface HistoryIncident {
  workshop_id: string;
  occurred_at: string;
  kind: IncidentKind;
  missing: Missing | null;
  cancelled_at: TimeOfDay | null;
  charge: boolean | null;
  license_plate: string | null;
  contract_number: string | null;
  note: string | null;
  reported_by: string | null;
  import_key: string;
}

export interface HistoryGroupSummary {
  groupId: string;
  name: string;
  /** Dagen met minstens één ingevuld vak. */
  walkInDays: number;
  walkInTotal: number;
  incidents: number;
  /** Eerste en laatste dag in het bestand, of null. */
  from: IsoDate | null;
  to: IsoDate | null;
}

export interface HistoryPlan {
  walkIns: HistoryWalkIn[];
  incidents: HistoryIncident[];
  summary: HistoryGroupSummary[];
  /** Regels die het inlezen tegenhouden. */
  errors: ImportIssue[];
  /** Wat anders binnenkomt dan in het bestand staat, of is overgeslagen. */
  notices: ImportIssue[];
  /** Tabbladen die niet zijn gelezen. */
  skippedSheets: string[];
}

export interface HistoryContext {
  groups: readonly CounterGroup[];
  workshops: readonly Workshop[];
  employees: readonly { id: string; name: string }[];
  chargeFrom: TimeOfDay;
  /** Dagen na vandaag worden niet ingelezen. */
  today: IsoDate;
}

const MAX_WALK_INS = 500;
const MAX_NOTE = 300;
const MAX_CONTRACT = 20;

/** Kleine letters, enkele spaties, zonder regeleinden: "Contract-/\nreserveringsnr" → "contract-/ reserveringsnr". */
function key(value: CellValue): string {
  return cellText(value).toLocaleLowerCase('nl');
}

const KIND_BY_LABEL: Record<string, IncidentKind> = {
  'contract/rijbewijs niet in orde': 'contract_license',
  'verkeerde auto meegegeven': 'wrong_vehicle',
  'annulering door werkplaats': 'cancellation',
  'te laat retour': 'late_return',
};

const MISSING_BY_LABEL: Record<string, Missing> = {
  handtekening: 'signature',
  rijbewijscontrole: 'license_check',
  beide: 'both',
};

/** De kolommen van het meldingenbestand, op het begin van de kopnaam. */
const INCIDENT_COLUMNS = {
  date: 'datum',
  workshop: 'werkplaats',
  kind: 'soort melding',
  missing: 'wat ontbrak',
  cancelledAt: 'tijdstip',
  charge: 'doorbelasten',
  plate: 'kenteken',
  contract: 'contract',
  note: 'bijzonderheden',
  reportedBy: 'ingevuld door',
} as const;
type IncidentColumn = keyof typeof INCIDENT_COLUMNS;

function findHeaderRow(data: RawSheet['data'], test: (cells: string[]) => boolean): number {
  const limit = Math.min(data.length, 15);
  for (let index = 0; index < limit; index++) {
    const cells = (data[index] ?? []).map(key);
    if (test(cells)) return index;
  }
  return -1;
}

const isWalkInHeader = (cells: string[]) => cells[0] === 'datum' && cells.includes('totaal') && !cells.includes('soort melding');
const isIncidentHeader = (cells: string[]) => cells[0] === 'datum' && cells.includes('soort melding');

function groupForSheet(sheet: string, groups: readonly CounterGroup[]): CounterGroup | null {
  // "Den Bosch", maar ook "Invoer Den Bosch" of "Den Bosch (2)".
  const name = sheet.toLocaleLowerCase('nl');
  return groups.find((group) => name.includes(group.name.toLocaleLowerCase('nl'))) ?? null;
}

function workshopFinder(workshops: readonly Workshop[], groupId: string) {
  const own = workshops.filter((workshop) => workshop.groupId === groupId);
  return (name: string) => own.find((workshop) => workshop.name.toLocaleLowerCase('nl') === name.toLocaleLowerCase('nl')) ?? null;
}

/** Een voornaam uit "Ingevuld door", alleen als die bij precies één medewerker past. */
function personFinder(employees: HistoryContext['employees']) {
  const byFirstName = new Map<string, string[]>();
  for (const employee of employees) {
    const first = employee.name.trim().split(/\s+/)[0]?.toLocaleLowerCase('nl');
    if (!first) continue;
    byFirstName.set(first, [...(byFirstName.get(first) ?? []), employee.id]);
  }
  return (value: string): { id: string | null; reason: 'none' | 'unknown' | 'ambiguous' | null } => {
    const name = value.trim().split(/\s+/)[0]?.toLocaleLowerCase('nl') ?? '';
    if (name === '') return { id: null, reason: 'none' };
    const ids = byFirstName.get(name) ?? [];
    if (ids.length === 1) return { id: ids[0] ?? null, reason: null };
    return { id: null, reason: ids.length === 0 ? 'unknown' : 'ambiguous' };
  };
}

function emptySummary(group: CounterGroup): HistoryGroupSummary {
  return { groupId: group.id, name: group.name, walkInDays: 0, walkInTotal: 0, incidents: 0, from: null, to: null };
}

function widen(summary: HistoryGroupSummary, date: IsoDate) {
  if (!summary.from || date < summary.from) summary.from = date;
  if (!summary.to || date > summary.to) summary.to = date;
}

function parseWalkInSheet(raw: RawSheet, headerRow: number, group: CounterGroup, context: HistoryContext, plan: HistoryPlan) {
  const header = raw.data[headerRow] ?? [];
  const total = header.findIndex((cell) => key(cell) === 'totaal');
  const findWorkshop = workshopFinder(context.workshops, group.id);
  // De werkplaatsen staan tussen Wk (of Dag) en Totaal.
  const columns: { index: number; workshop: Workshop }[] = [];
  for (let index = 1; index < total; index++) {
    const name = cellText(header[index]);
    if (['dag', 'wk', 'week'].includes(name.toLocaleLowerCase('nl')) || name === '') continue;
    const workshop = findWorkshop(name);
    if (!workshop) {
      plan.errors.push({
        sheet: raw.sheet,
        row: headerRow + 1,
        message: `Werkplaats "${name}" bestaat niet bij ${group.name}. Voeg hem toe onder Beheer → Werkplaatsen, of pas de kop aan.`,
      });
      continue;
    }
    columns.push({ index, workshop });
  }

  const summary = plan.summary.find((entry) => entry.groupId === group.id) ?? emptySummary(group);
  if (!plan.summary.includes(summary)) plan.summary.push(summary);
  let futureSkipped = 0;

  raw.data.slice(headerRow + 1).forEach((cells, offset) => {
    const row = headerRow + 2 + offset;
    const dateCell = parseDateCell(cells[0]);
    // Regels zonder datum (zoals Totaal jaar) zijn geen dagen.
    if (!dateCell.ok || !dateCell.value) return;
    const date = dateCell.value;
    let filled = false;
    for (const { index, workshop } of columns) {
      const value = cells[index];
      if (isEmptyCell(value)) continue;
      let count: number | null = null;
      if (typeof value === 'number' && Number.isInteger(value)) count = value;
      else if (key(value) === 'x') count = 0;
      else if (/^\d+$/.test(cellText(value))) count = Number(cellText(value));
      if (count === null || count < 0 || count > MAX_WALK_INS) {
        plan.errors.push({ sheet: raw.sheet, row, message: `${workshop.name}: "${cellText(value)}" is geen aantal. Gebruik een heel getal of x.` });
        continue;
      }
      if (date > context.today) {
        futureSkipped++;
        continue;
      }
      plan.walkIns.push({ workshop_id: workshop.id, date, count });
      summary.walkInTotal += count;
      filled = true;
    }
    if (filled) {
      summary.walkInDays++;
      widen(summary, date);
    }
  });
  if (futureSkipped > 0) {
    plan.notices.push({ sheet: raw.sheet, row: null, message: `${futureSkipped} vak(ken) na vandaag overgeslagen.` });
  }
}

function incidentColumns(header: RawSheet['data'][number]): Partial<Record<IncidentColumn, number>> {
  const cells = header.map(key);
  const columns: Partial<Record<IncidentColumn, number>> = {};
  for (const [column, prefix] of Object.entries(INCIDENT_COLUMNS) as [IncidentColumn, string][]) {
    const index = cells.findIndex((cell) => cell.startsWith(prefix));
    if (index >= 0) columns[column] = index;
  }
  return columns;
}

function parseIncidentSheet(raw: RawSheet, headerRow: number, group: CounterGroup, context: HistoryContext, plan: HistoryPlan) {
  const columns = incidentColumns(raw.data[headerRow] ?? []);
  for (const required of ['date', 'workshop', 'kind'] as const) {
    if (columns[required] === undefined) {
      plan.errors.push({ sheet: raw.sheet, row: headerRow + 1, message: `De kolom "${INCIDENT_COLUMNS[required]}" ontbreekt.` });
      return;
    }
  }
  const cell = (cells: RawSheet['data'][number], column: IncidentColumn): CellValue =>
    columns[column] === undefined ? null : cells[columns[column]];
  const findWorkshop = workshopFinder(context.workshops, group.id);
  const findPerson = personFinder(context.employees);
  const summary = plan.summary.find((entry) => entry.groupId === group.id) ?? emptySummary(group);
  if (!plan.summary.includes(summary)) plan.summary.push(summary);
  const unknownPeople = new Set<string>();

  raw.data.slice(headerRow + 1).forEach((cells, offset) => {
    const row = headerRow + 2 + offset;
    const workshopName = cellText(cell(cells, 'workshop'));
    const kindLabel = key(cell(cells, 'kind'));
    // Een lege regel (het oude bestand heeft er honderden klaarstaan) is geen melding.
    if (workshopName === '' && kindLabel === '') return;
    const issue = (message: string) => plan.errors.push({ sheet: raw.sheet, row, message });
    const notice = (message: string) => plan.notices.push({ sheet: raw.sheet, row, message });

    const dateCell = parseDateCell(cell(cells, 'date'));
    if (!dateCell.ok || !dateCell.value) return issue(dateCell.ok ? 'De datum ontbreekt.' : dateCell.error);
    const date = dateCell.value;
    if (date > context.today) return issue('Deze datum ligt na vandaag.');

    const workshop = findWorkshop(workshopName);
    if (!workshop) {
      return issue(
        workshopName === ''
          ? 'De werkplaats ontbreekt.'
          : `Werkplaats "${workshopName}" bestaat niet bij ${group.name}. Voeg hem toe onder Beheer → Werkplaatsen.`,
      );
    }
    const kind = KIND_BY_LABEL[kindLabel];
    if (!kind) return issue(kindLabel === '' ? 'De soort melding ontbreekt.' : `Onbekende soort melding "${cellText(cell(cells, 'kind'))}".`);

    let missing: Missing | null = null;
    const missingLabel = key(cell(cells, 'missing'));
    if (kind === 'contract_license') {
      missing = MISSING_BY_LABEL[missingLabel] ?? null;
      if (missingLabel !== '' && !missing) notice(`"${cellText(cell(cells, 'missing'))}" bij Wat ontbrak? is onbekend; komt binnen zonder.`);
    } else if (missingLabel !== '') {
      notice('Wat ontbrak? hoort alleen bij contract/rijbewijs; overgeslagen.');
    }

    let cancelledAt: TimeOfDay | null = null;
    let charge: boolean | null = null;
    const chargeLabel = key(cell(cells, 'charge'));
    if (kind === 'cancellation') {
      const time = parseTimeCell(cell(cells, 'cancelledAt'));
      if (!time.ok) return issue(`Tijdstip annulering: ${time.error}`);
      cancelledAt = time.value;
      if (chargeLabel === 'ja') charge = true;
      else if (chargeLabel === 'nee') charge = false;
      else if (cancelledAt) charge = shouldCharge(cancelledAt, context.chargeFrom);
      else {
        charge = false;
        notice('Annulering zonder tijdstip en zonder Doorbelasten: komt binnen als niet doorbelasten.');
      }
    }

    const plateText = cellText(cell(cells, 'plate'));
    const plate = plateText === '' ? null : normalizePlate(plateText);
    if (plateText !== '' && !plate) notice(`"${plateText}" is geen kenteken; komt binnen zonder kenteken.`);

    let contract: string | null = cellText(cell(cells, 'contract')) || null;
    if (contract && contract.length > MAX_CONTRACT) {
      notice(`Het contractnummer is langer dan ${MAX_CONTRACT} tekens; komt binnen zonder.`);
      contract = null;
    }

    let note: string | null = cellText(cell(cells, 'note')) || null;
    if (note && note.length > MAX_NOTE) {
      note = note.slice(0, MAX_NOTE).trim();
      notice(`Bijzonderheden ingekort tot ${MAX_NOTE} tekens.`);
    }

    const person = findPerson(cellText(cell(cells, 'reportedBy')));
    if (person.reason === 'unknown' || person.reason === 'ambiguous') unknownPeople.add(cellText(cell(cells, 'reportedBy')));

    // Het oude bestand heeft alleen een datum. Bij een annulering het tijdstip van de annulering,
    // anders 12:00: dan valt de melding op de goede dag.
    const occurredAt = amsterdamInstant(date, cancelledAt ?? '12:00').toISOString();

    plan.incidents.push({
      workshop_id: workshop.id,
      occurred_at: occurredAt,
      kind,
      missing,
      cancelled_at: cancelledAt,
      charge,
      license_plate: plate,
      contract_number: contract,
      note,
      reported_by: person.id,
      import_key: `wpl:${group.id}:${row}`,
    });
    summary.incidents++;
    widen(summary, date);
  });

  if (unknownPeople.size > 0) {
    plan.notices.push({
      sheet: raw.sheet,
      row: null,
      message: `Ingevuld door niet gekoppeld (onbekend of meerdere collega's met die naam): ${[...unknownPeople].sort().join(', ')}. Die meldingen komen binnen zonder naam.`,
    });
  }
}

/** Alle tabbladen van één of beide bestanden tot één plan. */
export function planHistory(sheets: readonly RawSheet[], context: HistoryContext): HistoryPlan {
  const plan: HistoryPlan = { walkIns: [], incidents: [], summary: [], errors: [], notices: [], skippedSheets: [] };
  for (const raw of sheets) {
    const walkInHeader = findHeaderRow(raw.data, isWalkInHeader);
    const incidentHeader = findHeaderRow(raw.data, isIncidentHeader);
    const group = groupForSheet(raw.sheet, context.groups);
    if (!group || (walkInHeader < 0 && incidentHeader < 0)) {
      plan.skippedSheets.push(raw.sheet);
      continue;
    }
    if (incidentHeader >= 0) parseIncidentSheet(raw, incidentHeader, group, context, plan);
    else parseWalkInSheet(raw, walkInHeader, group, context, plan);
  }
  if (plan.walkIns.length === 0 && plan.incidents.length === 0 && plan.errors.length === 0) {
    plan.errors.push({
      sheet: null,
      row: null,
      message: 'Geen binnenvallers of meldingen gevonden. Kies Binnenvallers Registratie of WPL meldingen dagregistratie.',
    });
  }
  plan.summary.sort((a, b) => context.groups.findIndex((g) => g.id === a.groupId) - context.groups.findIndex((g) => g.id === b.groupId));
  return plan;
}
