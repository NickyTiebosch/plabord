/**
 * Alle gegevens van één medewerker (fase 3, besluit V20), bijvoorbeeld voor een inzageverzoek
 * volgens de AVG. Puur: van gegevens naar tabbladen. Agendalinks zonder de geheime link zelf.
 */
import { amsterdamDateTime } from '../engine/dates';
import { weekdayShort } from '../engine/format';
import { ABSENCE_PART_LABELS, ABSENCE_STATUS_LABELS, ROLE_LABELS } from '../engine/labels';
import type { Absence, Group, IsoDate, RecurringShift, ShiftOverride, Substitution } from '../engine/types';
import { MAIL_KIND_LABELS, mailStatusLabel } from '../mail/labels';
import { formatDateList } from '../mail/messages';
import type { MailKind, MailStatus } from '../mail/types';
import { formatPlate } from '../loans/plates';
import { DESTINATION_LABELS, type VehicleLoan } from '../loans/types';
import { localMoment } from '../loans/time';
import { INCIDENT_KIND_LABELS, type DayClosure, type Incident, type WalkIn, type Workshop } from '../registrations/types';
import {
  dayPartsCell,
  formatExportDate,
  formatExportTime,
  roleCell,
  SUBSTITUTION_STATUS_TEXT,
  type ExportEmployee,
  type ExportSheet,
} from './planning';

export interface EmployeeData {
  employee: ExportEmployee;
  hasAccount: boolean;
  /** Wanneer die voor het laatst inlogde (V38, uit Supabase Auth); `null` = nog nooit, `undefined` = onbekend. */
  lastSignInAt?: string | null;
  groups: readonly Group[];
  recurringShifts: readonly RecurringShift[];
  absences: readonly Absence[];
  substitutions: readonly Substitution[];
  shiftOverrides: readonly ShiftOverride[];
  feeds: readonly { kind: string; groupId: string | null; createdAt: string; revokedAt: string | null }[];
  mails: readonly { kind: MailKind; dates: readonly IsoDate[]; status: MailStatus; lastError: string | null; attempts: number; createdAt: string }[];
  /** Toestellen met meldingen aan (fase 4, V28): alleen wanneer, nooit het adres of de sleutels. */
  devices: readonly { createdAt: string; lastSuccessAt: string | null }[];
  /** De logboekregels over deze medewerker, al in gewone taal. */
  log: readonly { when: string; what: string; detail: string | null }[];
  /** De uitleen (fase 5) die deze medewerker meegaf of retour meldde. */
  loans?: readonly VehicleLoan[];
  /** Fase 6: meldingen die deze medewerker maakte of op doorbelast zette. */
  incidents?: readonly Incident[];
  /** Fase 6: dagen die deze medewerker afsloot. */
  closures?: readonly DayClosure[];
  /** Fase 6: binnenvallers die deze medewerker het laatst bijwerkte. */
  walkIns?: readonly WalkIn[];
  workshops?: readonly Workshop[];
}

/** Tijdstip in Nederlandse tijd: "14-10-2026 13:05". */
export function formatExportMoment(timestamp: string): string {
  const moment = amsterdamDateTime(new Date(timestamp));
  return `${formatExportDate(moment.date)} ${moment.time}`;
}

const byDate = <T>(key: (item: T) => string) => (a: T, b: T) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);

export function employeeExport(data: EmployeeData): ExportSheet[] {
  const groupName = (id: string | null) => data.groups.find((group) => group.id === id)?.name ?? id ?? '';
  const { employee } = data;
  const workshopName = (id: string) => data.workshops?.find((workshop) => workshop.id === id)?.name ?? '';
  const feedLabel = (kind: string, groupId: string | null) =>
    kind === 'personal' ? 'Mijn rooster' : kind === 'location' ? `Vestiging ${groupName(groupId)}` : 'Verlof team';

  return [
    {
      sheet: 'Gegevens',
      header: ['Gegeven', 'Waarde'],
      rows: [
        ['Naam', employee.name],
        ['Werkmail', employee.email ?? ''],
        ['Groep', groupName(employee.groupId)],
        ['Standaardrol', ROLE_LABELS[employee.defaultRole]],
        ['Inzetbaar aan de balie in', employee.counterGroupIds.map((id) => groupName(id)).join(', ')],
        ['Beheerder', employee.isAdmin ? 'ja' : 'nee'],
        ['Teamleider', employee.isTeamLead ? 'ja' : 'nee'],
        ['Actief', employee.isActive ? 'ja' : 'nee'],
        ['Inlogaccount', data.hasAccount ? 'ja' : 'nee'],
        [
          'Laatst ingelogd',
          !data.hasAccount
            ? ''
            : data.lastSignInAt
              ? formatExportMoment(data.lastSignInAt)
              : data.lastSignInAt === null
                ? 'nog niet'
                : 'onbekend',
        ],
      ],
    },
    {
      sheet: 'Vaste diensten',
      header: ['Dag', 'Groep', 'Rol', 'Begintijd', 'Eindtijd', 'Geldig vanaf', 'Geldig tot'],
      rows: [...data.recurringShifts]
        .sort((a, b) => a.weekday - b.weekday || (a.validFrom < b.validFrom ? -1 : a.validFrom > b.validFrom ? 1 : 0))
        .map((shift) => [
          weekdayShort(shift.weekday),
          groupName(shift.groupId),
          roleCell(shift.role),
          formatExportTime(shift.startTime),
          formatExportTime(shift.endTime),
          formatExportDate(shift.validFrom),
          shift.validTo ? formatExportDate(shift.validTo) : '',
        ]),
    },
    {
      sheet: 'Afwezigheid',
      header: ['Van', 'Tot', 'Dagdeel', 'Status'],
      rows: [...data.absences]
        .sort(byDate((absence) => absence.startDate))
        .map((absence) => [
          formatExportDate(absence.startDate),
          formatExportDate(absence.endDate),
          ABSENCE_PART_LABELS[absence.dayPart],
          ABSENCE_STATUS_LABELS[absence.status],
        ]),
    },
    {
      sheet: 'Invallen',
      header: ['Datum', 'Vestiging', 'Dagdeel', 'Status'],
      rows: [...data.substitutions]
        .sort(byDate((sub) => sub.date))
        .map((sub) => [formatExportDate(sub.date), groupName(sub.groupId), dayPartsCell(sub.dayParts), SUBSTITUTION_STATUS_TEXT[sub.status]]),
    },
    {
      sheet: 'Roosterwijzigingen',
      header: ['Datum', 'Wijziging', 'Groep', 'Rol', 'Begintijd', 'Eindtijd'],
      rows: [...data.shiftOverrides]
        .sort(byDate((item) => item.date))
        .map((item) => [
          formatExportDate(item.date),
          item.kind === 'off' ? 'geen dienst' : 'andere dienst',
          item.kind === 'shift' ? groupName(item.groupId) : '',
          roleCell(item.role),
          formatExportTime(item.startTime),
          formatExportTime(item.endTime),
        ]),
    },
    {
      sheet: 'Agendalinks',
      header: ['Soort', 'Gemaakt', 'Ingetrokken'],
      rows: [...data.feeds]
        .sort(byDate((feed) => feed.createdAt))
        .map((feed) => [
          feedLabel(feed.kind, feed.groupId),
          formatExportMoment(feed.createdAt),
          feed.revokedAt ? formatExportMoment(feed.revokedAt) : '',
        ]),
    },
    {
      sheet: 'Mails',
      header: ['Gemaakt', 'Soort', 'Over', 'Status'],
      rows: [...data.mails]
        .sort(byDate((mail) => mail.createdAt))
        .map((mail) => [
          formatExportMoment(mail.createdAt),
          MAIL_KIND_LABELS[mail.kind],
          formatDateList(mail.dates),
          mailStatusLabel(mail.status, mail.lastError, mail.attempts),
        ]),
    },
    {
      sheet: 'Meldingen',
      header: ['Toestel', 'Aangezet', 'Laatste melding aangekomen'],
      rows: [...data.devices]
        .sort(byDate((device) => device.createdAt))
        .map((device, index) => [
          `Toestel ${index + 1}`,
          formatExportMoment(device.createdAt),
          device.lastSuccessAt ? formatExportMoment(device.lastSuccessAt) : '',
        ]),
    },
    {
      // Fase 5: zonder aan wie de auto ging en zonder opmerkingen; dat zijn geen gegevens over deze persoon.
      sheet: 'Mobiliteit',
      header: ['Kenteken', 'Model', 'Vestiging', 'Bestemming', 'Meegegeven', 'Retour', 'Ingezet', 'Wat deed deze medewerker'],
      rows: [...(data.loans ?? [])]
        .sort(byDate((loan) => loan.handedOutAt))
        .map((loan) => [
          formatPlate(loan.plate),
          loan.model,
          groupName(loan.groupId),
          DESTINATION_LABELS[loan.destination],
          formatExportMoment(loan.handedOutAt),
          loan.returnedAt ? formatExportMoment(loan.returnedAt) : '',
          loan.wasUsed === null ? '' : loan.wasUsed ? 'ja' : 'nee',
          [loan.handedOutBy === employee.id ? 'meegegeven' : null, loan.returnedBy === employee.id ? 'retour gemeld' : null]
            .filter(Boolean)
            .join(' en '),
        ]),
    },
    {
      // Fase 6: zonder kenteken, contractnummer en bijzonderheden; dat zijn geen gegevens over deze persoon.
      sheet: 'Werkplaatsmeldingen',
      header: ['Datum', 'Vestiging', 'Werkplaats', 'Soort melding', 'Wat deed deze medewerker'],
      rows: [...(data.incidents ?? [])]
        .sort(byDate((incident) => incident.occurredAt))
        .map((incident) => [
          formatExportDate(localMoment(incident.occurredAt).date),
          groupName(incident.groupId),
          workshopName(incident.workshopId),
          INCIDENT_KIND_LABELS[incident.kind],
          [incident.reportedBy === employee.id ? 'gemeld' : null, incident.chargedBy === employee.id ? 'op doorbelast gezet' : null]
            .filter(Boolean)
            .join(' en '),
        ]),
    },
    {
      sheet: 'Binnenvallers',
      header: ['Datum', 'Vestiging', 'Werkplaats', 'Aantal', 'Laatst bijgewerkt'],
      rows: [...(data.walkIns ?? [])]
        .sort(byDate((walkIn) => walkIn.date))
        .map((walkIn) => [
          formatExportDate(walkIn.date),
          groupName(walkIn.groupId),
          workshopName(walkIn.workshopId),
          String(walkIn.count),
          formatExportMoment(walkIn.updatedAt),
        ]),
    },
    {
      sheet: 'Dag afgesloten',
      header: ['Datum', 'Vestiging', 'RentLink gecontroleerd', 'Afgesloten om'],
      rows: [...(data.closures ?? [])]
        .sort(byDate((closure) => closure.date))
        .map((closure) => [
          formatExportDate(closure.date),
          groupName(closure.groupId),
          closure.rentlinkChecked ? 'ja' : 'nee',
          formatExportMoment(closure.closedAt),
        ]),
    },
    {
      sheet: 'Logboek',
      header: ['Wanneer', 'Wat', 'Details'],
      rows: data.log.map((entry) => [entry.when, entry.what, entry.detail ?? '']),
    },
  ];
}
