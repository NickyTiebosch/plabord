import { describe, expect, it } from 'vitest';
import { bottomTabs, isActiveTab, moduleOf, modulesFor } from './modules';

const employee = { isLead: false, usesLoans: false };
const counter = { isLead: false, usesLoans: true };
const lead = { isLead: true, usesLoans: true };
const labels = (items: { label: string }[]) => items.map((item) => item.label);

describe('de onderdelen (V53)', () => {
  it('toont Uitleen alleen aan wie ermee werkt, en Beheer alleen aan beheerder en teamleider (V52)', () => {
    expect(labels(modulesFor(employee))).toEqual(['Start', 'Planbord']);
    expect(labels(modulesFor(counter))).toEqual(['Start', 'Planbord', 'Uitleen']);
    expect(labels(modulesFor(lead))).toEqual(['Start', 'Planbord', 'Uitleen', 'Beheer']);
  });

  it('geeft Controle alleen aan beheerder en teamleider', () => {
    const tabs = (viewer: typeof lead) => labels(modulesFor(viewer).find((module) => module.id === 'uitleen')?.tabs ?? []);
    expect(tabs(counter)).toEqual(['Nu uit', 'Aanmelden', 'Archief']);
    expect(tabs(lead)).toEqual(['Nu uit', 'Aanmelden', 'Archief', 'Controle']);
  });

  it('weet bij welk onderdeel een pad hoort', () => {
    expect(moduleOf('/')).toBe('start');
    expect(moduleOf('/mijn-rooster')).toBe('planbord');
    expect(moduleOf('/rooster/eindhoven')).toBe('planbord');
    expect(moduleOf('/verlof')).toBe('planbord');
    expect(moduleOf('/agenda')).toBe('planbord');
    expect(moduleOf('/registraties/uitleen/archief')).toBe('uitleen');
    expect(moduleOf('/controle')).toBe('uitleen');
    expect(moduleOf('/beheer/medewerkers/nieuw')).toBe('beheer');
    expect(moduleOf('/roosters')).toBe('start');
  });

  it('markeert de juiste tab', () => {
    const [nowOut, add, archive] = modulesFor(counter).find((module) => module.id === 'uitleen')?.tabs ?? [];
    const active = (path: string) => [nowOut, add, archive].filter((tab) => tab && isActiveTab(tab, path)).map((tab) => tab?.label);
    expect(active('/registraties/uitleen')).toEqual(['Nu uit']);
    expect(active('/registraties/uitleen/abc/retour')).toEqual(['Nu uit']);
    expect(active('/registraties/uitleen/nieuw')).toEqual(['Aanmelden']);
    expect(active('/registraties/uitleen/archief')).toEqual(['Archief']);
    const roster = modulesFor(employee)[1]?.tabs[1];
    expect(roster && isActiveTab(roster, '/rooster/breda')).toBe(true);
    const mine = modulesFor(employee)[1]?.tabs[0];
    expect(mine && isActiveTab(mine, '/rooster/breda')).toBe(false);
  });

  it('zet onderin Start en de tabs van het onderdeel; op Start en in Beheer de onderdelen', () => {
    expect(labels(bottomTabs(modulesFor(lead), '/'))).toEqual(['Start', 'Planbord', 'Uitleen', 'Beheer']);
    expect(labels(bottomTabs(modulesFor(lead), '/beheer/regelen'))).toEqual(['Start', 'Planbord', 'Uitleen', 'Beheer']);
    expect(labels(bottomTabs(modulesFor(employee), '/verlof'))).toEqual(['Start', 'Mijn rooster', 'Rooster', 'Verlof', 'Agenda']);
    expect(labels(bottomTabs(modulesFor(lead), '/controle'))).toEqual(['Start', 'Nu uit', 'Aanmelden', 'Archief', 'Controle']);
    for (const path of ['/', '/verlof', '/controle', '/beheer']) expect(bottomTabs(modulesFor(lead), path).length).toBeLessThanOrEqual(5);
  });
});
