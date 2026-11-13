import Link from 'next/link';
import { SubmitButton } from '@/components/client/form-controls';
import { Badge, Card, Choice, cx } from '@/components/ui';
import { formatDayShort } from '@/lib/engine/format';
import type { IsoDate } from '@/lib/engine/types';
import { localMoment } from '@/lib/loans/time';
import type { CounterGroup, DayClosure } from '@/lib/registrations/types';
import { closeDay, reopenDay } from '@/app/(app)/binnenvallers/actions';

/** Wisselen van vestiging: je eigen staat voor, de andere kun je bekijken en bijwerken. */
export function GroupSwitch({
  groups,
  current,
  href,
}: {
  groups: readonly CounterGroup[];
  current: string;
  href: (groupId: string) => string;
}) {
  if (groups.length < 2) return null;
  return (
    <nav aria-label="Vestiging" className="mb-4 flex flex-wrap gap-2">
      {groups.map((group) => (
        <Link
          key={group.id}
          href={href(group.id)}
          aria-current={group.id === current ? 'page' : undefined}
          className={cx(
            'inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium',
            group.id === current ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
          )}
        >
          {group.name}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Dag afsluiten (V60): één tik aan het eind van de dag, met het vinkje dat de contracten in RentLink
 * zijn gecontroleerd. `back`: de pagina waar je daarna weer uitkomt.
 */
export function DayCloseCard({
  group,
  date,
  today,
  closure,
  closedByName,
  canReopen,
  back,
}: {
  group: CounterGroup;
  date: IsoDate;
  today: IsoDate;
  closure: DayClosure | null;
  closedByName: string | null;
  canReopen: boolean;
  back: string;
}) {
  const day = date === today ? 'vandaag' : formatDayShort(date);
  if (closure) {
    return (
      <Card className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">Dag afgesloten</Badge>
          <p className="text-sm text-slate-600">
            {group.name}, {day} · {localMoment(closure.closedAt).time}
            {closedByName ? ` · door ${closedByName}` : ''}
          </p>
        </div>
        {closure.rentlinkChecked ? (
          <p className="text-sm text-slate-600">De contracten in RentLink zijn gecontroleerd.</p>
        ) : (
          <form action={closeDay} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="groupId" value={group.id} />
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="rentlink" value="ja" />
            <p className="text-sm text-amber-800">RentLink is nog niet afgevinkt.</p>
            <SubmitButton size="sm" variant="secondary">
              Contracten in RentLink gecontroleerd
            </SubmitButton>
          </form>
        )}
        {canReopen ? (
          <form action={reopenDay}>
            <input type="hidden" name="groupId" value={group.id} />
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="back" value={back} />
            <SubmitButton size="sm" variant="ghost" confirm="De dag heropenen? Hij telt dan weer als niet afgesloten.">
              Heropenen
            </SubmitButton>
          </form>
        ) : null}
        <p className="text-xs text-slate-500">Er kan nog iets bij; de dag blijft afgesloten.</p>
      </Card>
    );
  }
  return (
    <Card className="p-4">
      <form action={closeDay} className="space-y-3">
        <input type="hidden" name="groupId" value={group.id} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="back" value={back} />
        <div>
          <h2 className="text-base font-semibold text-slate-900">Dag afsluiten</h2>
          <p className="text-sm text-slate-600">
            {group.name}, {day}. Alle binnenvallers en meldingen staan erin. Ook als er niets was.
          </p>
        </div>
        <Choice type="checkbox" name="rentlink" value="ja" label="De contracten in RentLink zijn gecontroleerd" />
        <div>
          <SubmitButton>Dag afsluiten</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

const MESSAGES: Record<string, { tone: 'success' | 'warning'; text: string }> = {
  afgesloten: { tone: 'success', text: 'De dag is afgesloten.' },
  heropend: { tone: 'success', text: 'De dag is heropend.' },
  gemeld: { tone: 'success', text: 'De melding is opgeslagen.' },
  gewijzigd: { tone: 'success', text: 'De melding is gewijzigd.' },
  verwijderd: { tone: 'success', text: 'De melding is verwijderd.' },
  doorbelast: { tone: 'success', text: 'Opgeslagen.' },
  'geen-rechten': { tone: 'warning', text: 'Dat kan niet meer: vraag het je teamleider.' },
  'niet-gevonden': { tone: 'warning', text: 'Deze melding bestaat niet meer.' },
  fout: { tone: 'warning', text: 'Opslaan is niet gelukt. Probeer het opnieuw.' },
};

/** De melding na een actie (?melding=…). */
export function RegistrationFlash({ code }: { code?: string }) {
  const message = code ? MESSAGES[code] : undefined;
  if (!message) return null;
  return (
    <p
      role="status"
      className={cx(
        'mb-4 rounded-lg border px-3 py-2 text-sm',
        message.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900',
      )}
    >
      {message.text}
    </p>
  );
}
