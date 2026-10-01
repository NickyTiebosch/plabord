import type { Metadata } from 'next';
import { PageHeader, buttonClass } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/session';
import { ImportPanel } from './import-panel';

export const metadata: Metadata = { title: 'Excel-import' };

export default async function ImportPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="Excel-import"
        subtitle="Medewerkers, vaste roosters en afwezigheid in één keer. Je ziet eerst een voorvertoning; opslaan doe je daarna."
        actions={
          // Een gewone link: het sjabloon is een download.
          <a href="/beheer/import/sjabloon" className={buttonClass('secondary')}>
            Leeg sjabloon downloaden
          </a>
        }
      />
      <ImportPanel />
      <ul className="mt-6 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li>Tabbladen: Medewerkers, Vaste roosters en Afwezigheid. Andere tabbladen en kolommen met “(info)” worden overgeslagen.</li>
        <li>Datums als Excel-datum of d-m-jjjj, tijden als Excel-tijd of uu:mm.</li>
        <li>Opnieuw importeren maakt geen dubbelingen. De import verwijdert of deactiveert nooit iets.</li>
        <li>Iedereen met een e-mailadres krijgt een inlogaccount.</li>
      </ul>
    </>
  );
}
