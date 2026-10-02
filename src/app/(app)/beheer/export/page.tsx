import type { Metadata } from 'next';
import { RosterExportForm } from '@/components/roster-export-form';
import { Card, PageHeader, SectionTitle, buttonClass } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/session';
import { addDays, startOfIsoWeek, todayInAmsterdam, weekdayOf } from '@/lib/engine/dates';

export const metadata: Metadata = { title: 'Export' };

/** Beheer → Export (fase 3, V20), en het rooster zelf (V22). */
export default async function ExportPage() {
  await requireAdmin();
  const today = todayInAmsterdam(new Date());
  // Op zondag begint het rooster bij de week erna, net als op het Rooster-scherm.
  const monday = weekdayOf(today) === 7 ? addDays(today, 1) : startOfIsoWeek(today);
  return (
    <>
      <PageHeader title="Export" subtitle="Download de planning of het rooster als Excel-bestand." />
      <Card className="space-y-3 p-4">
        <SectionTitle>Planning exporteren</SectionTitle>
        <p className="text-sm text-slate-700">
          Met de tabbladen en koppen van de import (Medewerkers, Vaste roosters en Afwezigheid), plus Invallen en
          Roosterwijzigingen. Bij Vaste roosters staan de diensten die nu gelden en die nog komen.
        </p>
        <p className="text-sm text-slate-700">
          Het bestand bevat werkmails. Bewaar het zorgvuldig en deel het niet zomaar. Elke export komt in het logboek.
        </p>
        {/* Een gewone link, zodat de browser hem niet vooraf ophaalt: elke klik is één export in het logboek. */}
        <a href="/beheer/export/planning" download className={buttonClass('primary')}>
          Planning downloaden
        </a>
        <p className="text-xs text-slate-500">
          De gegevens van één medewerker download je op de pagina van die medewerker, bijvoorbeeld voor een inzageverzoek.
        </p>
      </Card>
      <Card className="mt-4 space-y-3 p-4">
        <SectionTitle>Rooster exporteren</SectionTitle>
        <p className="text-sm text-slate-700">
          Het rooster zoals op het Rooster-scherm: per vestiging een tabblad, per week wie er werkt. Zonder werkmails. Dit
          kan iedere collega ook onderaan het Rooster-scherm; het komt niet in het logboek.
        </p>
        <RosterExportForm from={monday} />
      </Card>
    </>
  );
}
