import { Notice } from '@/components/ui';
import type { Employee, Group } from '@/lib/engine/types';
import { compareByNameThenId, compareGroups } from '@/lib/engine/sort';
import type { EmployeeOption } from './afwezigheid/absence-form';

const MESSAGES: Record<string, { tone: 'success' | 'warning' | 'error'; text: string }> = {
  opgeslagen: { tone: 'success', text: 'Opgeslagen.' },
  verwijderd: { tone: 'success', text: 'Verwijderd.' },
  aangemaakt: { tone: 'success', text: 'Medewerker aangemaakt.' },
  'account-aangemaakt': { tone: 'success', text: 'Inlogaccount aangemaakt.' },
  'account-mislukt': {
    tone: 'warning',
    text: 'De medewerker is opgeslagen, maar het inlogaccount kon niet worden aangemaakt. Probeer het hieronder opnieuw.',
  },
  deels: {
    tone: 'warning',
    text: 'De medewerker is aangemaakt, maar niet alles is opgeslagen. Controleer het e-mailadres en de inzetbaarheid.',
  },
  // Fase 2: invallen, gaten en roosterwijzigingen.
  ingezet: {
    tone: 'success',
    text: 'Inval ingezet. Hij staat nu in beide roosters en in de agenda van de invaller. Laat het de invaller ook even weten.',
  },
  'inval-ongeldig': { tone: 'error', text: 'Dat ging niet: de gegevens klopten niet. Probeer het opnieuw.' },
  'inval-verleden': { tone: 'error', text: 'Een inval in het verleden kan niet meer.' },
  'geen-gat-meer': { tone: 'warning', text: 'Er is hier geen gat meer. Iemand anders heeft het misschien al geregeld.' },
  'inval-niet-meer-geldig': {
    tone: 'warning',
    text: 'Deze collega kan intussen niet meer invallen. Hieronder staan de voorstellen van nu.',
  },
  'inval-mislukt': { tone: 'error', text: 'De inval kon niet worden opgeslagen. Probeer het opnieuw.' },
  genegeerd: { tone: 'success', text: 'Gat genegeerd. Het komt terug als het tekort groter wordt.' },
  'negeren-mislukt': { tone: 'error', text: 'Negeren is niet gelukt. Probeer het opnieuw.' },
  teruggezet: { tone: 'success', text: 'Het gat staat weer bij Nog te regelen.' },
  afgehandeld: { tone: 'success', text: 'Afgehandeld.' },
  ingetrokken: { tone: 'success', text: 'Inval ingetrokken. Laat het de invaller weten.' },
  bijgewerkt: { tone: 'success', text: 'Invallen bijgewerkt.' },
  'bijwerken-mislukt': { tone: 'error', text: 'Bijwerken is niet gelukt. Probeer het opnieuw.' },
  gewijzigd: { tone: 'success', text: 'Rooster voor deze dag aangepast.' },
  verplaatst: { tone: 'success', text: 'Dienst verplaatst.' },
  hersteld: { tone: 'success', text: 'Terug naar de vaste dienst.' },
  'wijziging-mislukt': { tone: 'error', text: 'De roosterwijziging kon niet worden opgeslagen. Probeer het opnieuw.' },
  'controle-mislukt': {
    tone: 'warning',
    text: 'Opgeslagen, maar de controle op invallen is niet gelukt. Kijk bij "Let op" op het overzicht.',
  },
  'invallen-vervallen': {
    tone: 'warning',
    text: 'Opgeslagen. Er zijn invallen vervallen; zie "Let op" op het overzicht.',
  },
};

/** Korte melding na een actie, via ?melding=… in de URL. */
export function Flash({ code }: { code?: string }) {
  const message = code ? MESSAGES[code] : undefined;
  return message ? (
    <Notice tone={message.tone} className="mb-4">
      {message.text}
    </Notice>
  ) : null;
}

/** Actieve medewerkers voor een keuzelijst, per groep en op naam. */
export function employeeOptions(employees: readonly Employee[], groups: readonly Group[]): EmployeeOption[] {
  const groupOrder = [...groups].sort(compareGroups);
  return groupOrder.flatMap((group) =>
    employees
      .filter((employee) => employee.isActive && employee.groupId === group.id)
      .sort(compareByNameThenId)
      .map((employee) => ({ id: employee.id, name: employee.name, groupName: group.name })),
  );
}
