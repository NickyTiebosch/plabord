import { Notice } from '@/components/ui';
import type { Employee, Group } from '@/lib/engine/types';
import { compareByNameThenId, compareGroups } from '@/lib/engine/sort';
import type { EmployeeOption } from './afwezigheid/absence-form';

const MESSAGES: Record<string, { tone: 'success' | 'warning'; text: string }> = {
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
