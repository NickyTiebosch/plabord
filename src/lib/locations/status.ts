/**
 * Locatie van huurauto's (fase 8, V73–V77). Puur: gegevens en "vandaag" komen binnen als parameter.
 */
import { daysBetween } from '../engine/dates';
import type { IsoDate } from '../engine/types';
import { localMoment } from '../loans/time';
import type { ParkingSpot, VehicleLocation } from './types';

/** Langer dan zoveel dagen niet verzet: het grijze label "lang niet gezien" (V74). */
export const STALE_DAYS = 14;
export const MAX_SPOT_NAME = 20;
export const MAX_MODEL = 60;

export function isStale(location: Pick<VehicleLocation, 'movedAt'>, today: IsoDate): boolean {
  return daysBetween(localMoment(location.movedAt).date, today) > STALE_DAYS;
}

export interface SpotWithVehicles {
  spot: ParkingSpot;
  vehicles: VehicleLocation[];
}

/**
 * De plekken van een vestiging met hun auto's, op volgorde. Een inactieve plek alleen als er nog
 * een auto staat. Auto's op kenteken, zodat de volgorde altijd hetzelfde is.
 */
export function spotsWithVehicles(spots: readonly ParkingSpot[], locations: readonly VehicleLocation[], groupId: string): SpotWithVehicles[] {
  return spots
    .filter((spot) => spot.groupId === groupId)
    .map((spot) => ({
      spot,
      vehicles: locations.filter((location) => location.spotId === spot.id).sort((a, b) => (a.plate < b.plate ? -1 : a.plate > b.plate ? 1 : 0)),
    }))
    .filter((entry) => entry.spot.isActive || entry.vehicles.length > 0)
    .sort((a, b) => a.spot.sortOrder - b.spot.sortOrder || a.spot.name.localeCompare(b.spot.name, 'nl', { numeric: true }));
}

/** Een naam voor een plek: 1 tot 20 tekens, enkele spaties. */
export function cleanSpotName(value: unknown): string | null {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return name.length >= 1 && name.length <= MAX_SPOT_NAME ? name : null;
}

/**
 * Meerdere plekken in één keer, één per regel (Beheer → Plekken). Lege regels en dubbelingen vallen
 * weg; een te lange naam geeft een fout.
 */
export function parseSpotList(text: string): { ok: true; names: string[] } | { ok: false; error: string } {
  const names: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const name = cleanSpotName(line);
    if (!name) return { ok: false, error: `"${line.trim().slice(0, 30)}" is te lang: een plek heeft hooguit ${MAX_SPOT_NAME} tekens.` };
    if (!names.some((existing) => existing.toLocaleLowerCase('nl') === name.toLocaleLowerCase('nl'))) names.push(name);
  }
  if (names.length === 0) return { ok: false, error: 'Vul minstens één plek in.' };
  if (names.length > 100) return { ok: false, error: 'Hooguit 100 plekken tegelijk.' };
  return { ok: true, names };
}

/** Een model zoals iemand het typt: hooguit 60 tekens, leeg = niets. */
export function cleanModel(value: unknown): string | null {
  const model = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return model === '' ? null : model.slice(0, MAX_MODEL).trim();
}
