/**
 * Wat de beheerder na een actie te zien krijgt over de mails (fase 3). Puur.
 */

export interface DispatchCounts {
  /** Verstuurd. */
  sent: number;
  /** Mislukt; de geplande taak probeert het later opnieuw. */
  failed: number;
  /** Niet verstuurd: de schakelaar "Mails versturen" staat uit (V18). */
  disabled: number;
  /** Niet verstuurd: de ontvanger heeft geen werkmail. */
  noAddress: number;
}

export const NO_MAILS: DispatchCounts = { sent: 0, failed: 0, disabled: 0, noAddress: 0 };

export type MailOutcome = 'verstuurd' | 'deels' | 'mislukt' | 'uit' | 'geen-adres';

/** Eén code voor de melding na een actie (`?mail=…`), of `null` als er geen mail bij hoorde. */
export function mailOutcome(counts: DispatchCounts): MailOutcome | null {
  const { sent, failed, disabled, noAddress } = counts;
  if (sent + failed + disabled + noAddress === 0) return null;
  if (disabled > 0 && sent + failed + noAddress === 0) return 'uit';
  if (failed === 0 && noAddress === 0) return 'verstuurd';
  if (sent === 0 && noAddress === 0) return 'mislukt';
  if (sent === 0 && failed === 0) return 'geen-adres';
  return 'deels';
}

export const MAIL_OUTCOME_MESSAGES: Record<MailOutcome, { tone: 'success' | 'info' | 'warning'; text: string }> = {
  verstuurd: { tone: 'success', text: 'De betrokken collega heeft een mail gekregen.' },
  deels: { tone: 'warning', text: 'Niet alle mails zijn verstuurd. Kijk bij Beheer → Mails.' },
  mislukt: {
    tone: 'warning',
    text: 'De mail kon niet worden verstuurd. Planbord probeert het later opnieuw; kijk bij Beheer → Mails.',
  },
  uit: { tone: 'info', text: 'Mails staan uit (Instellingen), dus er is geen mail verstuurd.' },
  'geen-adres': { tone: 'warning', text: 'Er is geen mail verstuurd: deze collega heeft geen werkmail.' },
};

export function isMailOutcome(value: unknown): value is MailOutcome {
  return typeof value === 'string' && Object.hasOwn(MAIL_OUTCOME_MESSAGES, value);
}
