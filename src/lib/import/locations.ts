/**
 * De startlijst van Locatie huurauto's inlezen (fase 8, bouwvolgorde 5). Puur: van tabbladen naar
 * een lijst voor `import_locations`. Het bestand heeft een kopregel met Kenteken; de plek staat in de
 * kolom Plek (of Locatie), of anders in de kolom direct na Kenteken. Een kolom Model mag erbij.
 */
import { normalizePlate } from '../loans/plates';
import { cleanModel, cleanSpotName } from '../locations/status';
import { cellText, type CellValue } from './cells';
import type { ImportIssue, RawSheet } from './workbook';

export interface LocationRow {
  plate: string;
  spot: string;
  model: string | null;
}

export interface LocationPlan {
  rows: LocationRow[];
  /** Plekken die er nog niet zijn: die worden toegevoegd. */
  newSpots: string[];
  errors: ImportIssue[];
  notices: ImportIssue[];
}

const key = (value: CellValue) => cellText(value).toLocaleLowerCase('nl');

export function planLocations(sheets: readonly RawSheet[], existingSpots: readonly string[]): LocationPlan {
  const plan: LocationPlan = { rows: [], newSpots: [], errors: [], notices: [] };
  const known = new Map(existingSpots.map((name) => [name.toLocaleLowerCase('nl'), name]));
  for (const sheet of sheets) {
    const headerIndex = sheet.data.findIndex((row) => row.some((cell) => key(cell) === 'kenteken'));
    if (headerIndex < 0) continue;
    const header = (sheet.data[headerIndex] ?? []).map(key);
    const plateColumn = header.indexOf('kenteken');
    const named = header.findIndex((cell) => cell === 'plek' || cell === 'locatie' || cell === 'waar');
    const spotColumn = named >= 0 ? named : plateColumn + 1;
    const modelColumn = header.findIndex((cell) => cell === 'model' || cell === 'auto');
    sheet.data.slice(headerIndex + 1).forEach((cells, offset) => {
      const row = headerIndex + 2 + offset;
      const plateText = cellText(cells[plateColumn]);
      if (plateText === '') return;
      const plate = normalizePlate(plateText);
      if (!plate) {
        plan.notices.push({ sheet: sheet.sheet, row, message: `"${plateText}" is geen kenteken; overgeslagen.` });
        return;
      }
      const spotText = cellText(cells[spotColumn]);
      const spot = cleanSpotName(spotText);
      if (!spot) {
        plan.notices.push({ sheet: sheet.sheet, row, message: spotText === '' ? `${plateText}: geen plek; overgeslagen.` : `${plateText}: de plek is langer dan 20 tekens; overgeslagen.` });
        return;
      }
      const existing = known.get(spot.toLocaleLowerCase('nl'));
      if (!existing) {
        known.set(spot.toLocaleLowerCase('nl'), spot);
        plan.newSpots.push(spot);
      }
      if (plan.rows.some((candidate) => candidate.plate === plate)) {
        plan.notices.push({ sheet: sheet.sheet, row, message: `${plateText} staat er twee keer in; de eerste telt.` });
        return;
      }
      plan.rows.push({ plate, spot: existing ?? spot, model: modelColumn >= 0 ? cleanModel(cellText(cells[modelColumn])) : null });
    });
  }
  if (plan.rows.length === 0) {
    plan.errors.push({ sheet: null, row: null, message: 'Geen auto’s gevonden. Het bestand heeft een kolom Kenteken, met de plek ernaast.' });
  }
  return plan;
}
