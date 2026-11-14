import { describe, expect, it } from 'vitest';
import { bottomTabs, isActiveTab, moduleOf, modulesFor } from './modules';

const employee = { isLead: false };
const lead = { isLead: true };
const labels = (items: { label: string }[]) => items.map((item) => item.label);

describe('de onderdelen (V53)', () => {
  it('toont Mobiliteit aan iedereen (V54), en Beheer alleen aan beheerder en teamleider', () => {
    expect(labels(modulesFor(employee))).toEqual(['Start', 'Planbord', 'Mobiliteit', 'Binnenvallers', 'Meldingen']);
    expect(labels(modulesFor(lead))).toEqual(['Start', 'Planbord', 'Mobiliteit', 'Binnenvallers', 'Meldingen', 'Controle', 'Rapporten', 'Beheer']);
  });

  it('geeft Controle als eigen onderdeel aan beheerder en teamleider, met de invulcontrole en Mobiliteit (V55)', () => {
    const tabs = (viewer: typeof lead, id: string) => labels(modulesFor(viewer).find((module) => module.id === id)?.tabs ?? []);
    expect(tabs(employee, 'mobiliteit')).toEqual(['Nu uit', 'Aanmelden', 'Archief']);
    expect(tabs(lead, 'controle')).toEqual(['Invulcontrole', 'Mobiliteit']);
    expect(tabs(employee, 'controle')).toEqual([]);
    // Fase 7 (V66): de rapporten, alleen voor beheerder en teamleider.
    expect(tabs(lead, 'rapporten')).toEqual(['Overzicht', 'Binnenvallers', 'Meldingen', 'Mobiliteit']);
    expect(tabs(employee, 'rapporten')).toEqual([]);
    expect(moduleOf('/rapporten/meldingen')).toBe('rapporten');
    // Fase 8 (V73): Locatie alleen met plekken.
    expect(labels(modulesFor({ isLead: false, locations: true }))).toEqual(['Start', 'Planbord', 'Mobiliteit', 'Binnenvallers', 'Meldingen', 'Locatie']);
    expect(tabs({ isLead: false, locations: true } as typeof lead, 'locatie')).toEqual(['Terrein', 'Zoeken']);
    expect(moduleOf('/zoeken')).toBe('locatie');
    expect(tabs(employee, 'meldingen')).toEqual(['Meldingen', 'Nieuw', 'Doorbelasten', 'Archief']);
  });

  it('weet bij welk onderdeel een pad hoort', () => {
    expect(moduleOf('/')).toBe('start');
    expect(moduleOf('/mijn-rooster')).toBe('planbord');
    expect(moduleOf('/rooster/eindhoven')).toBe('planbord');
    expect(moduleOf('/verlof')).toBe('planbord');
    expect(moduleOf('/agenda')).toBe('planbord');
    expect(moduleOf('/mobiliteit/archief')).toBe('mobiliteit');
    expect(moduleOf('/controle/mobiliteit')).toBe('controle');
    expect(moduleOf('/binnenvallers/overzicht')).toBe('binnenvallers');
    expect(moduleOf('/meldingen/nieuw')).toBe('meldingen');
    expect(moduleOf('/registraties/uitleen')).toBe('start');
    expect(moduleOf('/beheer/medewerkers/nieuw')).toBe('beheer');
    expect(moduleOf('/roosters')).toBe('start');
  });

  it('markeert de juiste tab', () => {
    const active = (viewer: typeof lead, id: string, path: string) => {
      const tabs = modulesFor(viewer).find((module) => module.id === id)?.tabs ?? [];
      return tabs.filter((tab) => isActiveTab(tab, path, tabs)).map((tab) => tab.label);
    };
    expect(active(employee, 'mobiliteit', '/mobiliteit')).toEqual(['Nu uit']);
    expect(active(employee, 'mobiliteit', '/mobiliteit/abc/retour')).toEqual(['Nu uit']);
    expect(active(employee, 'mobiliteit', '/mobiliteit/nieuw')).toEqual(['Aanmelden']);
    expect(active(employee, 'mobiliteit', '/mobiliteit/archief')).toEqual(['Archief']);
    expect(active(employee, 'meldingen', '/meldingen/abc')).toEqual(['Meldingen']);
    expect(active(employee, 'meldingen', '/meldingen/doorbelasten')).toEqual(['Doorbelasten']);
    expect(active(lead, 'controle', '/controle')).toEqual(['Invulcontrole']);
    expect(active(lead, 'controle', '/controle/mobiliteit')).toEqual(['Mobiliteit']);
    expect(active(lead, 'rapporten', '/rapporten')).toEqual(['Overzicht']);
    expect(active(lead, 'rapporten', '/rapporten/mobiliteit')).toEqual(['Mobiliteit']);
    expect(active(employee, 'planbord', '/rooster/breda')).toEqual(['Rooster']);
  });

  it('zet onderin Start en de tabs van het onderdeel; op Start en in Beheer de onderdelen', () => {
    expect(labels(bottomTabs(modulesFor(lead), '/'))).toEqual(['Start', 'Planbord', 'Mobiliteit', 'Binnenvallers', 'Meldingen']);
    // In Beheer blijft Beheer zelf in beeld.
    expect(labels(bottomTabs(modulesFor(lead), '/beheer/regelen'))).toEqual(['Start', 'Planbord', 'Mobiliteit', 'Binnenvallers', 'Beheer']);
    expect(labels(bottomTabs(modulesFor(employee), '/verlof'))).toEqual(['Start', 'Mijn rooster', 'Rooster', 'Verlof', 'Agenda']);
    expect(labels(bottomTabs(modulesFor(lead), '/controle'))).toEqual(['Start', 'Invulcontrole', 'Mobiliteit']);
    expect(labels(bottomTabs(modulesFor(employee), '/meldingen'))).toEqual(['Start', 'Meldingen', 'Nieuw', 'Doorbelasten', 'Archief']);
    for (const path of ['/', '/verlof', '/controle', '/beheer', '/meldingen']) expect(bottomTabs(modulesFor(lead), path).length).toBeLessThanOrEqual(5);
  });
});
