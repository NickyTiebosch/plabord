/**
 * De uitleen (fase 5, V45–V49): auto's die verhuur meegeeft aan Mobiliteit of aan de werkplaats voor
 * het weekend. Puur: alleen typen en labels.
 */
import type { IsoDate } from '../engine/types';

export const DESTINATIONS = ['mobility', 'workshop_weekend'] as const;
export type Destination = (typeof DESTINATIONS)[number];

export const DESTINATION_LABELS: Record<Destination, string> = {
  mobility: 'Mobiliteit',
  workshop_weekend: 'Werkplaats (weekend)',
};

export function isDestination(value: unknown): value is Destination {
  return typeof value === 'string' && (DESTINATIONS as readonly string[]).includes(value);
}

/**
 * Eén uitleen. Tijdstippen zijn ISO-tijdstempels in UTC, altijd in de vorm van `toISOString()`
 * (2026-11-12T13:05:00.000Z), zodat ze als tekst op volgorde te zetten zijn.
 */
export interface VehicleLoan {
  id: string;
  /** De vestiging die de auto meegaf. */
  groupId: string;
  /** Genormaliseerd: hoofdletters, zonder streepjes of spaties (GHP39K). */
  plate: string;
  model: string;
  destination: Destination;
  /** Aan wie de auto is meegegeven: een persoon of een afdeling. */
  handedTo: string;
  /** Wie de auto meegaf; `null` als die medewerker volledig is verwijderd. */
  handedOutBy: string | null;
  handedOutAt: string;
  odometerOut: number | null;
  returnedAt: string | null;
  returnedBy: string | null;
  odometerIn: number | null;
  /** Ingezet ja of nee; `null` zolang de auto uit staat. */
  wasUsed: boolean | null;
  note: string | null;
  returnNote: string | null;
}

/** Een vestiging zoals de uitleen hem nodig heeft. */
export interface LoanGroup {
  id: string;
  name: string;
  /** Minimaal aantal auto's voor Mobiliteit per werkdag (V48); 0 = geen controle. */
  mobilityPerDay: number;
}

/** Datum en tijd in Europe/Amsterdam. */
export interface LocalMoment {
  date: IsoDate;
  time: string;
}
