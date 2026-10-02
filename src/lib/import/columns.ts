/**
 * De tabbladen en kopnamen van het Excel-bestand. Dezelfde definitie gebruiken de import en het sjabloon.
 */

export interface ColumnSpec<K extends string = string> {
  key: K;
  header: string;
  /** Moet als kolom in het tabblad staan. */
  required: boolean;
  /** Andere schrijfwijzen die we ook herkennen. */
  aliases?: readonly string[];
  /** Korte uitleg voor het sjabloon. */
  hint: string;
}

export const EMPLOYEE_COLUMNS = [
  { key: 'name', header: 'Naam', required: true, hint: 'Uniek; hoofdletters tellen niet mee.' },
  {
    key: 'email',
    header: 'E-mail',
    required: false,
    aliases: ['email', 'e-mailadres', 'werkmail'],
    hint: 'Werkmail. Leeg = staat wel in het rooster, maar kan (nog) niet inloggen.',
  },
  {
    key: 'group',
    header: 'Groep',
    required: true,
    hint: 'Den Bosch, Eindhoven, Breda, Logistiek, Backoffice of Overig.',
  },
  { key: 'role', header: 'Rol', required: false, hint: 'balie, backoffice, transport, hiker/buitendienst of leeg (geen rol).' },
  {
    key: 'counterGroups',
    header: 'Inzetbaar aan de balie in',
    required: false,
    aliases: ['inzetbaar'],
    hint: 'Vestigingen, gescheiden door komma’s. Leeg = nergens.',
  },
  { key: 'admin', header: 'Beheerder', required: false, hint: 'ja of nee. Leeg = nee.' },
] as const satisfies readonly ColumnSpec[];

export const SHIFT_COLUMNS = [
  { key: 'name', header: 'Naam', required: true, hint: 'Zoals in het tabblad Medewerkers.' },
  { key: 'day', header: 'Dag', required: true, aliases: ['weekdag'], hint: 'ma, di, wo, do, vr of za.' },
  { key: 'group', header: 'Groep', required: false, hint: 'Leeg = de groep van de medewerker.' },
  { key: 'role', header: 'Rol', required: false, hint: 'Leeg = de standaardrol van de medewerker.' },
  { key: 'start', header: 'Begintijd', required: false, hint: 'uu:mm. Leeg = standaarddienst.' },
  { key: 'end', header: 'Eindtijd', required: false, hint: 'uu:mm. Leeg = standaarddienst.' },
  { key: 'validFrom', header: 'Geldig vanaf', required: true, hint: 'Datum (d-m-jjjj).' },
] as const satisfies readonly ColumnSpec[];

export const ABSENCE_COLUMNS = [
  { key: 'name', header: 'Naam', required: true, hint: 'Zoals in het tabblad Medewerkers.' },
  { key: 'from', header: 'Van', required: true, hint: 'Datum (d-m-jjjj).' },
  { key: 'to', header: 'Tot', required: false, hint: 'Datum, t/m. Leeg = dezelfde dag als Van.' },
  { key: 'dayPart', header: 'Dagdeel', required: false, hint: 'hele dag, ochtend of middag. Leeg = hele dag.' },
  { key: 'status', header: 'Status', required: false, hint: 'goedgekeurd of aangevraagd. Leeg = goedgekeurd.' },
] as const satisfies readonly ColumnSpec[];

export const SHEET_NAMES = {
  employees: 'Medewerkers',
  shifts: 'Vaste roosters',
  absences: 'Afwezigheid',
} as const;

export type SheetKey = keyof typeof SHEET_NAMES;

/** Maximaal aantal regels per tabblad. */
export const MAX_ROWS_PER_SHEET = 5000;

/** Maximale bestandsgrootte van de import. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
