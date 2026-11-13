'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { bottomTabs, isActiveTab, moduleOf, modulesFor, tabsOf, type NavIcon, type NavTab, type NavViewer } from '@/lib/nav/modules';
import {
  IconAlert,
  IconArchive,
  IconCalendar,
  IconCar,
  IconCheck,
  IconClipboard,
  IconCounter,
  IconEuro,
  IconGrid,
  IconHome,
  IconPlus,
  IconSettings,
  IconTimeline,
  IconUser,
} from '../icons';
import { cx } from '../ui';

const ICONS: Record<NavIcon, ReactNode> = {
  home: <IconHome />,
  grid: <IconGrid />,
  timeline: <IconTimeline />,
  calendar: <IconCalendar />,
  clipboard: <IconClipboard />,
  check: <IconCheck />,
  settings: <IconSettings />,
  plus: <IconPlus />,
  archive: <IconArchive />,
  user: <IconUser />,
  counter: <IconCounter />,
  alert: <IconAlert />,
  euro: <IconEuro />,
  car: <IconCar />,
};

/** Is deze link actief? Een onderdeel als het pad erbij hoort, een tab volgens isActiveTab. */
function useActive(viewer: NavViewer) {
  const path = usePathname();
  const modules = modulesFor(viewer);
  const current = moduleOf(path);
  const isActive = (item: NavTab) => {
    const asModule = modules.find((candidate) => candidate.href === item.href && candidate.label === item.label);
    return asModule && asModule.tabs.length === 0 ? asModule.id === current : isActiveTab(item, path, tabsOf(modules, path));
  };
  return { path, modules, current, isActive };
}

/** De zijbalk met de onderdelen (V53), op een breed scherm. `footer`: Uitleg en Uitloggen. */
export function SideNav({ viewer, footer }: { viewer: NavViewer; footer: ReactNode }) {
  const { modules, current } = useActive(viewer);
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-slate-200 bg-white md:flex">
      <Link href="/" className="flex h-14 items-center px-5 text-lg font-semibold tracking-tight text-brand-800">
        Planbord
      </Link>
      <nav aria-label="Onderdelen" className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {modules.map((module) => {
          const active = module.id === current;
          return (
            <Link
              key={module.id}
              href={module.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                active ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              {ICONS[module.icon]}
              {module.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-slate-200 px-3 py-3">{footer}</div>
    </aside>
  );
}

/** De tabs van het gekozen onderdeel, in de kop op een breed scherm. */
export function ModuleTabs({ viewer }: { viewer: NavViewer }) {
  const { path, modules, current } = useActive(viewer);
  const shown = modules.find((candidate) => candidate.id === current);
  if (!shown) return null;
  return (
    <div className="hidden min-w-0 items-center gap-4 md:flex">
      <p className="text-base font-semibold text-slate-900">{shown.label}</p>
      {shown.tabs.length > 0 ? (
        <nav aria-label={`Menu van ${shown.label}`} className="flex items-center gap-1">
          {shown.tabs.map((tab) => {
            const active = isActiveTab(tab, path, shown.tabs);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'rounded-lg px-3 py-2 text-sm font-medium',
                  active ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

/** De tabbalk onderin op de telefoon: Start en de tabs van het onderdeel, of de onderdelen zelf. */
export function BottomNav({ viewer }: { viewer: NavViewer }) {
  const { path, modules, isActive } = useActive(viewer);
  const items = bottomTabs(modules, path);
  return (
    <nav aria-label="Hoofdmenu" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-lg justify-around">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <li key={`${item.href}:${item.label}`} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 pt-1 text-[11px] font-medium',
                  active ? 'text-brand-700' : 'text-slate-500',
                )}
              >
                {ICONS[item.icon]}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
