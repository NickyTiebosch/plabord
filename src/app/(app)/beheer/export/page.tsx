import type { Metadata } from 'next';
import { Card, PageHeader, SectionTitle, buttonClass } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Export' };

/** Beheer → Export (fase 3, V20). */
export default async function ExportPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Export" subtitle="Download de planning als Excel-bestand. Elke export komt in het logboek." />
      <Card className="space-y-3 p-4">
        <SectionTitle>Planning exporteren</SectionTitle>
        <p className="text-sm text-slate-700">
          Met de tabbladen en koppen van de import (Medewerkers, Vaste roosters en Afwezigheid), plus Invallen en
          Roosterwijzigingen. Bij Vaste roosters staan de diensten die nu gelden en die nog komen.
        </p>
        <p className="text-sm text-slate-700">
          Het bestand bevat werkmails. Bewaar het zorgvuldig en deel het niet zomaar.
        </p>
        {/* Een gewone link, zodat de browser hem niet vooraf ophaalt: elke klik is één export in het logboek. */}
        <a href="/beheer/export/planning" download className={buttonClass('primary')}>
          Planning downloaden
        </a>
        <p className="text-xs text-slate-500">
          De gegevens van één medewerker download je op de pagina van die medewerker, bijvoorbeeld voor een inzageverzoek.
        </p>
      </Card>
    </>
  );
}
