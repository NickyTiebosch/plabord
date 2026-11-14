import { describe, expect, it } from 'vitest';
import { createClosureResolver } from '../engine/closures';
import { amsterdamInstant } from '../loans/time';
import { parseIncidentForm, parseWorkshopName } from './forms';
import { canEditOwn, chargeList, completionGrid, needsReminder, recentDays, shouldCharge, walkInRows } from './status';
import type { DayClosure, Incident, WalkIn, Workshop } from './types';

const noClosures = createClosureResolver([]);
const at = (date: string, time: string) => amsterdamInstant(date, time as never).toISOString();
const workshops: Workshop[] = [
  { id: 'vw', groupId: 'den_bosch', name: 'Volkswagen', sortOrder: 1, isActive: true },
  { id: 'audi', groupId: 'den_bosch', name: 'Audi', sortOrder: 2, isActive: true },
  { id: 'oud', groupId: 'den_bosch', name: 'Oud', sortOrder: 3, isActive: false },
  { id: 'vw-e', groupId: 'eindhoven', name: 'Volkswagen', sortOrder: 1, isActive: true },
];
const groups = [
  { id: 'den_bosch', name: 'Den Bosch' },
  { id: 'eindhoven', name: 'Eindhoven' },
];

function incident(overrides: Partial<Incident> & { id: string }): Incident {
  return {
    groupId: 'den_bosch',
    workshopId: 'vw',
    occurredAt: at('2026-11-12', '09:00'),
    kind: 'cancellation',
    missing: null,
    cancelledAt: '12:00',
    charge: true,
    chargedAt: null,
    chargedBy: null,
    plate: null,
    contractNumber: null,
    note: null,
    reportedBy: 'sanne',
    createdAt: at('2026-11-12', '09:00'),
    ...overrides,
  };
}

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ workshopId: 'vw', kind: 'wrong_vehicle', date: '2026-11-12', time: '09:15', ...values })) {
    data.set(key, value);
  }
  return data;
}
const options = { now: amsterdamInstant('2026-11-12', '10:00'), workshops, chargeFrom: '11:00' as const };

describe('doorbelasten (V58)', () => {
  it('belast door vanaf het ingestelde tijdstip', () => {
    expect(shouldCharge('10:59', '11:00')).toBe(false);
    expect(shouldCharge('11:00', '11:00')).toBe(true);
    expect(shouldCharge('17:32', '11:00')).toBe(true);
  });
});

describe('het formulier van een melding (V58)', () => {
  it('leest een eenvoudige melding en zet het kenteken om', () => {
    const parsed = parseIncidentForm(form({ plate: 'ghp-39-k', contractNumber: ' 681613 ', note: '  Stond  klaar ' }), options);
    expect(parsed.ok && parsed.data).toMatchObject({
      groupId: 'den_bosch',
      workshopId: 'vw',
      kind: 'wrong_vehicle',
      plate: 'GHP39K',
      contractNumber: '681613',
      note: 'Stond klaar',
      missing: null,
      cancelledAt: null,
      charge: null,
    });
  });

  it('vraagt bij contract of rijbewijs wat er ontbrak', () => {
    const without = parseIncidentForm(form({ kind: 'contract_license' }), options);
    expect(!without.ok && without.state.fieldErrors?.missing).toBeTruthy();
    const withIt = parseIncidentForm(form({ kind: 'contract_license', missing: 'license_check' }), options);
    expect(withIt.ok && withIt.data.missing).toBe('license_check');
  });

  it('zet doorbelasten bij een annulering volgens de regel, tenzij je het omzet', () => {
    const early = parseIncidentForm(form({ kind: 'cancellation', cancelledAt: '09:17' }), options);
    expect(early.ok && early.data.charge).toBe(false);
    const late = parseIncidentForm(form({ kind: 'cancellation', cancelledAt: '11:52' }), options);
    expect(late.ok && late.data.charge).toBe(true);
    const overruled = parseIncidentForm(form({ kind: 'cancellation', cancelledAt: '11:52', charge: 'nee' }), options);
    expect(overruled.ok && overruled.data.charge).toBe(false);
    const missingTime = parseIncidentForm(form({ kind: 'cancellation' }), options);
    expect(!missingTime.ok && missingTime.state.fieldErrors?.cancelledAt).toBeTruthy();
  });

  it('weigert een onbekende werkplaats, een moment in de toekomst en een ongeldig kenteken', () => {
    const parsed = parseIncidentForm(form({ workshopId: 'x', date: '2026-11-13', plate: '!' }), options);
    expect(!parsed.ok && Object.keys(parsed.state.fieldErrors ?? {}).sort()).toEqual(['date', 'plate', 'workshopId']);
  });

  it('controleert de naam van een werkplaats', () => {
    expect(parseWorkshopName('  Carlux   Best ')).toBe('Carlux Best');
    expect(parseWorkshopName('')).toBeNull();
    expect(parseWorkshopName('x'.repeat(41))).toBeNull();
  });
});

describe('zelf corrigeren (V59)', () => {
  it('mag de maker op dezelfde dag, en de teamleider altijd', () => {
    const item = { ownerId: 'sanne', createdAt: at('2026-11-12', '09:00') };
    expect(canEditOwn(item, { employeeId: 'sanne', isLead: false }, '2026-11-12')).toBe(true);
    expect(canEditOwn(item, { employeeId: 'sanne', isLead: false }, '2026-11-13')).toBe(false);
    expect(canEditOwn(item, { employeeId: 'joris', isLead: false }, '2026-11-12')).toBe(false);
    expect(canEditOwn(item, { employeeId: 'tess', isLead: true }, '2026-11-20')).toBe(true);
  });
});

describe('binnenvallers (V57)', () => {
  it('toont de actieve werkplaatsen van de vestiging, en een inactieve alleen als die die dag telt', () => {
    const walkIns: WalkIn[] = [
      { groupId: 'den_bosch', workshopId: 'audi', date: '2026-11-12', count: 3, updatedBy: null, updatedAt: '' },
      { groupId: 'den_bosch', workshopId: 'oud', date: '2026-11-11', count: 2, updatedBy: null, updatedAt: '' },
    ];
    expect(walkInRows(workshops, walkIns, 'den_bosch', '2026-11-12').map((row) => [row.workshop.name, row.count])).toEqual([
      ['Volkswagen', 0],
      ['Audi', 3],
    ]);
    expect(walkInRows(workshops, walkIns, 'den_bosch', '2026-11-11').map((row) => row.workshop.name)).toEqual(['Volkswagen', 'Audi', 'Oud']);
  });
});

describe('de invulcontrole (V61)', () => {
  const closures: DayClosure[] = [
    { groupId: 'den_bosch', date: '2026-11-10', rentlinkChecked: true, closedBy: 'sanne', closedAt: '' },
    { groupId: 'den_bosch', date: '2026-11-12', rentlinkChecked: false, closedBy: 'sanne', closedAt: '' },
  ];
  const first = new Map([['den_bosch', '2026-11-10']]);

  it('geeft de laatste dagen van maandag tot en met zaterdag, nieuwste eerst', () => {
    expect(recentDays('2026-11-16', 4)).toEqual(['2026-11-16', '2026-11-14', '2026-11-13', '2026-11-12']);
  });

  it('kleurt per vestiging per dag', () => {
    const days = ['2026-11-13', '2026-11-12', '2026-11-11', '2026-11-10', '2026-11-09', '2026-11-07'];
    const data = { closures, walkIns: [], incidents: [incident({ id: 'a', occurredAt: at('2026-11-11', '10:00') })] };
    const [bosch, eindhoven] = completionGrid(groups, days, '2026-11-13', data, noClosures, first);
    expect(bosch?.cells.map((cell) => cell.state)).toEqual(['pending', 'closed', 'open', 'closed', 'before', 'weekend']);
    expect(bosch?.open).toBe(1);
    expect(bosch?.cells[2]).toMatchObject({ incidents: 1, walkIns: 0 });
    expect(bosch?.cells[3]?.rentlinkChecked).toBe(true);
    // Eindhoven sloot nog nooit een dag af: niets rood.
    expect(eindhoven?.cells.map((cell) => cell.state)).toEqual(['before', 'before', 'before', 'before', 'before', 'weekend']);
  });

  it('telt een zaterdag mee zodra er iets is geregistreerd, en een sluitingsdag nooit', () => {
    const walkIns: WalkIn[] = [{ groupId: 'den_bosch', workshopId: 'vw', date: '2026-11-14', count: 1, updatedBy: null, updatedAt: '' }];
    const shut = createClosureResolver([{ id: 'c', date: '2026-11-13', groupId: null, isClosed: true, label: 'Dicht' }]);
    const [bosch] = completionGrid(groups, ['2026-11-14', '2026-11-13'], '2026-11-16', { closures, walkIns, incidents: [] }, shut, first);
    expect(bosch?.cells.map((cell) => cell.state)).toEqual(['open', 'shut']);
  });

  it('herinnert alleen als vandaag nog open staat en het tijd is', () => {
    const grid = (today: string) => completionGrid(groups, [today], today, { closures, walkIns: [], incidents: [] }, noClosures, first)[0];
    expect(needsReminder(grid('2026-11-13'), '2026-11-13', '15:59', '16:00')).toBe(false);
    expect(needsReminder(grid('2026-11-13'), '2026-11-13', '16:00', '16:00')).toBe(true);
    expect(needsReminder(grid('2026-11-13'), '2026-11-13', '17:00', null)).toBe(false);
    expect(needsReminder(grid('2026-11-12'), '2026-11-12', '17:00', '16:00')).toBe(false);
  });
});

describe('de doorbelastlijst (V62)', () => {
  it('toont alleen annuleringen die doorbelast moeten worden, de openstaande oudste eerst', () => {
    const list = chargeList([
      incident({ id: 'b', occurredAt: at('2026-11-12', '09:00') }),
      incident({ id: 'a', occurredAt: at('2026-11-10', '09:00') }),
      incident({ id: 'c', charge: false }),
      incident({ id: 'd', kind: 'late_return', charge: null, cancelledAt: null }),
      incident({ id: 'e', chargedAt: at('2026-11-12', '12:00') }),
    ]);
    expect(list.open.map((item) => item.id)).toEqual(['a', 'b']);
    expect(list.done.map((item) => item.id)).toEqual(['e']);
  });
});
