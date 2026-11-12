import Link from 'next/link';
import { Notice } from '@/components/ui';
import { formatPlate, normalizePlate } from '@/lib/loans/plates';
import { isDestination } from '@/lib/loans/types';

type Tone = 'success' | 'warning' | 'error';

/** De meldingen na een actie bij de uitleen; {kenteken} wordt het kenteken met streepjes. */
const MESSAGES: Record<string, { tone: Tone; text: string }> = {
  aangemeld: { tone: 'success', text: '{kenteken} is aangemeld.' },
  retour: { tone: 'success', text: '{kenteken} is retour gemeld, ingezet.' },
  'retour-niet-ingezet': { tone: 'success', text: '{kenteken} is retour gemeld, niet ingezet.' },
  'al-retour': { tone: 'warning', text: '{kenteken} was al retour gemeld, misschien door een collega.' },
  'retour-mislukt': { tone: 'error', text: 'Retour melden is niet gelukt. Probeer het opnieuw.' },
  ongedaan: { tone: 'success', text: 'Retour van {kenteken} ongedaan gemaakt: de auto staat weer uit.' },
  'ongedaan-niet-toegestaan': {
    tone: 'warning',
    text: 'Alleen wie de auto retour meldde, kan dat vandaag ongedaan maken. Vraag het anders je teamleider.',
  },
  'ongedaan-weer-uit': {
    tone: 'warning',
    text: 'Ongedaan maken kan niet: {kenteken} staat intussen alweer uit. Laat je teamleider het corrigeren.',
  },
  'ongedaan-mislukt': { tone: 'error', text: 'Ongedaan maken is niet gelukt. Probeer het opnieuw.' },
  gecorrigeerd: { tone: 'success', text: 'Registratie van {kenteken} gecorrigeerd.' },
  verwijderd: { tone: 'success', text: 'Registratie van {kenteken} verwijderd.' },
  'verwijderen-mislukt': { tone: 'error', text: 'Verwijderen is niet gelukt. Probeer het opnieuw.' },
  'niet-gevonden': { tone: 'warning', text: 'Deze uitleen bestaat niet meer.' },
};

export interface FlashParams {
  melding?: string;
  kenteken?: string;
  bestemming?: string;
  aan?: string;
  vestiging?: string;
}

/** De link "Nog een auto aanmelden", met dezelfde vestiging, bestemming en "meegegeven aan" (V46). */
export function nextLoanHref(params: FlashParams): string {
  const query = new URLSearchParams();
  if (isDestination(params.bestemming)) query.set('bestemming', params.bestemming);
  if (params.aan) query.set('aan', params.aan.slice(0, 60));
  if (params.vestiging && /^[a-z_]{1,40}$/.test(params.vestiging)) query.set('vestiging', params.vestiging);
  const text = query.toString();
  return `/registraties/uitleen/nieuw${text ? `?${text}` : ''}`;
}

/** Korte melding na een actie, via ?melding=… in de URL. */
export function LoanFlash({ params }: { params: FlashParams }) {
  const message = params.melding ? MESSAGES[params.melding] : undefined;
  if (!message) return null;
  const plate = params.kenteken ? normalizePlate(params.kenteken) : null;
  const text = message.text.replace('{kenteken}', plate ? formatPlate(plate) : 'De auto');
  return (
    <Notice tone={message.tone} className="mb-4">
      <span>{text}</span>
      {params.melding === 'aangemeld' ? (
        <>
          {' '}
          <Link href={nextLoanHref(params)} className="font-medium underline">
            Nog een auto aanmelden
          </Link>
        </>
      ) : null}
    </Notice>
  );
}
