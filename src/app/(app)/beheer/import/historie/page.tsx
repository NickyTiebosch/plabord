import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/session';
import { HistoryPanel } from './history-panel';

export const metadata: Metadata = { title: 'Historie inlezen' };

export default async function HistoryPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="Historie inlezen"
        subtitle="De oude Excel-bestanden van binnenvallers en meldingen, één keer. Je ziet eerst een voorvertoning; opslaan doe je daarna."
      />
      <HistoryPanel />
      <ul className="mt-6 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li>
          Kies <strong>Binnenvallers Registratie</strong> of <strong>WPL meldingen dagregistratie</strong>, zoals het team ze gebruikte. Lees ze
          na elkaar in.
        </li>
        <li>Per vestiging een tabblad (Den Bosch, Eindhoven, Breda). Dashboard, Lijsten en Uitleg worden overgeslagen.</li>
        <li>Binnenvallers: een leeg vak is niets ingevuld, een x is 0. Opmerkingen worden niet ingelezen.</li>
        <li>
          Meldingen: Ingevuld door wordt gekoppeld als de voornaam bij precies één collega past. De werkplaatsen moeten bestaan onder Beheer
          → Werkplaatsen.
        </li>
        <li>Opnieuw inlezen maakt geen dubbele regels. Er wordt nooit iets verwijderd.</li>
      </ul>
    </>
  );
}
