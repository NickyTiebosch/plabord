/**
 * Locatie van huurauto's (fase 8): de plekken per vestiging en waar een auto nu staat.
 */
export interface ParkingSpot {
  id: string;
  groupId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface VehicleLocation {
  /** Genormaliseerd: hoofdletters, zonder streepjes (GHP39K). */
  plate: string;
  groupId: string;
  spotId: string;
  model: string | null;
  /** Wie de auto het laatst verzette; `null` als die medewerker is verwijderd. */
  movedBy: string | null;
  movedAt: string;
}
