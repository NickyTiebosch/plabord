import { describe, expect, it } from 'vitest';
import { groups, settings } from '../engine/__fixtures__/team';
import { planImport } from './plan';
import { importPreview } from './preview';
import { parseWorkbook, type RawSheet } from './workbook';

const sheets: RawSheet[] = [
  {
    sheet: 'Medewerkers',
    data: [
      ['Naam', 'E-mail', 'Groep', 'Rol'],
      ['Fleur', 'fleur@voorbeeld.nl', 'Eindhoven', 'balie'],
      ['Gert', null, 'Logistiek', 'transport'],
    ],
  },
  {
    sheet: 'Vaste roosters',
    data: [
      ['Naam', 'Dag', 'Begintijd', 'Geldig vanaf'],
      ['Fleur', 'ma', '09:00', '1-1-2026'],
    ],
  },
  {
    sheet: 'Afwezigheid',
    data: [
      ['Naam', 'Van', 'Tot', 'Dagdeel', 'Status'],
      ['Gert', '14-10-2026', '16-10-2026', null, 'aangevraagd'],
      ['Onbekend', '14-10-2026', null, null, null],
    ],
  },
];

describe('importPreview', () => {
  it('geeft tellingen, wijzigingen in gewone taal en fouten per regel', () => {
    const current = { settings, groups, employees: [], recurringShifts: [], absences: [] };
    const plan = planImport(parseWorkbook(sheets, groups), current, { importingEmployeeId: null });
    const preview = importPreview(plan, groups);
    expect(preview.summary.employees).toEqual({ create: 2, update: 0, unchanged: 0 });
    expect(preview.changes.map((change) => change.text)).toEqual([
      'Fleur (Eindhoven, met e-mail)',
      'Gert (Logistiek, zonder e-mail)',
      'Fleur, ma vanaf 1 jan 2026: Eindhoven, balie, 09:00–standaard',
      'Gert, 14–16 okt, hele dag, aangevraagd',
    ]);
    expect(preview.errors).toEqual([
      { sheet: 'Afwezigheid', row: 3, message: 'Onbekende naam "Onbekend". Staat die in het tabblad Medewerkers?' },
    ]);
    expect(preview.accountsToCreate).toEqual(['Fleur']);
    expect(preview.canApply).toBe(false);
  });
});
