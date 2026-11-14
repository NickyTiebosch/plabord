'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '../ui';

interface AdminNavItem {
  href: string;
  label: string;
  exact?: boolean;
  /** Ook voor de teamleider (fase 5, V43). De rest is alleen voor beheerders. */
  lead?: boolean;
}

const ITEMS: AdminNavItem[] = [
  { href: '/beheer', label: 'Overzicht', exact: true, lead: true },
  { href: '/beheer/afwezigheid', label: 'Afwezigheid', lead: true },
  { href: '/beheer/invallen', label: 'Invallen', lead: true },
  { href: '/beheer/medewerkers', label: 'Medewerkers' },
  { href: '/beheer/sluitingsdagen', label: 'Sluitingsdagen' },
  { href: '/beheer/werkplaatsen', label: 'Werkplaatsen' },
  { href: '/beheer/plekken', label: 'Plekken' },
  { href: '/beheer/instellingen', label: 'Instellingen' },
  { href: '/beheer/import', label: 'Import' },
  { href: '/beheer/export', label: 'Export' },
  { href: '/beheer/mails', label: 'Mails' },
  { href: '/beheer/logboek', label: 'Logboek' },
];

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const items = isAdmin ? ITEMS : ITEMS.filter((item) => item.lead);
  return (
    <nav aria-label="Beheer" className="-mx-4 mb-5 overflow-x-auto px-4">
      <ul className="flex w-max gap-1 rounded-xl bg-slate-100 p-1">
        {items.map((item) => {
          const active = item.exact ? path === item.href : path.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap',
                  active ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
