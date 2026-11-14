/**
 * Locatie van huurauto's laden (fase 8). Met de sessie van wie kijkt: RLS geldt. Iedere actieve
 * medewerker leest.
 */
import type { ParkingSpot, VehicleLocation } from '../locations/types';
import type { Tables } from './database.types';
import { must, type DbClient } from './queries';

export function mapSpot(row: Tables<'parking_spots'>): ParkingSpot {
  return { id: row.id, groupId: row.group_id, name: row.name, sortOrder: row.sort_order, isActive: row.is_active };
}

export function mapLocation(row: Tables<'vehicle_locations'>): VehicleLocation {
  return {
    plate: row.license_plate,
    groupId: row.group_id,
    spotId: row.spot_id,
    model: row.model,
    movedBy: row.moved_by,
    movedAt: new Date(row.moved_at).toISOString(),
  };
}

export async function loadSpots(client: DbClient): Promise<ParkingSpot[]> {
  return must(await client.from('parking_spots').select('*').order('sort_order').order('name'), 'de plekken').map(mapSpot);
}

export async function loadLocations(client: DbClient, groupId?: string): Promise<VehicleLocation[]> {
  let query = client.from('vehicle_locations').select('*').order('license_plate').limit(2000);
  if (groupId) query = query.eq('group_id', groupId);
  return must(await query, 'de locaties').map(mapLocation);
}

/** Welke vestigingen plekken hebben: het onderdeel Locatie is er alleen voor hen (V73). */
export async function loadGroupsWithSpots(client: DbClient): Promise<string[]> {
  const result = await client.from('parking_spots').select('group_id').eq('is_active', true);
  // Zonder fase 8 in de database: geen plekken, dus geen onderdeel Locatie.
  if (result.error) return [];
  return [...new Set((result.data ?? []).map((row) => row.group_id))];
}
