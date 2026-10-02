import 'server-only';
import { createTransport } from 'nodemailer';
import { ConfigError } from '../env';

/**
 * Versturen via SMTP (fase 3, besluit V16): de Google Workspace-mailbox van de eigenaar, met een
 * eigen app-wachtwoord. De instellingen komen uit de omgeving en worden pas hier gelezen, zodat
 * de build zonder sleutels slaagt. Tests gebruiken een eigen transport en mailen nooit echt.
 */

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailTransport {
  send(mail: OutgoingMail): Promise<void>;
  close(): void;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ConfigError(name);
  return value;
}

/** SMTP met de instellingen uit de omgeving. Gooit een ConfigError als er iets ontbreekt. */
export function smtpTransport(): MailTransport {
  const host = required('SMTP_HOST');
  const user = required('SMTP_USER');
  const pass = required('SMTP_PASSWORD');
  const from = required('MAIL_FROM');
  const port = Number(process.env.SMTP_PORT?.trim() || '465');
  // Eén verbinding voor alle mails van één keer: dat scheelt tijd bij de herinneringen.
  const transporter = createTransport({
    pool: true,
    maxConnections: 1,
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return {
    async send(mail) {
      await transporter.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
    },
    close() {
      transporter.close();
    },
  };
}
