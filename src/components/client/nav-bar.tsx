'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { IconCalendar, IconGrid, IconHome, IconSettings, IconTimeline } from '../icons';
import { cx } from '../ui';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  match: (path: string) => boolean;
}

const ITEMS: NavItem[] = [
  { href: '/', label: 'Mijn rooster', icon: <IconHome />, match: (path) => path === '/' },
  { href: '/rooster/den-bosch', label: 'Rooster', icon: <IconGrid />, match: (path) => path.startsWith('/rooster') },
  { href: '/verlof', label: 'Verlof', icon: <IconTimeline />, match: (path) => path.startsWith('/verlof') },
  { href: '/agenda', label: 'Agenda', icon: <IconCalendar />, match: (path) => path.startsWith('/agenda') },
];

const ADMIN_ITEM: NavItem = {
  href: '/beheer',
  label: 'Beheer',
  icon: <IconSettings />,
  match: (path) => path.startsWith('/beheer'),
};

/** Tabbalk onderaan op de telefoon, navigatie in de kop op grotere schermen. */
export function NavBar({ isAdmin, variant }: { isAdmin: boolean; variant: 'top' | 'bottom' }) {
  const path = usePathname();
  const items = isAdmin ? [...ITEMS, ADMIN_ITEM] : ITEMS;

  if (variant === 'top') {
    return (
      <nav aria-label="Hoofdmenu" className="hidden items-center gap-1 sm:flex">
        {items.map((item) => {
          const active = item.match(path);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
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
