/**
 * Binnenvallers, meldingen en dag afsluiten (fase 6). Namen en keuzes zoals in de oude
 * Excel-bestanden, zodat de export en de historie erop aansluiten.
 */
import type { IsoDate, TimeOfDay } from '../engine/types';

export interface Workshop {
  id: string;
  groupId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface WalkIn {
  groupId: string;
  workshopId: string;
  date: IsoDate;
  count: number;
  updatedBy: string | null;
  updatedAt: string;
}

export const INCIDENT_KINDS = ['contract_license', 'wrong_vehicle', 'cancellation', 'late_return'] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];
export const INCIDENT_KIND_LABELS: Record<IncidentKind, string> = {
  contract_license: 'Contract/rijbewijs niet in orde',
  wrong_vehicle: 'Verkeerde auto meegegeven',
  cancellation: 'Annulering door werkplaats',
  late_return: 'Te laat retour',
};
export const isIncidentKind = (value: unknown): value is IncidentKind => INCIDENT_KINDS.includes(value as IncidentKind);

export const MISSING_OPTIONS = ['signature', 'license_check', 'both'] as const;
export type Missing = (typeof MISSING_OPTIONS)[number];
export const MISSING_LABELS: Record<Missing, string> = {
  signature: 'Handtekening',
  license_check: 'Rijbewijscontrole',
  both: 'Beide',
};
export const isMissing = (value: unknown): value is Missing => MISSING_OPTIONS.includes(value as Missing);

export interface Incident {
  id: string;
  groupId: string;
  workshopId: string;
  /** ISO-tijdstempel. */
  occurredAt: string;
  kind: IncidentKind;
  missing: Missing | null;
  /** Alleen bij een annulering: wanneer de werkplaats annuleerde. */
  cancelledAt: TimeOfDay | null;
  /** Alleen bij een annulering: moet het worden doorbelast? */
  charge: boolean | null;
  /** Is het doorbelast? Tijdstempel, of null. */
  chargedAt: string | null;
  chargedBy: string | null;
  plate: string | null;
  contractNumber: string | null;
  note: string | null;
  reportedBy: string | null;
  createdAt: string;
}

export interface DayClosure {
  groupId: string;
  date: IsoDate;
  rentlinkChecked: boolean;
  closedBy: string | null;
  closedAt: string;
}

export interface CounterGroup {
  id: string;
  name: string;
}
