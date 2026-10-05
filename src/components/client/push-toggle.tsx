'use client';

import { useEffect, useState } from 'react';
import { registerPushDevice, unregisterPushDevice } from '@/app/(app)/push-actions';
import { buttonClass } from '../ui';

/**
 * Meldingen op dit toestel (fase 4, V25). Iedereen zet het zelf aan, per toestel; de telefoon vraagt
 * om toestemming. De service worker (public/sw.js) wordt geregistreerd zodra de knop er staat: een
 * iPhone vraagt alleen om toestemming als dat direct op een tik volgt, en dan moet hij al klaarstaan.
 */

type State = 'laden' | 'niet-ingesteld' | 'iphone-beginscherm' | 'niet-ondersteund' | 'geweigerd' | 'uit' | 'aan';

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration('/');
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function detect(publicKey: string | null): Promise<State> {
  if (!publicKey) return 'niet-ingesteld';
  if (!supported()) return isIos() && !isStandalone() ? 'iphone-beginscherm' : 'niet-ondersteund';
  if (Notification.permission === 'denied') return 'geweigerd';
  const subscription = await currentSubscription();
  if (subscription) {
    // Houd de server bij: een toestel kan intussen een nieuw abonnement hebben gekregen.
    await registerPushDevice(subscription.toJSON()).catch(() => undefined);
    return 'aan';
  }
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  return 'uit';
}

export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>('laden');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    detect(publicKey)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState('niet-ondersteund');
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function turnOn() {
    if (!publicKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      });
      const saved = await registerPushDevice(subscription.toJSON());
      if (!saved.ok) {
        await subscription.unsubscribe();
        setMessage(saved.error);
        return;
      }
      setState('aan');
    } catch {
      if (Notification.permission === 'denied') setState('geweigerd');
      else setMessage('Meldingen aanzetten lukte niet. Probeer het opnieuw.');
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        const removed = await unregisterPushDevice(endpoint);
        if (!removed.ok) {
          setMessage(removed.error);
          return;
        }
      }
      setState('uit');
      setMessage('Meldingen staan uit op dit toestel.');
    } catch {
      setMessage('Meldingen uitzetten lukte niet. Probeer het opnieuw.');
    } finally {
      setBusy(false);
    }
  }

  const text: Record<State, string> = {
    laden: 'Even kijken of dit toestel meldingen kan krijgen…',
    'niet-ingesteld': 'Meldingen zijn nog niet ingesteld. Een beheerder zet ze aan onder Instellingen.',
    'iphone-beginscherm':
      'Op een iPhone werken meldingen alleen vanuit Planbord op je beginscherm (iOS 16.4 of nieuwer). Tik in Safari op de deelknop en kies Zet op beginscherm. Open Planbord daarna via het icoon en kom hier terug.',
    'niet-ondersteund':
      'Deze browser kan geen meldingen krijgen. Op Android werkt Chrome; op een iPhone werkt Planbord vanaf het beginscherm.',
    geweigerd:
      'Meldingen voor Planbord zijn geweigerd op dit toestel. Zet ze aan in de instellingen van je telefoon of browser (bij Planbord, Meldingen) en laad deze pagina opnieuw.',
    uit: 'Krijg een melding als je ergens invalt of je rooster voor een dag verandert, en om 16:00 als je rooster morgen afwijkt. Alleen over je eigen rooster.',
    aan: 'Meldingen staan aan op dit toestel. Je krijgt ze naast de mail.',
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">{text[state]}</p>
      {state === 'uit' ? (
        <button type="button" className={buttonClass('primary')} disabled={busy} aria-disabled={busy} onClick={turnOn}>
          {busy ? 'Bezig…' : 'Meldingen aanzetten'}
        </button>
      ) : null}
      {state === 'aan' ? (
        <button type="button" className={buttonClass('secondary')} disabled={busy} aria-disabled={busy} onClick={turnOff}>
          {busy ? 'Bezig…' : 'Meldingen uitzetten'}
        </button>
      ) : null}
      {message ? (
        <p className="text-sm text-slate-600" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
