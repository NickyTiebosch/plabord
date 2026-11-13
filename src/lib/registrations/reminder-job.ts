import 'server-only';
import type { DbClient } from '../db/queries';
import { loadPlanningSnapshot } from '../db/queries';
import { loadClosures } from '../db/loan-queries';
import { loadCounterGroups, loadDayData, loadFirstClosedDates, loadRegistrationSettings } from '../db/registration-queries';
import { amsterdamDateTime } from '../engine/dates';
import { parseTime } from '../engine/time';
import { pushToDevices } from '../mail/dispatch';
import { webPushSender, type PushSender } from '../push/send';
import { closeReminderPush, closeReminderTargets } from './reminders';
import { completionGrid, needsReminder } from './status';

export interface CloseReminderResult {
  /** Vestigingen waarvoor nu een herinnering is verstuurd. */
  groups: number;
  devices: number;
}

/**
 * De herinnering voor het afsluiten van de dag (V61), in de geplande taak van elk uur, met de
 * secret key: die taak heeft geen sessie. Per vestiging hooguit één keer per dag. Alleen een
 * pushmelding, alleen als Meldingen versturen aan staat, en alleen naar wie die dag op de vestiging
 * werkt en meldingen aan heeft staan.
 */
export async function runCloseReminders(
  client: DbClient,
  options: { now: Date; push?: () => PushSender | null },
): Promise<CloseReminderResult> {
  const none = { groups: 0, devices: 0 };
  const moment = amsterdamDateTime(options.now);
  const nowTime = parseTime(moment.time);
  const [settings, enabled] = await Promise.all([
    loadRegistrationSettings(client),
    client.from('settings').select('mail_enabled').maybeSingle(),
  ]);
  if (!nowTime || !settings.reminderAt || !enabled.data?.mail_enabled) return none;
  const send = (options.push ?? webPushSender)();
  if (!send) return none;

  const today = moment.date;
  const groups = await loadCounterGroups(client);
  const [data, dayOff, firstDates, sent] = await Promise.all([
    loadDayData(client, today, today),
    loadClosures(client, today, today),
    loadFirstClosedDates(client, groups.map((group) => group.id)),
    client.from('day_close_reminders').select('group_id').eq('date', today),
  ]);
  if (sent.error) throw new Error(`Herinneringen laden mislukt: ${sent.error.message}`);
  const done = new Set((sent.data ?? []).map((row) => row.group_id));
  const due = completionGrid(groups, [today], today, data, dayOff, firstDates).filter(
    (row) => !done.has(row.groupId) && needsReminder(row, today, nowTime, settings.reminderAt),
  );
  if (due.length === 0) return none;

  const snapshot = await loadPlanningSnapshot(client, { from: today, to: today });
  const result = { ...none };
  for (const row of due) {
    // Eerst vastleggen: loopt de taak toevallig twee keer, dan weigert de database de tweede.
    const claimed = await client.from('day_close_reminders').insert({ group_id: row.groupId, date: today });
    if (claimed.error) continue;
    const employeeIds = closeReminderTargets(snapshot, row.groupId, today);
    if (employeeIds.length === 0) continue;
    const devices = await client.from('push_subscriptions').select('id, employee_id, endpoint, p256dh, auth').in('employee_id', employeeIds);
    if (devices.error || !devices.data?.length) continue;
    const delivered = await pushToDevices(client, send, devices.data, closeReminderPush(row.groupId, row.groupName, today), options.now);
    await client.from('day_close_reminders').update({ devices: delivered }).eq('group_id', row.groupId).eq('date', today);
    result.groups += 1;
    result.devices += delivered;
  }
  return result;
}
