'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { IconCalendar, IconCheck, IconClipboard, IconGrid, IconHome, IconMore, IconSettings, IconTimeline } from '../icons';
import { cx } from '../ui';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  match: (path: string) => boolean;
}

const HOME: NavItem = { href: '/', label: 'Mijn rooster', icon: <IconHome />, match: (path) => path === '/' };
const ROSTER: NavItem = { href: '/rooster/den-bosch', label: 'Rooster', icon: <IconGrid />, match: (path) => path.startsWith('/rooster') };
const LEAVE: NavItem = { href: '/verlof', label: 'Verlof', icon: <IconTimeline />, match: (path) => path.startsWith('/verlof') };
const REGISTRATIONS: NavItem = {
  href: '/registraties/uitleen',
  label: 'Registraties',
  icon: <IconClipboard />,
  match: (path) => path.startsWith('/registraties'),
};
const AGENDA: NavItem = { href: '/agenda', label: 'Agenda', icon: <IconCalendar />, match: (path) => path.startsWith('/agenda') };
const CHECK: NavItem = { href: '/controle', label: 'Controle', icon: <IconCheck />, match: (path) => path.startsWith('/controle') };
const ADMIN: NavItem = { href: '/beheer', label: 'Beheer', icon: <IconSettings />, match: (path) => path.startsWith('/beheer') };
/** Op de telefoon staan Agenda, Uitleg, Controle en Beheer onder Meer (fase 5, V44). */
const MORE: NavItem = {
  href: '/meer',
  label: 'Meer',
  icon: <IconMore />,
  match: (path) => ['/meer', '/agenda', '/controle', '/beheer'].some((prefix) => path.startsWith(prefix)),
};

/**
 * Tabbalk onderaan op de telefoon, navigatie in de kop op grotere schermen. Op de telefoon passen
 * vijf tabs; de rest staat onder Meer. In de kop is ruimte voor alles.
 */
export function NavBar({ isLead, variant }: { isLead: boolean; variant: 'top' | 'bottom' }) {
  const path = usePathname();

  if (variant === 'top') {
    // Op een smal scherm (tablet) staat de rest onder Meer; vanaf een breed scherm alles los.
    const items: { item: NavItem; show: string }[] = [
      ...[HOME, ROSTER, LEAVE, REGISTRATIONS].map((item) => ({ item, show: 'inline-flex' })),
      ...[AGENDA, ...(isLead ? [CHECK, ADMIN] : [])].map((item) => ({ item, show: 'hidden lg:inline-flex' })),
      { item: MORE, show: 'inline-flex lg:hidden' },
    ];
    return (
      <nav aria-label="Hoofdmenu" className="hidden items-center gap-1 sm:flex">
        {items.map(({ item, show }) => {
          const active = item.match(path);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                show,
                'rounded-lg px-3 py-2 text-sm font-medium',
                active ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  const items = [HOME, ROSTER, LEAVE, REGISTRATIONS, MORE];
  return (
    <nav
      aria-label="Hoofdmenu"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden"
    >
      <ul className="mx-auto flex max-w-lg justify-around">
        {items.map((item) => {
          const active = item.match(path);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 pt-1 text-[11px] font-medium',
                  active ? 'text-brand-700' : 'text-slate-500',
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
