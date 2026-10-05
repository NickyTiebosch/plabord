import { addDays } from '@/lib/engine/dates';
import type { IsoDate } from '@/lib/engine/types';
import { DEFAULT_ROSTER_WEEKS, MAX_ROSTER_WEEKS } from '@/lib/export/roster';
import { Field, buttonClass, inputClass } from './ui';

/**
 * Het rooster downloaden als Excel (besluit V22). Een gewoon formulier zonder JavaScript: het
 * bestand komt als download en de pagina blijft staan. Standaard vier weken vanaf `from`.
 */
export function RosterExportForm({ from }: { from: IsoDate }) {
  const to = addDays(from, (DEFAULT_ROSTER_WEEKS - 1) * 7 + 5);
  return (
    <form action="/rooster/export" method="get" className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:max-w-md">
        <Field label="Van" htmlFor="export-van">
          <input id="export-van" name="van" type="date" required defaultValue={from} className={inputClass} />
        </Field>
        <Field label="Tot en met" htmlFor="export-tot">
          <input id="export-tot" name="tot" type="date" required defaultValue={to} className={inputClass} />
        </Field>
      </div>
      <p className="text-xs text-slate-500">
        Hele weken, van maandag tot en met zaterdag. Hooguit {MAX_ROSTER_WEEKS} weken; een langere periode wordt ingekort.
      </p>
      <button type="submit" className={buttonClass('secondary')}>
        Excel downloaden
      </button>
    </form>
  );
}
