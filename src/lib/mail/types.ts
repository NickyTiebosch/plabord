import type { IsoDate } from '../engine/types';

/**
 * Soorten mail (fase 3, besluit V14):
 * - `substitution_assigned`: je bent ingezet als invaller;
 * - `substitution_cancelled`: je inval gaat niet door;
 * - `day_changed`: je rooster voor één of meer dagen is gewijzigd;
 * - `reminder`: herinnering de dag ervoor, als je rooster die dag afwijkt (V15);
 * - `test`: de testmail van een beheerder aan zichzelf (V18);
 * - `invite`: de uitnodiging voor Planbord, die een beheerder verstuurt (V33).
 */
export const MAIL_KINDS = ['substitution_assigned', 'substitution_cancelled', 'day_changed', 'reminder', 'test', 'invite'] as const;
export type MailKind = (typeof MAIL_KINDS)[number];

/** Deze soorten gaan altijd, ook als Meldingen versturen uit staat (V18, V33), en zonder push. */
export function alwaysSent(kind: MailKind): boolean {
  return kind === 'test' || kind === 'invite';
}

/** Een mail die een actie van een beheerder veroorzaakt. */
export type NoticeKind = Extract<MailKind, 'substitution_assigned' | 'substitution_cancelled' | 'day_changed'>;

export interface MailNotice {
  employeeId: string;
  kind: NoticeKind;
  dates: IsoDate[];
}

export const MAIL_STATUSES = ['pending', 'sent', 'failed', 'skipped'] as const;
export type MailStatus = (typeof MAIL_STATUSES)[number];

/** Een regel uit de wachtrij, zoals de app hem leest. */
export interface QueuedMail {
  id: string;
  employeeId: string;
  kind: MailKind;
  dates: IsoDate[];
  status: MailStatus;
  attempts: number;
  createdAt: string;
}

export interface MailContent {
  subject: string;
  text: string;
  html: string;
}
