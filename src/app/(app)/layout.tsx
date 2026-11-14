import Link from 'next/link';
import type { ReactNode } from 'react';
import { BottomNav, ModuleTabs, SideNav } from '@/components/client/app-nav';
import { SubmitButton } from '@/components/client/form-controls';
import { IconHelp, IconLogout, IconSearch } from '@/components/icons';
import { requireViewerWith } from '@/lib/auth/session';
import { loadGroupsWithSpots } from '@/lib/db/location-queries';
import { signOut } from '../actions';

/**
 * Het raamwerk (V53). Breed scherm: links de zijbalk met de onderdelen, in de kop de tabs van het
 * gekozen onderdeel. Telefoon: de kop met de naam, en onderin de tabbalk.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  // Welke vestigingen plekken hebben (fase 8), tegelijk met de controle wie er kijkt (V31).
  const [viewer, spotGroups] = await requireViewerWith(loadGroupsWithSpots);
  const nav = { isLead: viewer.isLead, locations: viewer.isLead ? spotGroups.length > 0 : spotGroups.includes(viewer.groupId) };
  return (
    <div className="min-h-dvh pb-24 md:pb-8 md:pl-56">
      <SideNav
        viewer={nav}
        footer={
          <>
            <Link
              href="/uitleg"
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <IconHelp />
              Uitleg
            </Link>
            <p className="truncate px-3 pt-1 text-sm text-slate-500">{viewer.name}</p>
            <form action={signOut} className="px-1">
              <SubmitButton variant="secondary" size="sm">
                <IconLogout />
                Uitloggen
              </SubmitButton>
            </form>
          </>
        }
      />
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-brand-800 md:hidden">
            Planbord
          </Link>
          <ModuleTabs viewer={nav} />
          {/* Zoeken op kenteken (fase 8, V76), vanaf elke pagina. */}
          <form method="get" action="/zoeken" role="search" className="hidden shrink-0 md:block">
            <label className="sr-only" htmlFor="kop-kenteken">
              Zoeken op kenteken
            </label>
            <input
              id="kop-kenteken"
              name="kenteken"
              placeholder="Kenteken zoeken"
              autoComplete="off"
              className="h-9 w-40 rounded-lg border border-slate-300 bg-white px-3 text-sm uppercase placeholder:normal-case placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </form>
          <div className="flex min-w-0 items-center gap-3 md:hidden">
            <Link href="/zoeken" aria-label="Zoeken op kenteken" className="inline-flex size-11 items-center justify-center text-slate-600 hover:text-brand-800">
              <IconSearch />
            </Link>
            <Link href="/uitleg" className="text-sm font-medium text-brand-700 hover:underline">
              Uitleg
            </Link>
            <span className="max-w-[9rem] truncate text-sm text-slate-600">{viewer.name}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      <BottomNav viewer={nav} />
    </div>
  );
}
