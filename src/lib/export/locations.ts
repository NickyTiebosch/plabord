/**
 * De locatie als Excel (fase 8, V78): per vestiging een tabblad met kenteken en plek, zoals het
 * oude bestand, met model en wie de auto het laatst verzette. Puur.
 */
import { formatPlate } from '../loans/plates';
import { localMoment } from '../loans/time';
import { isStale } from '../locations/status';
import type { ParkingSpot, VehicleLocation } from '../locations/types';
import type { IsoDate } from '../engine/types';
import type { LoanCell } from './loans';
import type { TitledSheet } from './registrations';

const text = (value: string | null): LoanCell => ({ value: value || null, kind: 'text' });

export function locationsExport(
  locations: readonly VehicleLocation[],
  context: { groups: readonly { id: string; name: string }[]; spots: readonly ParkingSpot[]; personName: (id: string | null) => string; now: Date; today: IsoDate },
): TitledSheet[] {
  const stand = localMoment(context.now.toISOString());
  const spot = (id: string) => context.spots.find((candidate) => candidate.id === id);
  return context.groups
    .filter((group) => context.spots.some((candidate) => candidate.groupId === group.id) || locations.some((location) => location.groupId === group.id))
    .map((group) => ({
      sheet: group.name.slice(0, 31),
      title: `Locatie huurauto’s · ${group.name} · stand ${stand.date.split('-').reverse().join('-')} ${stand.time}`,
      header: ['Kenteken', 'Plek', 'Model', 'Verzet door', 'Verzet op', 'Lang niet gezien'],
      widths: [12, 14, 24, 18, 12, 16],
      rows: locations
        .filter((location) => location.groupId === group.id)
        .sort((a, b) => {
          const left = spot(a.spotId);
          const right = spot(b.spotId);
          return (left?.sortOrder ?? 0) - (right?.sortOrder ?? 0) || (left?.name ?? '').localeCompare(right?.name ?? '', 'nl', { numeric: true }) || (a.plate < b.plate ? -1 : 1);
        })
        .map((location) => [
          text(formatPlate(location.plate)),
          text(spot(location.spotId)?.name ?? null),
          text(location.model),
          text(context.personName(location.movedBy)),
          { value: localMoment(location.movedAt).date, kind: 'date' as const },
          isStale(location, context.today) ? { value: 'ja', kind: 'text' as const, tone: 'unused' as const } : text(null),
        ]),
    }));
}
