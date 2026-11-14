/**
 * De herinnering voor het afsluiten van de dag (fase 6, V61): wie werkt er vandaag op de vestiging?
 * Puur: gegevens komen binnen als parameter.
 */
import { createScheduleContext } from '../engine/schedule';
import type { IsoDate, PlanningSnapshot } from '../engine/types';
import type { PushContent } from '../push/messages';

/**
 * De medewerkers die op deze dag op deze vestiging werken, ook als invaller en ook voor een deel
 * van de dag. Niet wie de hele dienst afwezig is, en niemand als de vestiging dicht is.
 */
export function closeReminderTargets(snapshot: PlanningSnapshot, groupId: string, date: IsoDate): string[] {
  const context = createScheduleContext(snapshot);
  const ids = new Set(
    context
      .entriesOn(date)
      .filter((entry) => entry.groupId === groupId && !entry.closure && entry.workingParts.length > 0)
      .map((entry) => entry.employeeId),
  );
  return [...ids].sort();
}

/** De melding: alleen de vestiging, geen namen. Een tik opent Binnenvallers, waar de knop staat. */
export function closeReminderPush(groupId: string, groupName: string, date: IsoDate): PushContent {
  return {
    title: 'Planbord',
    body: `${groupName}: de dag is nog niet afgesloten. Werk binnenvallers en meldingen bij en sluit de dag af.`,
    url: `/binnenvallers?vestiging=${groupId}`,
    tag: `day-close-${groupId}-${date}`,
  };
}
