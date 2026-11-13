import { describe, expect, it } from 'vitest';
import { bottomTabs, isActiveTab, moduleOf, modulesFor } from './modules';

const employee = { isLead: false };
const lead = { isLead: true };
const labels = (items: { label: string }[]) => items.map((item) => item.label);

describe('de onderdelen (V53)', () => {
  it('toont Mobiliteit aan iedereen (V54), en Beheer alleen aan beheerder en teamleider', () => {
    expect(labels(modulesFor(employee))).toEqual(['Start', 'Planbord', 'Mobiliteit']);
    expect(labels(modulesFor(lead))).toEqual(['Start', 'Planbord', 'Mobiliteit', 'Beheer']);
  });

  it('geeft Controle alleen aan beheerder en teamleider', () => {
    const tabs = (viewer: typeof lead) => labels(modulesFor(viewer).find((module) => module.id === 'mobiliteit')?.tabs ?? []);
    expect(tabs(employee)).toEqual(['Nu uit', 'Aanmelden', 'Archief']);
    expect(tabs(lead)).toEqual(['Nu uit', 'Aanmelden', 'Archief', 'Controle']);
  });

  it('weet bij welk onderdeel een pad hoort', () => {
    expect(moduleOf('/')).toBe('start');
    expect(moduleOf('/mijn-rooster')).toBe('planbord');
    expect(moduleOf('/rooster/eindhoven')).toBe('planbord');
    expect(moduleOf('/verlof')).toBe('planbord');
    expect(moduleOf('/agenda')).toBe('planbord');
    expect(moduleOf('/mobiliteit/archief')).toBe('mobiliteit');
    expect(moduleOf('/controle')).toBe('mobiliteit');
    expect(moduleOf('/registraties/uitleen')).toBe('start');
    expect(moduleOf('/beheer/medewerkers/nieuw')).toBe('beheer');
    expect(moduleOf('/roosters')).toBe('start');
  });

  it('markeert de juiste tab', () => {
    const [nowOut, add, archive] = modulesFor(employee).find((module) => module.id === 'mobiliteit')?.tabs ?? [];
    const active = (path: string) => [nowOut, add, archive].filter((tab) => tab && isActiveTab(tab, path)).map((tab) => tab?.label);
    expect(active('/mobiliteit')).toEqual(['Nu uit']);
    expect(active('/mobiliteit/abc/retour')).toEqual(['Nu uit']);
    expect(active('/mobiliteit/nieuw')).toEqual(['Aanmelden']);
    expect(active('/mobiliteit/archief')).toEqual(['Archief']);
    const roster = modulesFor(employee)[1]?.tabs[1];
    expect(roster && isActiveTab(roster, '/rooster/breda')).toBe(true);
    const mine = modulesFor(employee)[1]?.tabs[0];
    expect(mine && isActiveTab(mine, '/rooster/breda')).toBe(false);
  });

  it('zet onderin Start en de tabs van het onderdeel; op Start en in Beheer de onderdelen', () => {
    expect(labels(bottomTabs(modulesFor(lead), '/'))).toEqual(['Start', 'Planbord', 'Mobiliteit', 'Beheer']);
    expect(labels(bottomTabs(modulesFor(lead), '/beheer/regelen'))).toEqual(['Start', 'Planbord', 'Mobiliteit', 'Beheer']);
    expect(labels(bottomTabs(modulesFor(employee), '/verlof'))).toEqual(['Start', 'Mijn rooster', 'Rooster', 'Verlof', 'Agenda']);
    expect(labels(bottomTabs(modulesFor(lead), '/controle'))).toEqual(['Start', 'Nu uit', 'Aanmelden', 'Archief', 'Controle']);
    for (const path of ['/', '/verlof', '/controle', '/beheer']) expect(bottomTabs(modulesFor(lead), path).length).toBeLessThanOrEqual(5);
  });
});
