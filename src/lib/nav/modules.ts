/**
 * De onderdelen van Planbord (besluit V53): Start, Planbord, Mobiliteit en Beheer, elk met eigen tabs.
 * Puur: wie kijkt en welk pad open staat komen binnen als parameter. Een nieuw onderdeel
 * (binnenvallers, meldingen, uitloop) komt hier als extra regel bij.
 */
export type ModuleId = 'start' | 'planbord' | 'mobiliteit' | 'binnenvallers' | 'meldingen' | 'controle' | 'rapporten' | 'beheer';
export type NavIcon =
  | 'home'
  | 'grid'
  | 'timeline'
  | 'calendar'
  | 'clipboard'
  | 'check'
  | 'settings'
  | 'plus'
  | 'archive'
  | 'user'
  | 'counter'
  | 'alert'
  | 'euro'
  | 'car'
  | 'chart';

export interface NavTab {
  href: string;
  label: string;
  icon: NavIcon;
}

export interface NavModule extends NavTab {
  id: ModuleId;
  /** De tabs binnen het onderdeel. Leeg: het onderdeel heeft zijn eigen navigatie (Beheer) of geen (Start). */
  tabs: NavTab[];
}

export interface NavViewer {
  isLead: boolean;
}

const LOANS = '/mobiliteit';

/** De onderdelen die deze kijker ziet, in de volgorde van de zijbalk. */
export function modulesFor(viewer: NavViewer): NavModule[] {
  const modules: NavModule[] = [
    { id: 'start', href: '/', label: 'Start', icon: 'home', tabs: [] },
    {
      id: 'planbord',
      href: '/mijn-rooster',
      label: 'Planbord',
      icon: 'grid',
      tabs: [
        { href: '/mijn-rooster', label: 'Mijn rooster', icon: 'user' },
        { href: '/rooster/den-bosch', label: 'Rooster', icon: 'grid' },
        { href: '/verlof', label: 'Verlof', icon: 'timeline' },
        { href: '/agenda', label: 'Agenda', icon: 'calendar' },
      ],
    },
  ];
  // Mobiliteit (V54): de auto's die verhuur meegeeft. Voor iedere vestiging.
  modules.push({
    id: 'mobiliteit',
    href: LOANS,
    label: 'Mobiliteit',
    icon: 'clipboard',
    tabs: [
      { href: LOANS, label: 'Nu uit', icon: 'clipboard' },
      { href: `${LOANS}/nieuw`, label: 'Aanmelden', icon: 'plus' },
      { href: `${LOANS}/archief`, label: 'Archief', icon: 'archive' },
    ],
  });
  // Fase 6 (V55): binnenvallers en meldingen, voor iedere vestiging.
  modules.push({
    id: 'binnenvallers',
    href: '/binnenvallers',
    label: 'Binnenvallers',
    icon: 'counter',
    tabs: [
      { href: '/binnenvallers', label: 'Vandaag', icon: 'counter' },
      { href: '/binnenvallers/overzicht', label: 'Overzicht', icon: 'grid' },
    ],
  });
  modules.push({
    id: 'meldingen',
    href: '/meldingen',
    label: 'Meldingen',
    icon: 'alert',
    tabs: [
      { href: '/meldingen', label: 'Meldingen', icon: 'alert' },
      { href: '/meldingen/nieuw', label: 'Nieuw', icon: 'plus' },
      { href: '/meldingen/doorbelasten', label: 'Doorbelasten', icon: 'euro' },
      { href: '/meldingen/archief', label: 'Archief', icon: 'archive' },
    ],
  });
  if (viewer.isLead) {
    // Alles wat beheerder en teamleider nakijken, op één plek (V55).
    modules.push({
      id: 'controle',
      href: '/controle',
      label: 'Controle',
      icon: 'check',
      tabs: [
        { href: '/controle', label: 'Invulcontrole', icon: 'check' },
        { href: '/controle/mobiliteit', label: 'Mobiliteit', icon: 'car' },
      ],
    });
    // Fase 7 (V66): de rapporten, per week, maand of jaar.
    modules.push({
      id: 'rapporten',
      href: '/rapporten',
      label: 'Rapporten',
      icon: 'chart',
      tabs: [
        { href: '/rapporten', label: 'Overzicht', icon: 'chart' },
        { href: '/rapporten/binnenvallers', label: 'Binnenvallers', icon: 'counter' },
        { href: '/rapporten/meldingen', label: 'Meldingen', icon: 'alert' },
        { href: '/rapporten/mobiliteit', label: 'Mobiliteit', icon: 'car' },
      ],
    });
    modules.push({ id: 'beheer', href: '/beheer', label: 'Beheer', icon: 'settings', tabs: [] });
  }
  return modules;
}

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** Bij welk onderdeel een pad hoort. Onbekende paden horen bij Start. */
export function moduleOf(path: string): ModuleId {
  if (under(path, LOANS)) return 'mobiliteit';
  if (under(path, '/binnenvallers')) return 'binnenvallers';
  if (under(path, '/meldingen')) return 'meldingen';
  if (under(path, '/controle')) return 'controle';
  if (under(path, '/rapporten')) return 'rapporten';
  if (under(path, '/beheer')) return 'beheer';
  if (['/mijn-rooster', '/rooster', '/verlof', '/agenda'].some((prefix) => under(path, prefix))) return 'planbord';
  return 'start';
}

/** Tabs die het begin van een onderdeel zijn: actief op alles wat niet bij een andere tab hoort. */
const ROOT_TABS = [LOANS, '/binnenvallers', '/meldingen', '/controle', '/rapporten'];

/** Is deze tab actief? Het rooster heeft een pad per vestiging; de eerste tab van een onderdeel vangt de rest. */
export function isActiveTab(tab: NavTab, path: string, siblings: readonly NavTab[] = []): boolean {
  if (tab.href.startsWith('/rooster')) return under(path, '/rooster');
  if (ROOT_TABS.includes(tab.href)) {
    return under(path, tab.href) && !siblings.some((other) => other.href !== tab.href && under(path, other.href));
  }
  return under(path, tab.href);
}

/**
 * De tabbalk onderin op de telefoon: binnen een onderdeel met tabs staat links Start en daarna de
 * tabs; op Start en in Beheer staan de onderdelen zelf. Hooguit vijf.
 */
export function bottomTabs(modules: readonly NavModule[], path: string): NavTab[] {
  const current = modules.find((module) => module.id === moduleOf(path));
  const start = modules[0];
  if (current && start && current.tabs.length > 0) return [start, ...current.tabs].slice(0, 5);
  // Start en Beheer: de onderdelen zelf. Passen ze niet allemaal, dan blijft het huidige in beeld;
  // de rest staat als tegel op Start.
  const shown = modules.slice(0, 5);
  if (current && !shown.includes(current)) shown[shown.length - 1] = current;
  return shown;
}

/** De tabs van het onderdeel waar dit pad bij hoort. */
export function tabsOf(modules: readonly NavModule[], path: string): NavTab[] {
  return modules.find((module) => module.id === moduleOf(path))?.tabs ?? [];
}
