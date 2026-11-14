/**
 * Signalen (fase 7, V69): vaste regels die onder Let op op Start komen, voor beheerder en
 * teamleider. Elk signaal verwijst naar het rapport of de lijst waar het uit komt. Geen mail of
 * push. Puur: gegevens, "vandaag" en "nu" komen binnen als parameter; dezelfde invoer geeft altijd
 * dezelfde signalen, in dezelfde volgorde.
 */
import type { ClosureResolver } from '../engine/closures';
import { addDays, daysBetween, eachDay, startOfIsoWeek, startOfMonth, weekdayOf } from '../engine/dates';
import type { IsoDate } from '../engine/types';
import { mobilityDayCheck } from '../loans/status';
import { localMoment } from '../loans/time';
import type { LoanGroup, VehicleLoan } from '../loans/types';
import type { CompletionRow } from '../registrations/status';
import type { Incident, Workshop } from '../registrations/types';
import type { IncidentBucket } from './build';

export interface SignalSettings {
  /** Een werkplaats heeft deze week meer dan zoveel keer het gemiddelde aan meldingen. Null = uit. */
  incidentFactor: number | null;
  /** …en minstens zoveel. */
  incidentMin: number;
  /** Een vestiging sloot deze week minstens zoveel dagen niet af. */
  unclosedDays: number | null;
  /** Annuleringen staan langer dan zoveel dagen op de doorbelastlijst. */
  chargeDays: number | null;
  /** Een vestiging gaf deze week op minstens zoveel dagen te weinig auto's aan Mobiliteit. */
  shortDays: number | null;
  /** Meer dan zoveel procent van de auto's voor Mobiliteit is deze maand niet ingezet. */
  unusedPercent: number | null;
}

export const DEFAULT_SIGNAL_SETTINGS: SignalSettings = {
  incidentFactor: 2,
  incidentMin: 3,
  unclosedDays: 2,
  chargeDays: 14,
  shortDays: 2,
  unusedPercent: 33,
};

/** Zoveel weken terug telt het gemiddelde van de meldingen. */
export const INCIDENT_BASE_WEEKS = 8;
/** Pas vanaf zoveel auto's retour zegt het aandeel niet ingezet iets. */
export const UNUSED_MIN_RETURNED = 3;

export interface Signal {
  href: string;
  text: string;
}

export interface SignalInput {
  today: IsoDate;
  settings: SignalSettings;
  groups: readonly LoanGroup[];
  workshops: readonly Workshop[];
  /** Meldingen per week (bucket = maandag) en werkplaats, van deze week en de weken ervoor. */
  weeklyIncidents: readonly IncidentBucket[];
  /** De invulcontrole over deze week. */
  completion: readonly CompletionRow[];
  /** De annuleringen die nog doorbelast moeten worden. */
  openCharges: readonly Incident[];
  /** De uitleen sinds het begin van deze week of maand, wat het eerst is. */
  loans: readonly VehicleLoan[];
  closures: ClosureResolver;
  firstLoanDates: ReadonlyMap<string, IsoDate>;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const decimal = (value: number) => value.toLocaleString('nl-NL', { maximumFractionDigits: 1 });

/** Wat er geladen moet worden: van welke dag. */
export function signalsSince(today: IsoDate): { weeks: IsoDate; loans: IsoDate } {
  const monday = startOfIsoWeek(today);
  const month = startOfMonth(today);
  return { weeks: addDays(monday, -7 * INCIDENT_BASE_WEEKS), loans: month < monday ? month : monday };
}

export function reportSignals(input: SignalInput): Signal[] {
  const { settings, today } = input;
  const monday = startOfIsoWeek(today);
  const signals: Signal[] = [];
  const groupName = (id: string) => input.groups.find((group) => group.id === id)?.name ?? id;

  if (settings.incidentFactor !== null) {
    const factor = settings.incidentFactor;
    const weeks = Array.from({ length: INCIDENT_BASE_WEEKS }, (_, index) => addDays(monday, -7 * (index + 1)));
    for (const workshop of input.workshops) {
      const count = (week: IsoDate) =>
        input.weeklyIncidents.filter((row) => row.workshopId === workshop.id && row.bucket === week).reduce((total, row) => total + row.total, 0);
      const now = count(monday);
      const average = weeks.reduce((total, week) => total + count(week), 0) / INCIDENT_BASE_WEEKS;
      if (now >= settings.incidentMin && now > factor * average) {
        signals.push({
          href: `/rapporten/meldingen?per=week&aantal=${INCIDENT_BASE_WEEKS + 1}&vestiging=${workshop.groupId}`,
          text: `${workshop.name} (${groupName(workshop.groupId)}) heeft deze week ${plural(now, 'melding', 'meldingen')}, meer dan ${factor}× het gemiddelde (${decimal(average)})`,
        });
      }
    }
  }

  if (settings.unclosedDays !== null) {
    for (const row of input.completion) {
      const open = row.cells.filter((cell) => cell.date >= monday && cell.state === 'open').length;
      if (open >= settings.unclosedDays) {
        signals.push({ href: '/controle', text: `${row.groupName} sloot deze week ${plural(open, 'dag', 'dagen')} niet af` });
      }
    }
  }

  if (settings.chargeDays !== null) {
    const limit = settings.chargeDays;
    const old = input.openCharges.filter((incident) => !incident.chargedAt && incident.charge && daysBetween(localMoment(incident.occurredAt).date, today) > limit);
    if (old.length > 0) {
      signals.push({
        href: '/meldingen/doorbelasten',
        text: `${plural(old.length, 'annulering staat', 'annuleringen staan')} langer dan ${limit} dagen op de doorbelastlijst`,
      });
    }
  }

  if (settings.shortDays !== null) {
    const days = eachDay(monday, today).filter((date) => weekdayOf(date) <= 5);
    for (const row of mobilityDayCheck(input.loans, input.groups, days, today, input.closures, input.firstLoanDates)) {
      const short = row.cells.filter((cell) => cell.state === 'short').length;
      if (short >= settings.shortDays) {
        signals.push({
          href: `/rapporten/mobiliteit?per=week&aantal=4&vestiging=${row.groupId}`,
          text: `${row.groupName} gaf deze week op ${plural(short, 'dag', 'dagen')} te weinig auto’s aan Mobiliteit`,
        });
      }
    }
  }

  if (settings.unusedPercent !== null) {
    const month = startOfMonth(today);
    for (const group of input.groups) {
      const returned = input.loans.filter(
        (loan) => loan.groupId === group.id && loan.destination === 'mobility' && loan.wasUsed !== null && localMoment(loan.handedOutAt).date >= month,
      );
      const unused = returned.filter((loan) => loan.wasUsed === false).length;
      if (returned.length >= UNUSED_MIN_RETURNED && unused * 100 > settings.unusedPercent * returned.length) {
        signals.push({
          href: `/rapporten/mobiliteit?per=maand&aantal=3&vestiging=${group.id}`,
          text: `${group.name}: ${unused} van de ${returned.length} auto’s voor Mobiliteit zijn deze maand niet ingezet (${Math.round((unused / returned.length) * 100)}%)`,
        });
      }
    }
  }

  return signals;
}

/** De grenzen per signaal: [min, max]. Gelijk aan de controle in de database. */
export const SIGNAL_BOUNDS = {
  incidentFactor: [2, 10],
  incidentMin: [1, 50],
  unclosedDays: [1, 6],
  chargeDays: [1, 90],
  shortDays: [1, 5],
  unusedPercent: [1, 100],
} as const satisfies Record<keyof SignalSettings, readonly [number, number]>;

const SIGNAL_LABELS: Record<keyof SignalSettings, string> = {
  incidentFactor: 'Meldingen per werkplaats (keer het gemiddelde)',
  incidentMin: 'Meldingen per werkplaats (minstens)',
  unclosedDays: 'Dagen niet afgesloten',
  chargeDays: 'Dagen op de doorbelastlijst',
  shortDays: 'Dagen met te weinig auto’s',
  unusedPercent: 'Niet ingezet (procent)',
};

/**
 * De grenzen uit het formulier onder Beheer → Instellingen. Een leeg vak zet dat signaal uit;
 * alleen "minstens zoveel meldingen" moet altijd een getal zijn.
 */
export function parseSignalForm(form: FormData): { ok: true; settings: SignalSettings } | { ok: false; error: string } {
  const settings = { ...DEFAULT_SIGNAL_SETTINGS };
  for (const key of Object.keys(SIGNAL_BOUNDS) as (keyof SignalSettings)[]) {
    const raw = form.get(key);
    const text = typeof raw === 'string' ? raw.trim() : '';
    const [min, max] = SIGNAL_BOUNDS[key];
    if (text === '') {
      if (key === 'incidentMin') return { ok: false, error: `${SIGNAL_LABELS[key]}: vul een getal in.` };
      (settings as Record<string, number | null>)[key] = null;
      continue;
    }
    const value = Number(text);
    if (!Number.isInteger(value) || value < min || value > max) {
      return { ok: false, error: `${SIGNAL_LABELS[key]}: vul een heel getal in van ${min} tot en met ${max}, of laat het leeg om het signaal uit te zetten.` };
    }
    (settings as Record<string, number | null>)[key] = value;
  }
  return { ok: true, settings };
}
