import type { Metadata } from 'next';
import { SubmitButton } from '@/components/client/form-controls';
import { StatefulForm } from '@/components/client/stateful-form';
import { Card, Field, PageHeader, SectionTitle, inputClass } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/session';
import { loadGroups, loadPlanningSnapshot, loadSettings, must } from '@/lib/db/queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { formatDayShort, weekdayShort } from '@/lib/engine/format';
import { compareGroups } from '@/lib/engine/sort';
import type { Weekday } from '@/lib/engine/types';
import { previewReminderDate } from '@/lib/mail/labels';
import { composeMail, personalDaysFor } from '@/lib/mail/messages';
import { reminderTargets } from '@/lib/mail/reminders';
import { saveNorms, saveRanks, saveSettings, sendTestMailAction, setMailEnabled } from './actions';

export const metadata: Metadata = { title: 'Instellingen' };

const numberClass = 'block w-16 min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-center text-base tabular-nums';

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const preview = previewReminderDate(todayInAmsterdam(new Date()));
  const [settings, groups, norms, mailSetting, snapshot] = await Promise.all([
    loadSettings(supabase),
    loadGroups(supabase),
    supabase.from('staffing_norms').select('group_id, weekday, day_part, min_staff').then((result) => must(result, 'de normen')),
    supabase.from('settings').select('mail_enabled').maybeSingle(),
    loadPlanningSnapshot(supabase, { from: preview.date, to: preview.date }),
  ]);
  const mailEnabled = Boolean(mailSetting.data?.mail_enabled);
  // Het voorbeeld van de herinneringen (V18): wie er een krijgt, en met welke tekst.
  const reminders = reminderTargets(snapshot, preview.date).map((target) => ({
    ...target,
    content: composeMail({
      kind: 'reminder',
      name: target.name,
      days: personalDaysFor(snapshot, target.employeeId, [preview.date]),
      groups: snapshot.groups,
      appUrl: null,
    }),
  }));
  const normOf = (groupId: string, weekday: number, dayPart: string) =>
    norms.find((norm) => norm.group_id === groupId && norm.weekday === weekday && norm.day_part === dayPart)?.min_staff;
  const locations = groups.filter((group) => group.hasCounter).sort(compareGroups);
  const byRank = [...groups].sort((a, b) => a.substitutionRank - b.substitutionRank || compareGroups(a, b));

  return (
    <>
      <PageHeader title="Instellingen" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-4 lg:col-span-2">
          <div>
            <SectionTitle className="mb-1">Mails</SectionTitle>
            <p className="text-sm text-slate-600">
              Collega&rsquo;s krijgen een mail als ze worden ingezet, als een inval niet doorgaat of als hun rooster voor een
              dag verandert. De dag ervoor om 16:00 krijgen ze een herinnering als hun rooster afwijkt.
            </p>
          </div>
          <form action={setMailEnabled} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="mails" value={mailEnabled ? 'uit' : 'aan'} />
            <p className="text-sm font-medium text-slate-900">
              Mails versturen: {mailEnabled ? <span className="text-emerald-700">aan</span> : <span className="text-rose-700">uit</span>}
            </p>
            <SubmitButton size="sm" variant={mailEnabled ? 'secondary' : 'primary'}>
              {mailEnabled ? 'Zet mails uit' : 'Zet mails aan'}
            </SubmitButton>
          </form>
          <p className="text-xs text-slate-500">
            Staan mails uit, dan krijgt niemand een mail. Bij Beheer → Mails zie je wat er verstuurd zou zijn. Test eerst met
            een testmail aan jezelf, en zet mails pas daarna aan.
          </p>
          <StatefulForm action={sendTestMailAction}>
            <SubmitButton size="sm" variant="secondary">
              Testmail naar mij
            </SubmitButton>
          </StatefulForm>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Herinneringen voor {formatDayShort(preview.date)}{' '}
              <span className="font-normal text-slate-500">(gaan {formatDayShort(preview.sendDate)} om 16:00 weg)</span>
            </h3>
            {reminders.length === 0 ? (
              <p className="mt-1 text-sm text-slate-600">Niemand wijkt die dag af van het vaste rooster.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {reminders.map((reminder) => (
                  <li key={reminder.employeeId} className="px-3 py-2">
                    <details>
                      <summary className="cursor-pointer text-sm text-slate-800">
                        <span className="font-medium">{reminder.name}</span>
                        <span className="text-slate-500"> · {reminder.content.subject}</span>
                      </summary>
                      <pre className="mt-2 font-sans text-sm whitespace-pre-wrap text-slate-700">{reminder.content.text}</pre>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle className="mb-3">Diensten en dagdelen</SectionTitle>
          <StatefulForm action={saveSettings} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Standaarddienst: begin" htmlFor="standardStart">
                <input id="standardStart" name="standardStart" type="time" required defaultValue={settings.standardShift.start} className={inputClass} />
              </Field>
              <Field label="Standaarddienst: einde" htmlFor="standardEnd">
                <input id="standardEnd" name="standardEnd" type="time" required defaultValue={settings.standardShift.end} className={inputClass} />
              </Field>
              <Field label="Zaterdag: begin" htmlFor="saturdayStart">
                <input id="saturdayStart" name="saturdayStart" type="time" required defaultValue={settings.saturdayShift.start} className={inputClass} />
              </Field>
              <Field label="Zaterdag: einde" htmlFor="saturdayEnd">
                <input id="saturdayEnd" name="saturdayEnd" type="time" required defaultValue={settings.saturdayShift.end} className={inputClass} />
              </Field>
              <Field label="Grens ochtend/middag" htmlFor="dayPartBoundary" hint="Vóór deze tijd is het ochtend.">
                <input id="dayPartBoundary" name="dayPartBoundary" type="time" required defaultValue={settings.dayPartBoundary} className={inputClass} />
              </Field>
              <Field label="Nog te regelen: weken vooruit" htmlFor="lookaheadWeeks" hint="Gebruikt vanaf fase 2.">
                <input
                  id="lookaheadWeeks"
                  name="lookaheadWeeks"
                  type="number"
                  min={1}
                  max={52}
                  required
                  defaultValue={settings.lookaheadWeeks}
                  className={inputClass}
                />
              </Field>
            </div>
            <p className="text-xs text-slate-500">
              Een vaste dienst zonder begin- of eindtijd gebruikt deze standaardtijden (op zaterdag de zaterdagtijden).
            </p>
            <SubmitButton>Opslaan</SubmitButton>
          </StatefulForm>
        </Card>

        <Card className="p-4">
          <SectionTitle className="mb-1">Invalvolgorde</SectionTitle>
          <p className="mb-3 text-sm text-slate-600">
            Lager nummer = eerder gevraagd om in te vallen. Gelijke nummers zijn gelijkwaardig. Gebruikt vanaf fase 2.
          </p>
          <StatefulForm action={saveRanks} className="space-y-3">
            <ul className="divide-y divide-slate-100">
              {byRank.map((group) => (
                <li key={group.id} className="flex items-center justify-between py-2">
                  <label htmlFor={`rank-${group.id}`} className="text-sm text-slate-800">
                    {group.name}
                    {group.hasCounter ? <span className="text-slate-500"> (andere vestiging)</span> : null}
                  </label>
                  <input
                    id={`rank-${group.id}`}
                    name={`rank:${group.id}`}
                    type="number"
                    min={1}
                    max={99}
                    defaultValue={group.substitutionRank}
                    className={numberClass}
                  />
                </li>
              ))}
            </ul>
            <SubmitButton>Opslaan</SubmitButton>
          </StatefulForm>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <SectionTitle className="mb-1">Norm aan de balie</SectionTitle>
          <p className="mb-3 text-sm text-slate-600">
            Minimaal aantal mensen aan de balie per vestiging, weekdag en dagdeel. Gebruikt vanaf fase 2.
          </p>
          <StatefulForm action={saveNorms} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {locations.map((group) => (
                <fieldset key={group.id} className="rounded-lg border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-semibold text-slate-800">{group.name}</legend>
                  <table className="w-full text-sm">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="py-1 text-left font-medium">Dag</th>
                        <th className="py-1 font-medium">Ochtend</th>
                        <th className="py-1 font-medium">Middag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([1, 2, 3, 4, 5, 6] as Weekday[]).map((weekday) => (
                        <tr key={weekday}>
                          <td className="py-1 text-slate-800">{weekdayShort(weekday)}</td>
                          {(['morning', 'afternoon'] as const).map((dayPart) => (
                            <td key={dayPart} className="py-1">
                              <input
                                aria-label={`${group.name} ${weekdayShort(weekday)} ${dayPart === 'morning' ? 'ochtend' : 'middag'}`}
                                name={`norm:${group.id}:${weekday}:${dayPart}`}
                                type="number"
                                min={0}
                                max={50}
                                defaultValue={normOf(group.id, weekday, dayPart) ?? 0}
                                className={`${numberClass} mx-auto`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </fieldset>
              ))}
            </div>
            <SubmitButton>Normen opslaan</SubmitButton>
          </StatefulForm>
        </Card>
      </div>
    </>
  );
}
