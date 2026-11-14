import { describe, expect, it } from 'vitest';
import type { Workshop } from '../registrations/types';
import { planHistory, type HistoryContext } from './history';
import type { RawSheet } from './workbook';

// Fictieve gegevens in de opbouw van de oude bestanden.
const workshops: Workshop[] = [
  { id: 'db-vw', groupId: 'den_bosch', name: 'Volkswagen', sortOrder: 1, isActive: true },
  { id: 'db-audi', groupId: 'den_bosch', name: 'Audi', sortOrder: 2, isActive: true },
  { id: 'db-oss', groupId: 'den_bosch', name: 'Oss', sortOrder: 3, isActive: true },
  { id: 'e-vw', groupId: 'eindhoven', name: 'Volkswagen', sortOrder: 1, isActive: true },
  { id: 'e-audi', groupId: 'eindhoven', name: 'Audi', sortOrder: 2, isActive: true },
];
const context: HistoryContext = {
  groups: [
    { id: 'den_bosch', name: 'Den Bosch' },
    { id: 'eindhoven', name: 'Eindhoven' },
  ],
  workshops,
  employees: [
    { id: 'sanne', name: 'Sanne de Wit' },
    { id: 'joris', name: 'Joris' },
    { id: 'fleur-1', name: 'Fleur Jansen' },
    { id: 'fleur-2', name: 'Fleur Bakker' },
  ],
  chargeFrom: '11:00',
  today: '2026-11-13',
};
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const t = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(1899, 11, 30, h, m));
};

const walkInSheet: RawSheet = {
  sheet: 'Den Bosch',
  data: [
    ['Binnenvallers  •  Den Bosch'],
    ['Zoek de gele rij van vandaag…'],
    [],
    ['Datum', 'Dag', 'Wk', 'Volkswagen', 'Audi', 'Oss', 'Totaal', 'Mnd'],
    [d('2026-07-09'), 'do', 28, 3, 'x', null, 3, 7],
    [d('2026-07-10'), 'vr', 28, null, null, null, 0, 7],
    [d('2026-07-13'), 'ma', 29, 2, 1, ' ', 3, 7],
    [d('2026-11-20'), 'vr', 47, 4, null, null, 4, 11],
    [null, 'Totaal jaar', null, 5, 1, 0, 6, null],
  ],
};

const incidentSheet: RawSheet = {
  sheet: 'Eindhoven',
  data: [
    ['Werkplaatsmeldingen  •  Eindhoven'],
    ['Eén regel per melding.'],
    [],
    ['Datum', 'Dag', 'Wk', 'Werkplaats', 'Soort melding', 'Wat ontbrak?', 'Tijdstip\nannulering', 'Doorbelasten', 'Kenteken', 'Contract-/\nreserveringsnr', 'Bijzonderheden', 'Ingevuld\ndoor'],
    [d('2026-10-01'), 'do', 40, 'audi', 'Annulering door werkplaats', null, t('12:04'), null, 'grh-31-p', 683319, 'Klant niet gekomen', 'Joris '],
    [d('2026-10-02'), 'vr', 40, 'Volkswagen', 'Annulering door werkplaats', null, t('12:30'), 'Nee', null, null, null, 'Fleur'],
    [d('2026-10-03'), 'za', 40, 'Volkswagen', 'Contract/rijbewijs niet in orde', 'Beide', null, null, 'X-221-LB', '687980', null, 'Sanne'],
    [d('2026-10-05'), 'ma', 41, 'Volkswagen', 'Annulering door werkplaats', null, null, null, null, null, null, 'Onbekend'],
    [null, null, null, null, null, null, null, null, null, null, null, null],
    [d('2026-10-06'), 'di', 41, 'Veldhoven', 'Verkeerde auto meegegeven', null, null, null, null, null, null, null],
  ],
};

describe('planHistory: binnenvallers', () => {
  const plan = planHistory([walkInSheet], context);

  it('leest getallen en x als 0, en slaat lege vakken over', () => {
    expect(plan.walkIns).toEqual([
      { workshop_id: 'db-vw', date: '2026-07-09', count: 3 },
      { workshop_id: 'db-audi', date: '2026-07-09', count: 0 },
      { workshop_id: 'db-vw', date: '2026-07-13', count: 2 },
      { workshop_id: 'db-audi', date: '2026-07-13', count: 1 },
    ]);
  });

  it('slaat de dagen na vandaag en de regel Totaal jaar over', () => {
    expect(plan.walkIns.some((row) => row.date === '2026-11-20')).toBe(false);
    expect(plan.notices.some((notice) => notice.message.includes('na vandaag'))).toBe(true);
    expect(plan.errors).toEqual([]);
  });

  it('vat per vestiging samen', () => {
    expect(plan.summary).toEqual([
      { groupId: 'den_bosch', name: 'Den Bosch', walkInDays: 2, walkInTotal: 6, incidents: 0, from: '2026-07-09', to: '2026-07-13' },
    ]);
  });

  it('geeft een fout bij een onbekende werkplaats in de kop en bij een vreemde waarde', () => {
    const sheet: RawSheet = {
      sheet: 'Den Bosch',
      data: [['Datum', 'Dag', 'Wk', 'Volkswagen', 'Carlux', 'Totaal'], [d('2026-07-09'), 'do', 28, 'drie', 1, 1]],
    };
    const result = planHistory([sheet], context);
    expect(result.errors.map((error) => error.message)).toEqual([
      expect.stringContaining('Werkplaats "Carlux" bestaat niet bij Den Bosch'),
      expect.stringContaining('"drie" is geen aantal'),
    ]);
  });
});

describe('planHistory: meldingen', () => {
  const plan = planHistory([incidentSheet], context);

  it('leest een annulering: werkplaats zonder hoofdletters, tijdstip, doorbelasten volgens de regel', () => {
    expect(plan.incidents[0]).toEqual({
      workshop_id: 'e-audi',
      occurred_at: '2026-10-01T10:04:00.000Z',
      kind: 'cancellation',
      missing: null,
      cancelled_at: '12:04',
      charge: true,
      license_plate: 'GRH31P',
      contract_number: '683319',
      note: 'Klant niet gekomen',
      reported_by: 'joris',
      import_key: 'wpl:eindhoven:5',
    });
  });

  it('volgt Doorbelasten uit het bestand als dat is ingevuld', () => {
    expect(plan.incidents[1]).toMatchObject({ charge: false, cancelled_at: '12:30', reported_by: null });
  });

  it('leest contract/rijbewijs met wat ontbrak, om 12:00 op die dag', () => {
    expect(plan.incidents[2]).toMatchObject({
      kind: 'contract_license',
      missing: 'both',
      occurred_at: '2026-10-03T10:00:00.000Z',
      license_plate: 'X221LB',
      reported_by: 'sanne',
    });
  });

  it('een annulering zonder tijdstip en zonder Doorbelasten wordt niet doorbelast, met een opmerking', () => {
    expect(plan.incidents[3]).toMatchObject({ charge: false, cancelled_at: null });
    expect(plan.notices.some((notice) => notice.row === 8 && notice.message.includes('zonder tijdstip'))).toBe(true);
  });

  it('slaat lege regels over en meldt een onbekende werkplaats als fout', () => {
    expect(plan.incidents).toHaveLength(4);
    expect(plan.errors).toEqual([{ sheet: 'Eindhoven', row: 10, message: expect.stringContaining('Werkplaats "Veldhoven" bestaat niet') }]);
  });

  it('koppelt een voornaam alleen als die bij één collega past', () => {
    const notice = plan.notices.find((entry) => entry.message.startsWith('Ingevuld door niet gekoppeld'));
    expect(notice?.message).toContain('Fleur, Onbekend');
  });

  it('slaat andere tabbladen over en geeft een fout als er niets te lezen is', () => {
    const result = planHistory([{ sheet: 'Dashboard', data: [['Binnenvallers Dashboard']] }], context);
    expect(result.skippedSheets).toEqual(['Dashboard']);
    expect(result.errors[0]?.message).toContain('Geen binnenvallers of meldingen gevonden');
  });

  it('kort lange bijzonderheden in en slaat een ongeldig kenteken over', () => {
    const sheet: RawSheet = {
      sheet: 'Eindhoven',
      data: [
        incidentSheet.data[3] ?? [],
        [d('2026-10-01'), 'do', 40, 'Audi', 'Verkeerde auto meegegeven', null, null, null, '?', null, 'a'.repeat(400), null],
      ],
    };
    const result = planHistory([sheet], context);
    expect(result.incidents[0]?.note).toHaveLength(300);
    expect(result.incidents[0]?.license_plate).toBeNull();
    expect(result.notices.map((notice) => notice.message)).toEqual(
      expect.arrayContaining([expect.stringContaining('geen kenteken'), expect.stringContaining('ingekort')]),
    );
  });
});
