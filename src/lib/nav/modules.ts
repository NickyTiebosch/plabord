/**
 * De onderdelen van Planbord (besluit V53): Start, Planbord, Mobiliteit en Beheer, elk met eigen tabs.
 * Puur: wie kijkt en welk pad open staat komen binnen als parameter. Een nieuw onderdeel
 * (binnenvallers, meldingen, uitloop) komt hier als extra regel bij.
 */
export type ModuleId = 'start' | 'planbord' | 'mobiliteit' | 'beheer';
export type NavIcon = 'home' | 'grid' | 'timeline' | 'calendar' | 'clipboard' | 'check' | 'settings' | 'plus' | 'archive' | 'user';

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
      ...(viewer.isLead ? [{ href: '/controle', label: 'Controle', icon: 'check' as const }] : []),
    ],
  });
  if (viewer.isLead) modules.push({ id: 'beheer', href: '/beheer', label: 'Beheer', icon: 'settings', tabs: [] });
  return modules;
}

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** Bij welk onderdeel een pad hoort. Onbekende paden horen bij Start. */
export function moduleOf(path: string): ModuleId {
  if (under(path, LOANS) || under(path, '/controle')) return 'mobiliteit';
  if (under(path, '/beheer')) return 'beheer';
  if (['/mijn-rooster', '/rooster', '/verlof', '/agenda'].some((prefix) => under(path, prefix))) return 'planbord';
  return 'start';
}

/** Is deze tab actief? Het rooster heeft een pad per vestiging; Nu uit is Mobiliteit zonder Aanmelden en Archief. */
export function isActiveTab(tab: NavTab, path: string): boolean {
  if (tab.href.startsWith('/rooster')) return under(path, '/rooster');
  if (tab.href === LOANS) return under(path, LOANS) && !under(path, `${LOANS}/nieuw`) && !under(path, `${LOANS}/archief`);
  return under(path, tab.href);
}

/**
 * De tabbalk onderin op de telefoon: binnen een onderdeel met tabs staat links Start en daarna de
 * tabs; op Start en in Beheer staan de onderdelen zelf. Hooguit vijf.
 */
export function bottomTabs(modules: readonly NavModule[], path: string): NavTab[] {
  const current = modules.find((module) => module.id === moduleOf(path));
  const start = modules[0];
  if (!current || !start || current.tabs.length === 0) return modules.slice(0, 5);
  return [start, ...current.tabs].slice(0, 5);
}
